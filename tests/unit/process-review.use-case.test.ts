import '../mocks/env.js';
import { describe, it, expect } from 'vitest';
import { deduplicateComments } from '../../src/application/use-cases/process-review.use-case.js';
import type { AiReviewComment } from '../../src/domain/interfaces/ai-provider.interface.js';
import type { ExistingComment } from '../../src/domain/interfaces/vcs-client.interface.js';

const makeComment = (filePath: string, lineNumber: number, message: string): AiReviewComment => ({
  filePath,
  lineNumber,
  message,
  severity: 'WARNING',
});

const makeExisting = (filePath: string, lineNumber: number, bodyMessage: string): ExistingComment => ({
  filePath,
  lineNumber,
  body: `**[WARNING]** ${bodyMessage}`,
});

describe('deduplicateComments', () => {
  it('returns all comments when there are no existing comments', () => {
    const incoming = [makeComment('src/foo.ts', 10, 'Possible null deref')];
    expect(deduplicateComments(incoming, [])).toHaveLength(1);
  });

  it('filters out a comment that matches file, line, and message', () => {
    const msg = 'Possible null deref';
    const incoming = [makeComment('src/foo.ts', 10, msg)];
    const existing = [makeExisting('src/foo.ts', 10, msg)];
    expect(deduplicateComments(incoming, existing)).toHaveLength(0);
  });

  it('keeps a comment when the line number differs', () => {
    const msg = 'Possible null deref';
    const incoming = [makeComment('src/foo.ts', 20, msg)];
    const existing = [makeExisting('src/foo.ts', 10, msg)];
    expect(deduplicateComments(incoming, existing)).toHaveLength(1);
  });

  it('keeps a comment when the file path differs', () => {
    const msg = 'Possible null deref';
    const incoming = [makeComment('src/bar.ts', 10, msg)];
    const existing = [makeExisting('src/foo.ts', 10, msg)];
    expect(deduplicateComments(incoming, existing)).toHaveLength(1);
  });

  it('keeps a comment when the message differs', () => {
    const incoming = [makeComment('src/foo.ts', 10, 'New issue')];
    const existing = [makeExisting('src/foo.ts', 10, 'Old issue')];
    expect(deduplicateComments(incoming, existing)).toHaveLength(1);
  });

  it('returns only new comments when some are duplicates', () => {
    const incoming = [
      makeComment('src/a.ts', 1, 'Issue A'),
      makeComment('src/b.ts', 2, 'Issue B'),
      makeComment('src/c.ts', 3, 'Issue C'),
    ];
    const existing = [
      makeExisting('src/a.ts', 1, 'Issue A'),
      makeExisting('src/c.ts', 3, 'Issue C'),
    ];
    const result = deduplicateComments(incoming, existing);
    expect(result).toHaveLength(1);
    expect(result[0]?.filePath).toBe('src/b.ts');
  });

  it('returns empty array when all comments are duplicates', () => {
    const incoming = [
      makeComment('src/a.ts', 1, 'Issue A'),
      makeComment('src/b.ts', 2, 'Issue B'),
    ];
    const existing = [
      makeExisting('src/a.ts', 1, 'Issue A'),
      makeExisting('src/b.ts', 2, 'Issue B'),
    ];
    expect(deduplicateComments(incoming, existing)).toHaveLength(0);
  });

  it('matches when existing body contains message as substring (e.g. with severity prefix)', () => {
    const msg = 'Missing input validation';
    const incoming = [makeComment('src/api.ts', 5, msg)];
    const existing: ExistingComment[] = [{
      filePath: 'src/api.ts',
      lineNumber: 5,
      body: `**[CRITICAL]** ${msg} — please sanitize all user inputs.`,
    }];
    expect(deduplicateComments(incoming, existing)).toHaveLength(0);
  });
});
