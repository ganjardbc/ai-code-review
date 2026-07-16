import '../mocks/env.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const graphqlMock = vi.fn();
const createCommentMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    graphql = graphqlMock;
    issues = { createComment: createCommentMock };
    pulls = { get: vi.fn(), createReview: vi.fn() };
  },
}));

const { GithubService } = await import('../../src/infrastructure/vcs/github.service.js');

function page(nodes: unknown[], hasNextPage = false, endCursor: string | null = null) {
  return {
    repository: {
      pullRequest: {
        reviewThreads: {
          pageInfo: { hasNextPage, endCursor },
          nodes,
        },
      },
    },
  };
}

const BOT_BODY = '**[WARNING]** Missing validation\n<!-- ai-code-review:bot -->';

describe('GithubService.listOutstandingBotComments', () => {
  const service = new GithubService();

  beforeEach(() => {
    graphqlMock.mockReset();
  });

  it('returns unresolved bot-marked comments', async () => {
    graphqlMock.mockResolvedValueOnce(
      page([
        {
          isResolved: false,
          comments: { nodes: [{ body: BOT_BODY, path: 'src/auth.ts', line: 10, originalLine: 10 }] },
        },
      ]),
    );

    const result = await service.listOutstandingBotComments('myorg', 'myrepo', 42);
    expect(result).toEqual([{ filePath: 'src/auth.ts', lineNumber: 10, message: BOT_BODY }]);
  });

  it('excludes resolved threads', async () => {
    graphqlMock.mockResolvedValueOnce(
      page([
        {
          isResolved: true,
          comments: { nodes: [{ body: BOT_BODY, path: 'src/auth.ts', line: 10, originalLine: 10 }] },
        },
      ]),
    );

    const result = await service.listOutstandingBotComments('myorg', 'myrepo', 42);
    expect(result).toHaveLength(0);
  });

  it('excludes comments without the bot marker', async () => {
    graphqlMock.mockResolvedValueOnce(
      page([
        {
          isResolved: false,
          comments: { nodes: [{ body: 'a human reply', path: 'src/auth.ts', line: 10, originalLine: 10 }] },
        },
      ]),
    );

    const result = await service.listOutstandingBotComments('myorg', 'myrepo', 42);
    expect(result).toHaveLength(0);
  });

  it('falls back to originalLine when line is null (outdated comment)', async () => {
    graphqlMock.mockResolvedValueOnce(
      page([
        {
          isResolved: false,
          comments: { nodes: [{ body: BOT_BODY, path: 'src/auth.ts', line: null, originalLine: 7 }] },
        },
      ]),
    );

    const result = await service.listOutstandingBotComments('myorg', 'myrepo', 42);
    expect(result).toEqual([{ filePath: 'src/auth.ts', lineNumber: 7, message: BOT_BODY }]);
  });

  it('paginates through multiple pages of review threads', async () => {
    graphqlMock
      .mockResolvedValueOnce(
        page(
          [{ isResolved: false, comments: { nodes: [{ body: BOT_BODY, path: 'a.ts', line: 1, originalLine: 1 }] } }],
          true,
          'cursor-1',
        ),
      )
      .mockResolvedValueOnce(
        page([{ isResolved: false, comments: { nodes: [{ body: BOT_BODY, path: 'b.ts', line: 2, originalLine: 2 }] } }]),
      );

    const result = await service.listOutstandingBotComments('myorg', 'myrepo', 42);
    expect(graphqlMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { filePath: 'a.ts', lineNumber: 1, message: BOT_BODY },
      { filePath: 'b.ts', lineNumber: 2, message: BOT_BODY },
    ]);
  });
});
