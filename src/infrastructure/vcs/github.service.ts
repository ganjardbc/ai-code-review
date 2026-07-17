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

const REVIEW_THREADS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            isResolved
            comments(first: 100) {
              nodes { body path line }
            }
          }
        }
      }
    }
  }
`;

interface ReviewThreadComment {
  body: string;
  path: string;
  line: number | null;
}

interface ReviewThreadsResponse {
  repository: {
    pullRequest: {
      reviewThreads: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: Array<{ isResolved: boolean; comments: { nodes: ReviewThreadComment[] } }>;
      };
    };
  };
}

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
    const outstanding: OutstandingComment[] = [];
    let cursor: string | null = null;

    do {
      const response: ReviewThreadsResponse = await this.octokit.graphql(REVIEW_THREADS_QUERY, {
        owner,
        repo,
        number: pullNumber,
        cursor,
      });

      const threads = response.repository.pullRequest.reviewThreads;

      for (const thread of threads.nodes) {
        if (thread.isResolved) continue;

        for (const comment of thread.comments.nodes) {
          if (!hasBotMarker(comment.body)) continue;

          // A null `line` means the comment's diff position is outdated (the
          // file changed since it was posted) — skip it rather than fixing
          // the wrong line, mirroring the old REST-based `line != null` filter.
          if (!comment.path || comment.line == null) continue;

          outstanding.push({ filePath: comment.path, lineNumber: comment.line, message: comment.body });
        }
      }

      cursor = threads.pageInfo.hasNextPage ? threads.pageInfo.endCursor : null;
    } while (cursor);

    return outstanding;
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
