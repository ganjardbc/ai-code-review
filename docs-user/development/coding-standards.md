# Coding Standards

Standards and patterns enforced in this codebase. All contributions must follow these rules.

---

## Clean Architecture Rules

### No Cross-Layer Imports

The most important rule: **dependencies flow inward only**.

```
presentation → application → domain
infrastructure → domain
```

| Allowed | Not Allowed |
|---------|------------|
| `presentation` imports from `application` | `application` imports from `infrastructure` |
| `application` imports from `domain` | `domain` imports from anything |
| `infrastructure` imports from `domain` | `presentation` imports from `infrastructure` directly |

**Good:**

```typescript
// In process-review.use-case.ts (application layer)
import { IVcsClient } from '../../domain/interfaces/IVcsClient';
import { IAiProvider } from '../../domain/interfaces/IAiProvider';
```

**Bad:**

```typescript
// In process-review.use-case.ts (application layer)
// ❌ Direct import of infrastructure implementation
import { GithubService } from '../../infrastructure/vcs/github.service';
```

### Interface-First Design

Define the interface in `src/domain/interfaces/` before writing the implementation. The use case must only depend on the interface, not the concrete class.

```typescript
// ✅ Correct — use case depends on interface
export class ProcessReviewUseCase {
  constructor(
    private readonly vcsClient: IVcsClient,
    private readonly aiProvider: IAiProvider,
  ) {}
}
```

---

## TypeScript

### Strict Mode

`tsconfig.json` enforces TypeScript strict mode. This means:
- `strictNullChecks: true` — you must handle `null` and `undefined` explicitly
- `noImplicitAny: true` — all variables and parameters must have types
- `strictFunctionTypes: true` — stricter function type compatibility

Do not disable strict checks with `@ts-ignore` or `as any` without a compelling reason and a code comment explaining why.

### Type Assertions

Avoid `as` type assertions. If you need one, add a comment explaining why the runtime type is guaranteed:

```typescript
// ❌ Avoid
const value = someData as string;

// ✅ Prefer
if (typeof someData !== 'string') {
  throw new Error('Expected string');
}
const value: string = someData;
```

### Return Types on Public Functions

Always declare return types on exported functions and class methods:

```typescript
// ✅ Correct
export async function processReview(jobData: ReviewJobData): Promise<void> {
  // ...
}

// ❌ Avoid — return type inferred, fragile
export async function processReview(jobData: ReviewJobData) {
  // ...
}
```

---

## Environment Variable Access

**No `process.env` outside `src/config/`.**

All environment variables are read in `src/config/index.ts` and validated with Zod. Other files receive config values through dependency injection or function parameters.

```typescript
// ❌ Forbidden — reading process.env outside config/
const redisUrl = process.env.REDIS_URL;

// ✅ Correct — import from config
import { config } from '../../config';
const redisUrl = config.redisUrl;
```

Benefits:
- Single source of truth for env var names
- Validation at startup (fail fast on bad config)
- Easy to mock in tests

---

## Error Handling

### Never Swallow Errors Silently

```typescript
// ❌ Bad — error is lost
try {
  await doSomething();
} catch (_err) {
  // silently ignored
}

// ✅ Good — log and either rethrow or handle explicitly
try {
  await doSomething();
} catch (err) {
  logger.error({ err }, 'Failed to do something');
  throw err;  // or handle the specific error type
}
```

### Use Specific Error Types

Wrap external errors with context:

```typescript
try {
  await gitClone(repoUrl, targetDir);
} catch (err) {
  throw new Error(`Git clone failed for ${repoUrl}: ${err instanceof Error ? err.message : String(err)}`);
}
```

### Error in Job Processing

Jobs must not throw synchronously from the outer BullMQ handler without being caught. Use try/catch/finally in every job processor:

```typescript
async function processJob(job: Job<ReviewJobData>): Promise<void> {
  const workspaceDir = await workspaceManager.create(job.id);
  try {
    await runReview(job.data, workspaceDir);
  } catch (err) {
    logger.error({ err, jobId: job.id }, 'Review job failed');
    throw err;  // Re-throw so BullMQ marks the job as failed
  } finally {
    await cleanup(workspaceDir);  // Always runs
  }
}
```

---

## No Shell String Concatenation for Git

Never build shell command strings with user-supplied data. Always use array arguments:

```typescript
// ❌ Security risk — command injection
execSync(`git clone ${repoUrl} ${targetDir}`);

// ✅ Safe — array form prevents injection
execa('git', ['clone', repoUrl, targetDir]);
```

The git service uses `execa` (or Node.js `child_process.spawn`) with array arguments for all subprocess calls.

---

## Logging

Use the injected logger — never `console.log`:

```typescript
// ❌ Avoid
console.log('Processing job', jobId);

// ✅ Use the logger
logger.info({ jobId }, 'Processing job');
```

Structured logging: put data in the first object argument, message as the second string.

Log levels:
- `trace` — detailed internals, only for debugging specific flows
- `debug` — useful dev info (payload sizes, filter decisions)
- `info` — normal operational events (job started, job completed)
- `warn` — recoverable issues (comment posting failed on one file, retrying)
- `error` — failures that affect a request or job

---

## Immutability

Prefer `const` over `let`. Avoid mutating objects directly; return new objects instead:

```typescript
// ❌ Mutation
const config = getConfig();
config.logLevel = 'debug';

// ✅ New object
const config = { ...getConfig(), logLevel: 'debug' };
```

---

## File and Module Naming

| Pattern | Convention |
|---------|-----------|
| Service files | `kebab-case.service.ts` |
| Use case files | `kebab-case.use-case.ts` |
| Interface files | `IPascalCase.ts` |
| Route files | `kebab-case.route.ts` |
| DTO files | `kebab-case.dto.ts` |
| Test files | `filename.test.ts` (co-located) or under `tests/` |

---

## Code Review Checklist

Before submitting a PR, verify:

- [ ] No `process.env` outside `src/config/`
- [ ] No cross-layer imports
- [ ] All public functions have explicit return types
- [ ] No `console.log` — use logger
- [ ] No `as any` or `@ts-ignore` without a comment
- [ ] Error handling in all async functions
- [ ] `finally` block for workspace cleanup
- [ ] Shell commands use array arguments, not string interpolation
- [ ] Tests pass: `pnpm test --run`
- [ ] No type errors: `pnpm typecheck`
- [ ] No lint errors: `pnpm lint`
