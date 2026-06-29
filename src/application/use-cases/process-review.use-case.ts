import type { IGitService, IWorkspaceManager } from '../../domain/interfaces/git.interface.js';
import type { IAiProvider, AiReviewComment } from '../../domain/interfaces/ai-provider.interface.js';
import type { IPromptBuilder } from '../services/prompt.service.js';
import type { IOutputParser } from '../services/parser.service.js';
import type { IGithubClient, IGitlabClient, ExistingComment } from '../../domain/interfaces/vcs-client.interface.js';
import type { JobPayload } from '../../domain/interfaces/queue.interface.js';
import type { INotifier } from '../../domain/interfaces/notifier.interface.js';
import { logger } from '../../infrastructure/logging/logger.js';

export function deduplicateComments(incoming: AiReviewComment[], existing: ExistingComment[]): AiReviewComment[] {
  if (existing.length === 0) return incoming;
  return incoming.filter(
    c => !existing.some(e => e.filePath === c.filePath && e.lineNumber === c.lineNumber && e.body.includes(c.message)),
  );
}

export interface ProcessReviewDeps {
  gitService: IGitService;
  workspaceManager: IWorkspaceManager;
  aiProvider: IAiProvider;
  promptBuilder: IPromptBuilder;
  outputParser: IOutputParser;
  githubClient: IGithubClient;
  gitlabClient: IGitlabClient;
  notifier?: INotifier;
}

function ms(start: bigint): number {
  return Math.round(Number(process.hrtime.bigint() - start) / 1e6);
}

function buildPrUrl(job: JobPayload): string | undefined {
  if (job.provider === 'github' && job.repoOwner && job.repoName && job.prNumber) {
    return `https://github.com/${job.repoOwner}/${job.repoName}/pull/${job.prNumber}`;
  }
  if (job.provider === 'gitlab' && job.mrIid) {
    const base = job.cloneUrl.replace(/\.git$/, '');
    return `${base}/-/merge_requests/${job.mrIid}`;
  }
  return undefined;
}

function repoLabel(job: JobPayload): string {
  if (job.repoOwner && job.repoName) return `${job.repoOwner}/${job.repoName}`;
  return job.repoName ?? String(job.projectId ?? 'unknown');
}

export class ProcessReviewUseCase {
  constructor(private readonly deps: ProcessReviewDeps) {}

  async execute(job: JobPayload): Promise<void> {
    const {
      gitService,
      workspaceManager,
      aiProvider,
      promptBuilder,
      githubClient,
      gitlabClient,
      notifier,
    } = this.deps;

    const jobStart = process.hrtime.bigint();
    const workspacePath = await workspaceManager.createWorkspace();
    const repoPath = `${workspacePath}/repo`;

    logger.info('Review job started', undefined, {
      jobId: job.jobId,
      provider: job.provider,
      repo: job.repoName ?? String(job.projectId),
      headRef: job.headRef,
      baseRef: job.baseRef,
    });

    try {
      const cloneStart = process.hrtime.bigint();
      await gitService.clone(job.cloneUrl, job.headRef, repoPath);
      await gitService.checkout(repoPath, job.headSha);
      logger.info('Git clone+checkout done', undefined, { jobId: job.jobId, durationMs: ms(cloneStart) });

      const diffStart = process.hrtime.bigint();
      const diff = await gitService.generateDiff(repoPath, job.baseRef, job.headRef);
      const diffBytes = Buffer.byteLength(diff, 'utf-8');
      logger.info('Diff generated', undefined, { jobId: job.jobId, diffBytes, durationMs: ms(diffStart) });

      if (!diff.trim()) {
        logger.info('Empty diff — skipping review', undefined, { jobId: job.jobId });
        return;
      }

      const prompt = promptBuilder.build(diff);
      const truncated = prompt.includes('[TRUNCATED:');

      const aiStart = process.hrtime.bigint();
      const reviewResult = await aiProvider.review(prompt);
      logger.info('AI review done', undefined, {
        jobId: job.jobId,
        commentCount: reviewResult.comments.length,
        truncated,
        durationMs: ms(aiStart),
      });

      if (reviewResult.comments.length === 0) {
        logger.info('No comments to post', undefined, { jobId: job.jobId });
        return;
      }

      const dedupStart = process.hrtime.bigint();
      const existingComments = job.provider === 'github'
        ? await githubClient.getExistingReviewComments(job.repoOwner!, job.repoName!, job.prNumber!)
        : await gitlabClient.getExistingMrNotes(job.projectId!, job.mrIid!);

      const newComments = deduplicateComments(reviewResult.comments, existingComments);
      const skippedCount = reviewResult.comments.length - newComments.length;

      logger.info('Deduplication complete', undefined, {
        jobId: job.jobId,
        total: reviewResult.comments.length,
        new: newComments.length,
        skipped: skippedCount,
        durationMs: ms(dedupStart),
      });

      if (newComments.length === 0) {
        logger.info('All comments are duplicates — nothing to post', undefined, { jobId: job.jobId });
        return;
      }

      const vcsStart = process.hrtime.bigint();

      if (job.provider === 'github') {
        if (!job.repoOwner || !job.repoName || !job.prNumber) {
          throw new Error('Missing GitHub metadata: repoOwner, repoName, prNumber required');
        }
        await githubClient.postReview({
          owner: job.repoOwner,
          repo: job.repoName,
          pullNumber: job.prNumber,
          commitSha: job.headSha,
          comments: newComments,
        });
      } else if (job.provider === 'gitlab') {
        if (!job.projectId || !job.mrIid) {
          throw new Error('Missing GitLab metadata: projectId, mrIid required');
        }
        await gitlabClient.postReview({
          projectId: job.projectId,
          mrIid: job.mrIid,
          baseSha: job.baseSha ?? job.headSha,
          startSha: job.startSha ?? job.headSha,
          headSha: job.headSha,
          comments: newComments,
        });
      }

      logger.info('VCS comments posted', undefined, {
        jobId: job.jobId,
        provider: job.provider,
        commentCount: newComments.length,
        durationMs: ms(vcsStart),
      });

      const totalMs = ms(jobStart);
      logger.info('Review job completed', undefined, {
        jobId: job.jobId,
        totalDurationMs: totalMs,
      });

      await notifier?.notifyReviewComplete({
        jobId: job.jobId,
        provider: job.provider,
        repoLabel: repoLabel(job),
        prNumber: (job.prNumber ?? job.mrIid)!,
        commentCount: newComments.length,
        durationMs: totalMs,
        prUrl: buildPrUrl(job),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Review job failed', err instanceof Error ? err : new Error(String(err)), {
        jobId: job.jobId,
        totalDurationMs: ms(jobStart),
      });
      await notifier?.notifyReviewFailed({
        jobId: job.jobId,
        provider: job.provider,
        repoLabel: repoLabel(job),
        prNumber: (job.prNumber ?? job.mrIid) ?? 0,
        errorMessage,
      });
      throw err;
    } finally {
      await workspaceManager.cleanupWorkspace(workspacePath);
    }
  }
}
