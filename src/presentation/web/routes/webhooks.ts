import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '../../../config/index.js';
import {
  verifyGithubSignature,
  verifyGitlabToken,
  isSafeBranchName,
} from '../../../infrastructure/vcs/security.js';
import {
  githubWebhookSchema,
  githubIssueCommentSchema,
  gitlabWebhookSchema,
  gitlabNoteHookSchema,
} from '../../dto/webhook.dto.js';
import { logger } from '../../../infrastructure/logging/logger.js';
import { reviewQueue } from '../../../infrastructure/queue/client.js';
import { githubService } from '../../../infrastructure/vcs/github.service.js';
import type { JobPayload } from '../../../domain/interfaces/queue.interface.js';

const GITHUB_PR_ACTIONS = new Set(['opened', 'reopened', 'synchronize']);
const GITLAB_MR_ACTIONS = new Set(['open', 'reopen', 'update']);
const REVIEW_COMMAND = /^\s*\/review\b/i;

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/github', async (request, reply) => {
    if (!verifyGithubSignature(request.rawBody, request.headers['x-hub-signature-256'] as string | undefined, config.GITHUB_WEBHOOK_SECRET)) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid webhook token or signature mismatch.',
      });
    }

    const event = request.headers['x-github-event'] as string | undefined;

    if (event === 'issue_comment') {
      const parsed = githubIssueCommentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message ?? 'Invalid payload',
        });
      }

      const payload = parsed.data;

      if (payload.action !== 'created') {
        return reply.status(200).send({ status: 'ignored', reason: 'Not a new comment' });
      }

      if (!payload.issue.pull_request) {
        return reply.status(200).send({ status: 'ignored', reason: 'Comment on issue, not PR' });
      }

      if (!REVIEW_COMMAND.test(payload.comment.body)) {
        return reply.status(200).send({ status: 'ignored', reason: 'No /review command found' });
      }

      const owner = payload.repository.owner.login;
      const repo = payload.repository.name;
      const prNumber = payload.issue.number;

      let pr: { headRef: string; baseRef: string; headSha: string; cloneUrl: string };
      try {
        pr = await githubService.getPullRequest(owner, repo, prNumber);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Failed to fetch PR for comment trigger', err instanceof Error ? err : new Error(msg), { owner, repo, prNumber });
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to fetch PR details' });
      }

      if (!isSafeBranchName(pr.headRef) || !isSafeBranchName(pr.baseRef)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Branch name contains invalid characters.',
        });
      }

      const jobId = `git-${randomUUID()}`;
      const jobData: JobPayload = {
        jobId,
        provider: 'github',
        cloneUrl: pr.cloneUrl,
        headRef: pr.headRef,
        baseRef: pr.baseRef,
        headSha: pr.headSha,
        prNumber,
        repoOwner: owner,
        repoName: repo,
      };

      const queuedId = await reviewQueue.addJob('github-review', jobData as unknown as Record<string, unknown>);

      logger.info('GitHub PR comment trigger enqueued', undefined, {
        jobId: queuedId,
        repo: `${owner}/${repo}`,
        pr: prNumber,
        head: pr.headRef,
        base: pr.baseRef,
      });

      return reply.status(202).send({ status: 'enqueued', jobId: queuedId });
    }

    if (event && event !== 'pull_request') {
      return reply.status(200).send({
        status: 'ignored',
        reason: `Unsupported event: ${event}`,
      });
    }

    const parsed = githubWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Invalid payload',
      });
    }

    const payload = parsed.data;

    if (!GITHUB_PR_ACTIONS.has(payload.action)) {
      return reply.status(200).send({ status: 'ignored', action: payload.action });
    }

    const headRef = payload.pull_request.head.ref;
    const baseRef = payload.pull_request.base.ref;

    if (!isSafeBranchName(headRef) || !isSafeBranchName(baseRef)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Branch name contains invalid characters.',
      });
    }

    const jobId = `git-${randomUUID()}`;
    const jobData: JobPayload = {
      jobId,
      provider: 'github',
      cloneUrl: payload.repository.clone_url,
      headRef,
      baseRef,
      headSha: payload.pull_request.head.sha,
      prNumber: payload.number,
      repoOwner: payload.repository.owner.login,
      repoName: payload.repository.name,
    };

    const queuedId = await reviewQueue.addJob('github-review', jobData as unknown as Record<string, unknown>);

    logger.info('GitHub PR webhook enqueued', undefined, {
      jobId: queuedId,
      repo: `${payload.repository.owner.login}/${payload.repository.name}`,
      pr: payload.number,
      head: headRef,
      base: baseRef,
    });

    return reply.status(202).send({ status: 'enqueued', jobId: queuedId });
  });

  app.post('/gitlab', async (request, reply) => {
    if (!verifyGitlabToken(request.headers['x-gitlab-token'] as string | undefined, config.GITLAB_WEBHOOK_SECRET)) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid webhook token or signature mismatch.',
      });
    }

    const event = request.headers['x-gitlab-event'] as string | undefined;

    if (event === 'Note Hook') {
      const parsed = gitlabNoteHookSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message ?? 'Invalid payload',
        });
      }

      const payload = parsed.data;

      if (payload.object_attributes.noteable_type !== 'MergeRequest') {
        return reply.status(200).send({ status: 'ignored', reason: 'Note not on MergeRequest' });
      }

      if (!REVIEW_COMMAND.test(payload.object_attributes.note)) {
        return reply.status(200).send({ status: 'ignored', reason: 'No /review command found' });
      }

      const mr = payload.merge_request;
      if (!mr) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Missing merge_request in Note Hook payload',
        });
      }

      if (!isSafeBranchName(mr.source_branch) || !isSafeBranchName(mr.target_branch)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Branch name contains invalid characters.',
        });
      }

      const jobId = `gitlab-${randomUUID()}`;
      const jobData: JobPayload = {
        jobId,
        provider: 'gitlab',
        cloneUrl: mr.target.git_http_url,
        headRef: mr.source_branch,
        baseRef: mr.target_branch,
        headSha: mr.last_commit.id,
        mrIid: mr.iid,
        projectId: payload.project.id,
        baseSha: mr.diff_refs?.base_sha,
        startSha: mr.diff_refs?.start_sha,
      };

      const queuedId = await reviewQueue.addJob('gitlab-review', jobData as unknown as Record<string, unknown>);

      logger.info('GitLab MR comment trigger enqueued', undefined, {
        jobId: queuedId,
        projectId: payload.project.id,
        mrIid: mr.iid,
        source: mr.source_branch,
        target: mr.target_branch,
      });

      return reply.status(202).send({ status: 'enqueued', jobId: queuedId });
    }

    if (event && event !== 'Merge Request Hook') {
      return reply.status(200).send({
        status: 'ignored',
        reason: `Unsupported event: ${event}`,
      });
    }

    const parsed = gitlabWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Invalid payload',
      });
    }

    const payload = parsed.data;

    if (!GITLAB_MR_ACTIONS.has(payload.object_attributes.action)) {
      return reply.status(200).send({ status: 'ignored', action: payload.object_attributes.action });
    }

    const sourceBranch = payload.object_attributes.source_branch;
    const targetBranch = payload.object_attributes.target_branch;

    if (!isSafeBranchName(sourceBranch) || !isSafeBranchName(targetBranch)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Branch name contains invalid characters.',
      });
    }

    const jobId = `gitlab-${randomUUID()}`;
    const jobData: JobPayload = {
      jobId,
      provider: 'gitlab',
      cloneUrl: payload.object_attributes.target.git_http_url,
      headRef: sourceBranch,
      baseRef: targetBranch,
      headSha: payload.object_attributes.last_commit.id,
      mrIid: payload.object_attributes.iid,
      projectId: payload.project.id,
      baseSha: payload.object_attributes.diff_refs?.base_sha,
      startSha: payload.object_attributes.diff_refs?.start_sha,
    };

    const queuedId = await reviewQueue.addJob('gitlab-review', jobData as unknown as Record<string, unknown>);

    logger.info('GitLab MR webhook enqueued', undefined, {
      jobId: queuedId,
      projectId: payload.project.id,
      mrIid: payload.object_attributes.iid,
      source: sourceBranch,
      target: targetBranch,
    });

    return reply.status(202).send({ status: 'enqueued', jobId: queuedId });
  });
}
