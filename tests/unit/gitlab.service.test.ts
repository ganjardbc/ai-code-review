import '../mocks/env.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const discussionsAllMock = vi.fn();
const notesCreateMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@gitbeaker/rest', () => ({
  Gitlab: class {
    MergeRequestDiscussions = { all: discussionsAllMock, create: vi.fn() };
    MergeRequestNotes = { create: notesCreateMock };
    MergeRequests = { show: vi.fn() };
  },
}));

const { GitlabService } = await import('../../src/infrastructure/vcs/gitlab.service.js');

const BOT_BODY = '**[WARNING]** `src/auth.ts:10` Missing validation\n<!-- ai-code-review:bot -->';

describe('GitlabService.listOutstandingBotComments', () => {
  const service = new GitlabService();

  beforeEach(() => {
    discussionsAllMock.mockReset();
  });

  it('returns unresolved bot-marked notes anchored via position', async () => {
    discussionsAllMock.mockResolvedValueOnce([
      {
        notes: [
          { body: BOT_BODY, resolved: false, position: { new_path: 'src/auth.ts', new_line: 10 } },
        ],
      },
    ]);

    const result = await service.listOutstandingBotComments(123, 5);
    expect(result).toEqual([{ filePath: 'src/auth.ts', lineNumber: 10, message: BOT_BODY }]);
  });

  it('excludes resolved notes', async () => {
    discussionsAllMock.mockResolvedValueOnce([
      {
        notes: [
          { body: BOT_BODY, resolved: true, position: { new_path: 'src/auth.ts', new_line: 10 } },
        ],
      },
    ]);

    const result = await service.listOutstandingBotComments(123, 5);
    expect(result).toHaveLength(0);
  });

  it('excludes notes without the bot marker', async () => {
    discussionsAllMock.mockResolvedValueOnce([
      { notes: [{ body: 'a human reply', resolved: false, position: { new_path: 'src/auth.ts', new_line: 10 } }] },
    ]);

    const result = await service.listOutstandingBotComments(123, 5);
    expect(result).toHaveLength(0);
  });

  it('falls back to parsing filePath:line from the note body when position is missing (no diff_refs case)', async () => {
    discussionsAllMock.mockResolvedValueOnce([
      { notes: [{ body: BOT_BODY, resolved: false }] },
    ]);

    const result = await service.listOutstandingBotComments(123, 5);
    expect(result).toEqual([{ filePath: 'src/auth.ts', lineNumber: 10, message: BOT_BODY }]);
  });

  it('skips notes with neither position nor a parseable body when position is missing', async () => {
    discussionsAllMock.mockResolvedValueOnce([
      { notes: [{ body: '**[WARNING]** Missing validation\n<!-- ai-code-review:bot -->', resolved: false }] },
    ]);

    const result = await service.listOutstandingBotComments(123, 5);
    expect(result).toHaveLength(0);
  });
});
