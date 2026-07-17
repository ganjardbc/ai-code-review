import '../mocks/env.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramNotifier } from '../../src/infrastructure/notifications/telegram.notifier.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const okResponse = () =>
  Promise.resolve({ ok: true, status: 200, text: async () => '' } as Response);

const errResponse = (status: number, body: string) =>
  Promise.resolve({ ok: false, status, text: async () => body } as Response);

describe('TelegramNotifier', () => {
  const notifier = new TelegramNotifier('test-token', '12345');

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends correct payload on notifyReviewComplete', async () => {
    mockFetch.mockReturnValueOnce(okResponse());
    await notifier.notifyReviewComplete({
      jobId: 'j1',
      provider: 'github',
      repoLabel: 'owner/repo',
      prNumber: 42,
      commentCount: 3,
      durationMs: 5000,
      prUrl: 'https://github.com/owner/repo/pull/42',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bottest-token/sendMessage');
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body['chat_id']).toBe('12345');
    expect(body['parse_mode']).toBe('HTML');
    expect(typeof body['text']).toBe('string');
    expect(body['text']).toContain('owner/repo #42');
    expect(body['text']).toContain('3 comments');
    expect(body['text']).toContain('https://github.com/owner/repo/pull/42');
  });

  it('sends correct payload on notifyReviewFailed', async () => {
    mockFetch.mockReturnValueOnce(okResponse());
    await notifier.notifyReviewFailed({
      jobId: 'j2',
      provider: 'gitlab',
      repoLabel: 'group/project',
      prNumber: 7,
      errorMessage: 'clone failed',
    });

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string) as Record<string, unknown>;
    expect(body['text']).toContain('group/project #7');
    expect(body['text']).toContain('clone failed');
    expect(body['text']).toContain('❌');
  });

  it('pluralises comment count correctly', async () => {
    mockFetch.mockReturnValueOnce(okResponse());
    await notifier.notifyReviewComplete({
      jobId: 'j3',
      provider: 'github',
      repoLabel: 'a/b',
      prNumber: 1,
      commentCount: 1,
      durationMs: 1000,
    });
    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string) as Record<string, unknown>;
    expect(body['text']).toContain('1 comment posted');
  });

  it('does not throw on Telegram API error', async () => {
    mockFetch.mockReturnValueOnce(errResponse(400, '{"error":"bad request"}'));
    await expect(
      notifier.notifyReviewComplete({
        jobId: 'j4',
        provider: 'github',
        repoLabel: 'a/b',
        prNumber: 1,
        commentCount: 0,
        durationMs: 100,
      }),
    ).resolves.toBeUndefined();
  });

  it('escapes HTML special chars in user-provided fields', async () => {
    mockFetch.mockReturnValueOnce(okResponse());
    await notifier.notifyReviewComplete({
      jobId: 'j5',
      provider: 'github',
      repoLabel: 'my_org/feature_branch',
      prNumber: 99,
      commentCount: 2,
      durationMs: 3000,
    });
    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string) as Record<string, unknown>;
    expect(body['text']).toContain('my_org/feature_branch #99');
  });

  it('does not throw on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network failure'));
    await expect(
      notifier.notifyReviewFailed({
        jobId: 'j5',
        provider: 'github',
        repoLabel: 'a/b',
        prNumber: 1,
        errorMessage: 'oops',
      }),
    ).resolves.toBeUndefined();
  });

  it('sends correct payload on notifyFixComplete', async () => {
    mockFetch.mockReturnValueOnce(okResponse());
    await notifier.notifyFixComplete({
      jobId: 'f1',
      provider: 'github',
      repoLabel: 'owner/repo',
      prNumber: 42,
      filesFixed: 2,
      durationMs: 4200,
      prUrl: 'https://github.com/owner/repo/pull/42',
    });

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string) as Record<string, unknown>;
    expect(body['text']).toContain('owner/repo #42');
    expect(body['text']).toContain('2 files fixed');
    expect(body['text']).toContain('https://github.com/owner/repo/pull/42');
  });

  it('pluralises fixed file count correctly', async () => {
    mockFetch.mockReturnValueOnce(okResponse());
    await notifier.notifyFixComplete({
      jobId: 'f2',
      provider: 'gitlab',
      repoLabel: 'group/project',
      prNumber: 3,
      filesFixed: 1,
      durationMs: 1000,
    });
    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string) as Record<string, unknown>;
    expect(body['text']).toContain('1 file fixed');
  });

  it('sends correct payload on notifyFixFailed', async () => {
    mockFetch.mockReturnValueOnce(okResponse());
    await notifier.notifyFixFailed({
      jobId: 'f3',
      provider: 'gitlab',
      repoLabel: 'group/project',
      prNumber: 7,
      errorMessage: 'push rejected',
    });

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string) as Record<string, unknown>;
    expect(body['text']).toContain('group/project #7');
    expect(body['text']).toContain('push rejected');
    expect(body['text']).toContain('❌');
  });
});
