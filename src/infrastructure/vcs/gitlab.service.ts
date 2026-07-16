import { Gitlab } from '@gitbeaker/rest';
import type {
  IGitlabClient,
  MergeRequestInfo,
  PostMrReviewOptions,
  OutstandingComment,
  PostMrFixReplyOptions,
} from '../../domain/interfaces/vcs-client.interface.js';
import { config } from '../../config/index.js';
import { logger } from '../logging/logger.js';
import { withBotMarker, hasBotMarker } from './bot-marker.js';

export class GitlabService implements IGitlabClient {
  private readonly api: InstanceType<typeof Gitlab>;

  constructor() {
    this.api = new Gitlab({
      token: config.GITLAB_ACCESS_TOKEN,
      host: config.GITLAB_API_URL,
    });
  }

  async postReview(options: PostMrReviewOptions): Promise<void> {
    const { projectId, mrIid, baseSha, startSha, headSha, comments } = options;

    if (comments.length === 0) {
      logger.info('No comments to post for GitLab MR', undefined, { projectId, mrIid });
      return;
    }

    const failures: string[] = [];

    const hasValidDiffRefs = baseSha !== headSha;

    for (const comment of comments) {
      const body = withBotMarker(`**[${comment.severity}]** \`${comment.filePath}:${comment.lineNumber}\` ${comment.message}`);
      try {
        if (hasValidDiffRefs) {
          try {
            await this.api.MergeRequestDiscussions.create(
              projectId,
              mrIid,
              body,
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
          } catch {
            await this.api.MergeRequestNotes.create(projectId, mrIid, body);
          }
        } else {
          await this.api.MergeRequestNotes.create(projectId, mrIid, body);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${comment.filePath}:${comment.lineNumber} — ${msg}`);
        logger.error('Failed to post GitLab comment', err instanceof Error ? err : new Error(msg), {
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

  async listOutstandingBotComments(projectId: number, mrIid: number): Promise<OutstandingComment[]> {
    const discussions = await this.api.MergeRequestDiscussions.all(projectId, mrIid);

    const outstanding: OutstandingComment[] = [];
    for (const discussion of discussions) {
      const notes = (discussion.notes ?? []) as unknown as Array<{ body?: string; resolved?: boolean; position?: { new_path?: string; new_line?: number } }>;
      for (const note of notes) {
        const body = note.body ?? '';
        if (!hasBotMarker(body) || note.resolved) continue;

        const position = note.position;
        if (!position?.new_path || position.new_line == null) continue;

        outstanding.push({
          filePath: position.new_path,
          lineNumber: position.new_line,
          message: body,
        });
      }
    }

    return outstanding;
  }

  async postMrNote(options: PostMrFixReplyOptions): Promise<void> {
    const { projectId, mrIid, body } = options;
    await this.api.MergeRequestNotes.create(projectId, mrIid, body);
  }

  async getMergeRequest(projectId: number, mrIid: number): Promise<MergeRequestInfo> {
    const mr = await this.api.MergeRequests.show(projectId, mrIid);
    const refs = (mr as unknown as { diff_refs?: { base_sha: string; start_sha: string; head_sha: string } }).diff_refs;
    if (!refs) {
      throw new Error(`MR ${mrIid} has no diff_refs — cannot anchor inline comments`);
    }
    return {
      baseSha: refs.base_sha,
      startSha: refs.start_sha,
      headSha: refs.head_sha,
    };
  }
}

export const gitlabService = new GitlabService();
