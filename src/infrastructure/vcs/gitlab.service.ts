import { Gitlab } from '@gitbeaker/rest';
import type { IGitlabClient, MergeRequestInfo, PostMrReviewOptions, ExistingComment } from '../../domain/interfaces/vcs-client.interface.js';
import { config } from '../../config/index.js';
import { logger } from '../logging/logger.js';

// Matches the body format our bot writes: **[SEVERITY]** `filepath:lineNumber` message
const BOT_NOTE_RE = /^\*\*\[(?:INFO|WARNING|CRITICAL)\]\*\*\s*`([^:]+):(\d+)`\s+/;

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
      const body = `**[${comment.severity}]** \`${comment.filePath}:${comment.lineNumber}\` ${comment.message}`;
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

  async getExistingMrNotes(projectId: number, mrIid: number): Promise<ExistingComment[]> {
    try {
      const notes = await this.api.MergeRequestNotes.all(projectId, mrIid);
      const result: ExistingComment[] = [];
      for (const note of notes as Array<{ body?: string; system?: boolean }>) {
        if (note.system || !note.body) continue;
        const match = BOT_NOTE_RE.exec(note.body);
        if (match) {
          result.push({
            filePath: match[1]!,
            lineNumber: parseInt(match[2]!, 10),
            body: note.body,
          });
        }
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to fetch existing GitLab MR notes, skipping deduplication', undefined, { projectId, mrIid, error: msg });
      return [];
    }
  }
}

export const gitlabService = new GitlabService();
