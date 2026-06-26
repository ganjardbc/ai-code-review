# Testing

The project uses [Vitest](https://vitest.dev/) for all tests and [supertest](https://github.com/ladjs/supertest) for HTTP-level integration tests.

---

## Test Structure

```
tests/
├── unit/
│   ├── application/
│   │   ├── process-review.use-case.test.ts
│   │   ├── parser.service.test.ts
│   │   └── prompt.service.test.ts
│   └── infrastructure/
│       ├── github.service.test.ts
│       └── security.test.ts
├── integration/
│   ├── health.test.ts
│   ├── github-webhook.test.ts
│   └── gitlab-webhook.test.ts
└── fixtures/
    ├── github-pr-opened.json
    ├── gitlab-mr-opened.json
    └── sample.diff
```

Unit tests live alongside the source files they test (or under `tests/unit/`). Integration tests always live under `tests/integration/`.

---

## Running Tests

### Watch Mode (Development)

```bash
pnpm test
```

Vitest runs in watch mode. Tests re-run when source files change.

### Single Run (CI)

```bash
pnpm test --run
```

### With Coverage Report

```bash
pnpm test:coverage
```

Generates a coverage report in `coverage/`. Open `coverage/index.html` to browse results.

Coverage thresholds are defined in `vitest.config.ts`. CI fails if coverage drops below the threshold.

### Run a Specific File

```bash
pnpm test src/application/services/parser.service.test.ts
```

### Run Tests Matching a Name

```bash
pnpm test -t "should parse unified diff"
```

### Verbose Output

```bash
pnpm test --reporter=verbose
```

---

## Unit Tests with Vitest

### Basic Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParserService } from '../../src/application/services/parser.service';

describe('ParserService', () => {
  let parser: ParserService;

  beforeEach(() => {
    parser = new ParserService();
  });

  it('should parse a unified diff into file hunks', () => {
    const diff = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 export { x };`;

    const result = parser.parse(diff);

    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('src/foo.ts');
    expect(result[0].additions).toContain(2);
  });
});
```

### Testing Async Functions

```typescript
it('should process review successfully', async () => {
  // Arrange
  const mockVcsClient = createMockVcsClient();
  const mockAiProvider = createMockAiProvider();
  const useCase = new ProcessReviewUseCase(mockVcsClient, mockAiProvider);

  // Act
  await useCase.execute(reviewJobData);

  // Assert
  expect(mockVcsClient.postReviewComments).toHaveBeenCalledOnce();
});
```

---

## Mocking Interfaces

The Clean Architecture makes mocking straightforward — all external dependencies are accessed through domain interfaces.

### Mocking IVcsClient

```typescript
import { vi } from 'vitest';
import type { IVcsClient } from '../../src/domain/interfaces/IVcsClient';

function createMockVcsClient(): IVcsClient {
  return {
    getDiff: vi.fn().mockResolvedValue('diff content here'),
    postReviewComments: vi.fn().mockResolvedValue(undefined),
    getPullRequestDetails: vi.fn().mockResolvedValue({
      repoUrl: 'https://github.com/org/repo.git',
      baseSha: 'abc123',
      headSha: 'def456',
    }),
  };
}
```

### Mocking IAiProvider

```typescript
import { vi } from 'vitest';
import type { IAiProvider } from '../../src/domain/interfaces/IAiProvider';

function createMockAiProvider(): IAiProvider {
  return {
    review: vi.fn().mockResolvedValue({
      comments: [
        {
          file: 'src/index.ts',
          line: 10,
          severity: 'warning',
          message: 'Consider using const instead of let',
        },
      ],
    }),
  };
}
```

### Asserting Mock Calls

```typescript
it('should call AI provider with the filtered diff', async () => {
  const mockAiProvider = createMockAiProvider();
  const useCase = new ProcessReviewUseCase(mockVcsClient, mockAiProvider);

  await useCase.execute(jobData);

  expect(mockAiProvider.review).toHaveBeenCalledWith(
    expect.stringContaining('src/index.ts'),
  );
  expect(mockAiProvider.review).not.toHaveBeenCalledWith(
    expect.stringContaining('package-lock.json'),
  );
});
```

---

## Integration Tests with supertest

Integration tests start the Fastify app and send real HTTP requests, without needing a running server.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../src/presentation/web/app';
import { createHmacSignature } from '../../src/infrastructure/vcs/security';

describe('POST /webhooks/github', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 202 for a valid pull_request webhook', async () => {
    const payload = JSON.stringify(githubPrOpenedFixture);
    const signature = createHmacSignature(payload, 'test-secret');

    const response = await supertest(app.server)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', `sha256=${signature}`)
      .send(payload);

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ status: 'queued' });
  });

  it('should return 401 for invalid signature', async () => {
    const payload = JSON.stringify(githubPrOpenedFixture);

    const response = await supertest(app.server)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', 'sha256=invalid')
      .send(payload);

    expect(response.status).toBe(401);
  });
});
```

### Test Isolation

Integration tests should not rely on a running Redis instance. Mock the queue service:

```typescript
// In test setup
vi.mock('../../src/infrastructure/queue/client', () => ({
  enqueueReviewJob: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
}));
```

---

## Test Fixtures

Store reusable test data as JSON files in `tests/fixtures/`:

```typescript
import githubPrOpenedFixture from '../fixtures/github-pr-opened.json';
import sampleDiff from '../fixtures/sample.diff?raw';
```

Fixtures should represent real payloads. Capture them from actual webhook deliveries during development.

---

## Vitest Configuration

Key settings in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,          // No need to import describe/it/expect
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
      },
      exclude: [
        'dist/**',
        'tests/**',
        'src/config/**',    // Config is hard to unit test; covered by integration
      ],
    },
  },
});
```
