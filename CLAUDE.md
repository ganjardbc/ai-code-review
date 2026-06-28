# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (two separate processes required)
pnpm dev           # Fastify web server (port 3000)
pnpm dev:worker    # BullMQ worker — must run alongside server

# Quality
pnpm typecheck     # tsc --noEmit (strict, noUnusedLocals, noUnusedParameters)
pnpm lint          # eslint src --ext .ts
pnpm test          # vitest run (all tests)
pnpm test:watch    # vitest (watch mode)

# Run a single test file
pnpm vitest run tests/unit/parser.service.test.ts

# Build & production
pnpm build         # tsc → dist/
pnpm start         # node dist/presentation/web/server.js
pnpm start:worker  # node dist/worker.js
```

**Requires**: Redis (`REDIS_URL`), copy `.env.example` → `.env` before running.

## Architecture

Two independent Node.js processes share a BullMQ queue via Redis:

```
[GitHub / GitLab webhook] → POST /webhooks/github|gitlab
        ↓
   webhooks.ts (Fastify route)
        ↓  signature verified, payload parsed with Zod
   reviewQueue.addJob()  →  Redis (BullMQ)
        ↓
   QueueWorker (worker.ts process)
        ↓
   ProcessReviewUseCase.execute(JobPayload)
        ↓
   GitService.clone + checkout + generateDiff
        ↓
   PromptService.build(diff)  →  IAiProvider.review(prompt)
        ↓
   ParserService.parse(aiOutput)
        ↓
   GithubService.postReview | GitlabService.postReview
```

### Key contracts

**`JobPayload`** (`domain/interfaces/queue.interface.ts`) is the only data passed between the web process and worker. The worker requires `repoOwner`, `repoName`, `prNumber` for GitHub jobs and `projectId`, `mrIid` for GitLab jobs — these must be populated by the webhook handler.

**`IGithubClient`** / **`IGitlabClient`** (`domain/interfaces/vcs-client.interface.ts`) — the use case depends only on these interfaces. Both are satisfied by singleton instances (`githubService`, `gitlabService`) injected in `worker.ts`.

**`IAiProvider`** (`domain/interfaces/ai-provider.interface.ts`) — two implementations selected by `AI_RUNNER` env var:
- `direct` → `DirectApiRunner` (HTTP to 9Router API, requires `NINE_ROUTER_API_KEY`)
- `opencode` → `OpenCodeRunner` (spawns `opencode run --format json`, parses NDJSON)

### Webhook trigger flows

Two trigger types per platform, both use the same `/webhooks/github` and `/webhooks/gitlab` endpoints:

1. **PR/MR lifecycle** (`pull_request` / `Merge Request Hook`): actions `opened`, `reopened`, `synchronize` / `open`, `reopen`, `update`.
2. **Comment command** (`issue_comment` / `Note Hook`): comment body matching `/^\s*\/review\b/i` on an open PR/MR.

The comment trigger for GitHub requires a `getPullRequest()` API call to fetch branch info (not present in `issue_comment` payload).

### Critical implementation details

- **`rawBody` buffering**: `app.ts` registers a custom JSON content-type parser that stores the raw `Buffer` on `request.rawBody` before parsing. This is required for HMAC signature verification in `verifyGithubSignature`. Do not replace Fastify's body parsing without preserving this.

- **Module format**: TypeScript compiles to ESM (`"module": "Node16"`). All internal imports must use `.js` extensions (e.g., `import ... from './foo.js'`) even though the source files are `.ts`.

- **Branch name safety**: All branch names from webhook payloads must pass `isSafeBranchName()` from `infrastructure/vcs/security.ts` before being used in git shell commands.

- **Diff limits**: `PromptService` filters lock files / binaries and hard-caps the diff at 40 KB before sending to AI. Files are filtered by pattern; context lines are trimmed to 3.

- **AI response format**: Both runners expect the AI to return JSON `{ "comments": [{ "filePath", "lineNumber", "message", "severity" }] }`. `ParserService` handles markdown-wrapped responses and schema validation.

### Test setup

Integration tests (`tests/integration/`) mock `reviewQueue` and the Redis connection — no real Redis needed. Unit tests use `vitest` globals. The mock env is loaded from `tests/mocks/env.ts`.

`tsconfig.json` excludes `tests/` from compilation — test files use `tsx` directly via vitest.
