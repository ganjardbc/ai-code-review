# Retry Policy

The reviewer uses BullMQ's built-in retry mechanism backed by Redis. This document covers what triggers retries, the backoff strategy, job retention, and how to handle stuck jobs.

---

## BullMQ Retry Configuration

Retry settings are defined in `src/infrastructure/queue/client.ts`:

```typescript
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: {
    age: config.QUEUE_JOB_TTL_SECONDS,   // default: 86400 (24 hours)
    count: config.QUEUE_MAX_JOBS_RETAINED, // default: 100
  },
  removeOnFail: {
    age: config.QUEUE_JOB_TTL_SECONDS,
    count: config.QUEUE_MAX_JOBS_RETAINED,
  },
};
```

| Setting | Value | Meaning |
|---|---|---|
| `attempts` | `3` | Maximum total attempts (1 initial + 2 retries) |
| `backoff.type` | `exponential` | Delay doubles with each retry |
| `backoff.delay` | `5000` ms | Base delay; actual delays: 5 s, 10 s, 20 s |
| `removeOnComplete.age` | 86400 s (24 h) | Completed jobs removed after 24 hours |
| `removeOnComplete.count` | 100 | Keep at most 100 completed jobs |
| `removeOnFail.age` | 86400 s (24 h) | Failed jobs removed after 24 hours |
| `removeOnFail.count` | 100 | Keep at most 100 failed jobs |

### Retry Schedule

| Attempt | When |
|---|---|
| 1 (initial) | Immediately after dequeue |
| 2 (retry 1) | ~5 seconds after attempt 1 fails |
| 3 (retry 2) | ~10 seconds after attempt 2 fails |
| Dead (no more retries) | Moved to BullMQ failed set |

---

## What Causes Retries

A job is retried when the worker function throws any unhandled error. Common causes:

| Failure | Error type | Retriable? |
|---|---|---|
| Git clone timeout or network error | `Error` from `simple-git` | Yes |
| Git clone auth failure (bad token) | `Error` from `simple-git` | Yes (but will keep failing) |
| 9Router rate limit (429) | `AiProviderError` | Yes |
| 9Router gateway error (503) | `AiProviderError` | Yes |
| 9Router authentication failure (401/403) | `AiProviderError` | Yes (but will keep failing) |
| GitHub API error posting review | Error from Octokit | Yes |
| GitLab API error posting discussion | Per-comment; partial failures do not fail the job | Per-comment errors are logged but not thrown |
| Redis connection lost mid-job | BullMQ stalled job detection | Yes (job marked stalled, re-enqueued) |

> **Note:** Authentication failures (wrong API key, expired token) will be retried but will fail on every attempt. Fix the underlying credential issue — do not rely on retries to recover from them.

---

## Stalled Jobs

If a worker process crashes while processing a job, BullMQ's stalled-job detection will eventually re-enqueue the job. The stall detection interval is configured by BullMQ's internal lock duration (default: 30 seconds). Stalled jobs count against the `attempts` limit.

```
Worker stalled job detected → logged as warn: "Job stalled" → re-enqueued
```

---

## Dead Letter Behavior

BullMQ does not have a dedicated dead letter queue. Jobs that exhaust all `attempts` move to the **failed** set in Redis. They remain there until:

- They age out (default: 24 hours after last failure).
- The count exceeds `QUEUE_MAX_JOBS_RETAINED` (oldest failed jobs are pruned first).

Failed jobs are visible in any BullMQ-compatible dashboard (e.g. Bull Board).

---

## Manual Requeue

To manually retry a failed job, use the BullMQ API or a dashboard. From code:

```typescript
import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from './src/infrastructure/queue/connection.js';

const queue = new Queue('review', { connection: getRedisConnectionOptions() });

// Retry a specific failed job by ID
const job = await queue.getJob('<job-id>');
if (job) {
  await job.retry('failed');
}

// Retry ALL failed jobs
const failedJobs = await queue.getFailed();
for (const j of failedJobs) {
  await j.retry('failed');
}

await queue.close();
```

---

## Configuring Retry Behavior

Override the defaults using environment variables:

| Variable | Default | Description |
|---|---|---|
| `QUEUE_JOB_TTL_SECONDS` | `86400` | How long completed and failed jobs are retained in Redis (seconds) |
| `QUEUE_MAX_JOBS_RETAINED` | `100` | Maximum completed/failed jobs retained per state |

To change `attempts` or `backoff`, edit `defaultJobOptions` in `src/infrastructure/queue/client.ts`. There is no environment variable for these in the current MVP.

---

## Monitoring Failed Jobs

Scan for failed jobs via Redis CLI:

```bash
# Connect to Redis
redis-cli -u "$REDIS_URL"

# List keys for the review queue failed set
KEYS bull:review:failed
LRANGE bull:review:failed 0 -1
```

Or filter application logs for failures:

```bash
docker compose logs app worker | grep '"Job failed"'
```

Each failure log includes `jobId`, `name`, `attempts`, and `durationMs`.

---

## Preventing Unnecessary Retries

Some failures should not be retried (e.g. permanently invalid branch names, auth errors). To implement non-retriable errors:

```typescript
import { UnrecoverableError } from 'bullmq';

// Throw this in the worker to skip all remaining retries
throw new UnrecoverableError('Invalid credentials — manual intervention required');
```

This is not implemented in the MVP but is a recommended hardening step.
