import { Gitlab } from '@gitbeaker/rest';
import type { IGitlabClient, PostMrReviewOptions } from '../../domain/interfaces/vcs-client.interface.js';
import { config } from '../../config/index.js';
import { logger } from '../logging/logger.js';

export class GitlabService implements IGitlabClient {
  private readonly api: InstanceType<typeof Gitlab>;

  constructor() {
    this.api = new Gitlab({ token: config.GITLAB_ACCESS_TOKEN });
  }

  async postReview(options: PostMrReviewOptions): Promise<void> {
    const { projectId, mrIid, baseSha, startSha, headSha, comments } = options;

    if (comments.length === 0) {
      logger.info('No comments to post for GitLab MR', undefined, { projectId, mrIid });
      return;
    }

    const failures: string[] = [];

    for (const comment of comments) {
      try {
        await this.api.MergeRequestDiscussions.create(
          projectId,
          mrIid,
          `**[${comment.severity}]** ${comment.message}`,
          {
            position: {
              baseSha,
              startSha,
              headSha,
              positionType: 'text' as const,
              newPath: comment.filePath,
              newLine: String(comment.lineNumber),
            },
          },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${comment.filePath}:${comment.lineNumber} — ${msg}`);
        logger.error('Failed to post GitLab discussion comment', err instanceof Error ? err : new Error(msg), {
          projectId,
          mrIid,
          filePath: comment.filePath,
          lineNumber: comment.lineNumber,
        });
      }
    }

    const posted = comments.length - failures.length;
    logger.info('Posted GitLab MR review comments', undefined, {
      projectId,
      mrIid,
      posted,
      failed: failures.length,
    });
  }
}

export const gitlabService = new GitlabService();
