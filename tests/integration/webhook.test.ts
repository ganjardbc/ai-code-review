import '../mocks/env.js';
import { createHmac } from 'node:crypto';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { reviewQueue } from '../../src/infrastructure/queue/client.js';

// Mock queue so no real Redis needed
vi.mock('../../src/infrastructure/queue/client.js', () => ({
  reviewQueue: {
    addJob: vi.fn().mockResolvedValue('mock-job-id'),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Redis connection for health check
vi.mock('../../src/infrastructure/queue/connection.js', () => ({
  getRedisClient: vi.fn(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
  })),
  getRedisConnectionOptions: vi.fn(() => ({})),
  closeRedisConnection: vi.fn().mockResolvedValue(undefined),
}));

import { buildApp } from '../../src/presentation/web/app.js';

const GITHUB_SECRET = 'github-test-secret';
const GITLAB_SECRET = 'gitlab-test-secret';

const GITHUB_PAYLOAD = {
  action: 'opened',
  number: 42,
  pull_request: {
    head: { ref: 'feature-x', sha: 'abc1234567890abcdef' },
    base: { ref: 'main' },
  },
  repository: {
    name: 'myrepo',
    owner: { login: 'myorg' },
    clone_url: 'https://github.com/myorg/myrepo.git',
  },
};

const GITLAB_PAYLOAD = {
  object_kind: 'merge_request',
  object_attributes: {
    action: 'open',
    iid: 5,
    source_branch: 'feature-y',
    target_branch: 'main',
    last_commit: { id: 'def567890abcdef1234' },
    target: { git_http_url: 'https://gitlab.com/myorg/myrepo.git' },
  },
  project: { id: 123 },
};

function githubSig(body: string): string {
  return 'sha256=' + createHmac('sha256', GITHUB_SECRET).update(body).digest('hex');
}

describe('Webhook Integration', () => {
  let app: ReturnType<typeof buildApp>;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('returns 200 with healthy status', async () => {
      const res = await request.get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.services).toHaveProperty('redis');
      expect(res.body.services).toHaveProperty('disk');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('POST /webhooks/github', () => {
    it('returns 202 for valid PR webhook', async () => {
      const body = JSON.stringify(GITHUB_PAYLOAD);
      const res = await request
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', githubSig(body))
        .send(body);

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('enqueued');
      expect(res.body.jobId).toBeDefined();
    });

    it('returns 401 for missing signature', async () => {
      const res = await request
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(GITHUB_PAYLOAD));

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 401 for wrong signature', async () => {
      const res = await request
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', 'sha256=badhex')
        .send(JSON.stringify(GITHUB_PAYLOAD));

      expect(res.status).toBe(401);
    });

    it('returns 200 ignored for non-PR-open actions', async () => {
      const body = JSON.stringify({ ...GITHUB_PAYLOAD, action: 'closed' });
      const res = await request
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', githubSig(body))
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ignored');
    });

    it('returns 400 for invalid payload structure', async () => {
      const body = JSON.stringify({ action: 'opened' });
      const res = await request
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', githubSig(body))
        .send(body);

      expect(res.status).toBe(400);
    });

    it('returns 200 ignored for ping event', async () => {
      const body = JSON.stringify({ zen: 'Non-blocking is better than blocking.' });
      const res = await request
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', githubSig(body))
        .set('X-GitHub-Event', 'ping')
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ignored');
      expect(res.body.reason).toBe('Unsupported event: ping');
    });
  });

  describe('POST /webhooks/gitlab', () => {
    it('returns 202 for valid MR webhook', async () => {
      const res = await request
        .post('/webhooks/gitlab')
        .set('Content-Type', 'application/json')
        .set('X-Gitlab-Token', GITLAB_SECRET)
        .send(JSON.stringify(GITLAB_PAYLOAD));

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('enqueued');
      expect(res.body.jobId).toBeDefined();
    });

    it('returns 401 for wrong token', async () => {
      const res = await request
        .post('/webhooks/gitlab')
        .set('Content-Type', 'application/json')
        .set('X-Gitlab-Token', 'wrongtoken')
        .send(JSON.stringify(GITLAB_PAYLOAD));

      expect(res.status).toBe(401);
    });

    it('returns 401 for missing token', async () => {
      const res = await request
        .post('/webhooks/gitlab')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(GITLAB_PAYLOAD));

      expect(res.status).toBe(401);
    });

    it('returns 200 ignored for non-open MR actions', async () => {
      const payload = {
        ...GITLAB_PAYLOAD,
        object_attributes: { ...GITLAB_PAYLOAD.object_attributes, action: 'close' },
      };
      const res = await request
        .post('/webhooks/gitlab')
        .set('Content-Type', 'application/json')
        .set('X-Gitlab-Token', GITLAB_SECRET)
        .send(JSON.stringify(payload));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ignored');
    });

    it('returns 200 ignored for unsupported system event', async () => {
      const payload = { event_name: 'project_create' };
      const res = await request
        .post('/webhooks/gitlab')
        .set('Content-Type', 'application/json')
        .set('X-Gitlab-Token', GITLAB_SECRET)
        .set('X-Gitlab-Event', 'System Hook')
        .send(JSON.stringify(payload));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ignored');
      expect(res.body.reason).toBe('Unsupported event: System Hook');
    });

    it('enqueues job with baseSha and startSha if diff_refs present', async () => {
      const payload = {
        ...GITLAB_PAYLOAD,
        object_attributes: {
          ...GITLAB_PAYLOAD.object_attributes,
          diff_refs: {
            base_sha: 'base123',
            start_sha: 'start456',
            head_sha: 'head789',
          },
        },
      };
      const res = await request
        .post('/webhooks/gitlab')
        .set('Content-Type', 'application/json')
        .set('X-Gitlab-Token', GITLAB_SECRET)
        .send(JSON.stringify(payload));

      expect(res.status).toBe(202);
      expect(reviewQueue.addJob).toHaveBeenCalledWith(
        'gitlab-review',
        expect.objectContaining({
          baseSha: 'base123',
          startSha: 'start456',
        }),
      );
    });
  });
});
