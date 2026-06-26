# Contributing

Guide for contributors — including external contributors and team members adding new providers, features, or bug fixes.

---

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Follow the [Local Development](./local-development.md) guide to set up your environment
4. Create a feature branch (see naming conventions below)

---

## Branch Naming

```
feature/<short-description>      # New features
fix/<short-description>          # Bug fixes
chore/<short-description>        # Maintenance, dependency updates, refactors
docs/<short-description>         # Documentation only
```

Examples:
- `feature/bitbucket-provider`
- `fix/workspace-cleanup-race`
- `chore/update-bullmq-v5`
- `docs/add-deployment-guide`

---

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

Types:
- `feat` — new feature
- `fix` — bug fix
- `chore` — maintenance
- `docs` — documentation
- `test` — adding/fixing tests
- `refactor` — refactoring without behavior change
- `perf` — performance improvement

Examples:

```
feat(vcs): add Bitbucket Cloud provider

fix(worker): prevent workspace leak when git clone fails

chore(deps): update bullmq to v5.3.0

test(application): add unit tests for prompt filtering
```

**Breaking changes** — append `!` after the type and add a `BREAKING CHANGE:` footer:

```
feat(config)!: rename REDIS_URL to QUEUE_REDIS_URL

BREAKING CHANGE: The REDIS_URL environment variable has been renamed to
QUEUE_REDIS_URL to better reflect its purpose.
```

---

## PR Requirements

All pull requests must pass these checks before merging:

- [ ] **Tests pass:** `pnpm test --run`
- [ ] **No type errors:** `pnpm typecheck`
- [ ] **No lint errors:** `pnpm lint`
- [ ] **Build succeeds:** `pnpm build`
- [ ] **New code is tested** — unit tests for application/domain logic, integration tests for HTTP routes
- [ ] **CHANGELOG.md updated** if the change is user-visible
- [ ] **Documentation updated** if behavior changes

---

## Adding a New VCS Provider

To add support for a new code hosting platform (e.g., Bitbucket, Azure DevOps, Gitea):

### Step 1: Implement `IVcsClient`

Create `src/infrastructure/vcs/bitbucket.service.ts`:

```typescript
import type { IVcsClient, ReviewComment, PullRequestDetails } from '../../domain/interfaces/IVcsClient';

export class BitbucketService implements IVcsClient {
  constructor(
    private readonly accessToken: string,
    private readonly workspace: string,
  ) {}

  async getPullRequestDetails(payload: unknown): Promise<PullRequestDetails> {
    // Extract repo URL, PR number, head/base SHA from Bitbucket webhook payload
    // Return: { repoUrl, prNumber, headSha, baseSha, targetBranch }
  }

  async getDiff(repoUrl: string, baseSha: string, headSha: string): Promise<string> {
    // Call Bitbucket API to get the diff for this PR
    // Return: unified diff string
  }

  async postReviewComments(prDetails: PullRequestDetails, comments: ReviewComment[]): Promise<void> {
    // Call Bitbucket API to post inline comments on the PR
  }
}
```

### Step 2: Add Webhook Secret Verification

In `src/infrastructure/vcs/security.ts`, add a function to verify Bitbucket's webhook signature format.

### Step 3: Add the Route

Create `src/presentation/web/routes/bitbucket.route.ts`:

```typescript
import type { FastifyInstance } from 'fastify';

export async function bitbucketRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/webhooks/bitbucket', {
    config: { rawBody: true },
  }, async (request, reply) => {
    // 1. Verify signature
    // 2. Parse payload DTO
    // 3. Enqueue review job
    // 4. Return 202
  });
}
```

### Step 4: Register the Route

In `src/presentation/web/app.ts`:

```typescript
import { bitbucketRoutes } from './routes/bitbucket.route';
fastify.register(bitbucketRoutes);
```

### Step 5: Add Config

In `src/config/schema.ts`, add:

```typescript
BITBUCKET_WEBHOOK_SECRET: z.string().min(1),
BITBUCKET_ACCESS_TOKEN: z.string().min(1),
BITBUCKET_WORKSPACE: z.string().min(1),
```

### Step 6: Write Tests

- Unit test: `tests/unit/infrastructure/bitbucket.service.test.ts`
- Integration test: `tests/integration/bitbucket-webhook.test.ts`

### Step 7: Document

Update [Webhook Reference](../reference/webhook-reference.md) and [Environment Reference](../reference/environment-reference.md).

---

## Adding a New AI Provider

To add support for a different AI provider (e.g., direct OpenAI, Anthropic, local Ollama):

### Step 1: Implement `IAiProvider`

Create `src/infrastructure/ai/openai.service.ts`:

```typescript
import type { IAiProvider, ReviewResult } from '../../domain/interfaces/IAiProvider';

export class OpenAIService implements IAiProvider {
  constructor(private readonly apiKey: string) {}

  async review(prompt: string, diff: string): Promise<ReviewResult> {
    // Call OpenAI API
    // Parse response
    // Return: { comments: [...] }
  }
}
```

### Step 2: Wire It Up

In the worker's dependency injection (typically in `src/worker.ts` or wherever the use case is constructed), instantiate the new provider and inject it:

```typescript
const aiProvider = new OpenAIService(config.openaiApiKey);
const useCase = new ProcessReviewUseCase(vcsClient, aiProvider, ...);
```

### Step 3: Add Config

Add `OPENAI_API_KEY` to `src/config/schema.ts`.

---

## Review Process

- **Small PRs** (< 200 lines): 1 reviewer approval required
- **Large PRs** (> 200 lines): 2 reviewer approvals required
- **Breaking changes**: Must be discussed in an issue before implementation
- **New providers**: Need a demonstration that the integration works with a real test repo

Reviewers check for:
1. Clean Architecture layer violations
2. Missing error handling
3. Missing tests
4. Security issues (shell injection, secret leakage in logs)
5. Performance impact on the hot path (webhook → enqueue)
