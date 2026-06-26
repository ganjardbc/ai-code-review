import { Octokit } from '@octokit/rest';
import type { IGithubClient, PostReviewOptions } from '../../domain/interfaces/vcs-client.interface.js';
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
}

export const githubService = new GithubService();
