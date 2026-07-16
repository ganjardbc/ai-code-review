import { Octokit } from '@octokit/rest';
import type {
  IGithubClient,
  PostReviewOptions,
  PullRequestInfo,
  OutstandingComment,
  PostFixReplyOptions,
} from '../../domain/interfaces/vcs-client.interface.js';
import { config } from '../../config/index.js';
import { logger } from '../logging/logger.js';
import { withBotMarker, hasBotMarker } from './bot-marker.js';

export class GithubService implements IGithubClient {
  private readonly octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({ auth: config.GITHUB_ACCESS_TOKEN });
  }

  async postReview(options: PostReviewOptions): Promise<void> {
    const { owner, repo, pullNumber, commitSha, comments } = options;

    if (comments.length === 0) {
      logger.info('No comments to post for GitHub PR', undefined, { owner, repo, pullNumber });
      return;
    }

    const reviewComments = comments.map((c) => ({
      path: c.filePath,
      line: c.lineNumber,
      side: 'RIGHT' as const,
      body: withBotMarker(`**[${c.severity}]** ${c.message}`),
    }));

    try {
      await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitSha,
        event: 'COMMENT',
        comments: reviewComments,
      });

      logger.info('Posted GitHub PR review', undefined, {
        owner,
        repo,
        pullNumber,
        commentCount: comments.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to post GitHub review', err instanceof Error ? err : new Error(msg), {
        owner,
        repo,
        pullNumber,
      });
      throw err;
    }
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<PullRequestInfo> {
    const { data } = await this.octokit.pulls.get({ owner, repo, pull_number: pullNumber });
    return {
      headRef: data.head.ref,
      baseRef: data.base.ref,
      headSha: data.head.sha,
      cloneUrl: data.base.repo.clone_url,
    };
  }

  async listOutstandingBotComments(owner: string, repo: string, pullNumber: number): Promise<OutstandingComment[]> {
    const { data } = await this.octokit.pulls.listReviewComments({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    return data
      .filter((c) => hasBotMarker(c.body) && c.path && c.line != null)
      .map((c) => ({
        filePath: c.path,
        lineNumber: c.line as number,
        message: c.body,
      }));
  }

  async postIssueComment(options: PostFixReplyOptions): Promise<void> {
    const { owner, repo, pullNumber, body } = options;
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
  }
}

export const githubService = new GithubService();
