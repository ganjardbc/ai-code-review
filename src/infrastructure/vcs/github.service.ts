import { Octokit } from '@octokit/rest';
import type { IGithubClient, PostReviewOptions, PullRequestInfo, ExistingComment } from '../../domain/interfaces/vcs-client.interface.js';
import { config } from '../../config/index.js';
import { logger } from '../logging/logger.js';

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
      body: `**[${c.severity}]** ${c.message}`,
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

  async getExistingReviewComments(owner: string, repo: string, pullNumber: number): Promise<ExistingComment[]> {
    try {
      const result: ExistingComment[] = [];
      let page = 1;
      while (true) {
        const { data } = await this.octokit.pulls.listReviewComments({
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100,
          page,
        });
        for (const c of data) {
          result.push({
            filePath: c.path,
            lineNumber: c.line ?? c.original_line ?? 0,
            body: c.body,
          });
        }
        if (data.length < 100) break;
        page++;
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to fetch existing GitHub review comments, skipping deduplication', undefined, { owner, repo, pullNumber, error: msg });
      return [];
    }
  }
}

export const githubService = new GithubService();
