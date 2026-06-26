# Queue Operations

The AI Code Reviewer uses [BullMQ](https://docs.bullmq.io/) backed by Redis for job queuing. This document covers inspection, management, and tuning of the review job queue.

---

## Queue Name

All review jobs are placed on the queue named `review-queue`. Redis keys are prefixed with `bull:review-queue:`.

---

## Job Lifecycle

```
Webhook received
      │
      ▼
  [waiting]  ── Job sits in Redis until a worker picks it up
      │
      ▼
  [active]   ── Worker has claimed the job and is processing
      │
   ┌──┴──┐
   │     │
   ▼     ▼
[completed] [failed]  ── Terminal states; retained per TTL config
```

| State | Redis Key | Description |
|-------|-----------|-------------|
| `waiting` | `bull:review-queue:wait` | Queued, not yet picked up |
| `active` | `bull:review-queue:active` | Being processed by a worker |
| `completed` | `bull:review-queue:completed` | Finished successfully |
| `failed` | `bull:review-queue:failed` | All retry attempts exhausted |
| `delayed` | `bull:review-queue:delayed` | Scheduled for future processing (retry backoff) |

---

## Configuration

### Job Retention

```dotenv
QUEUE_JOB_TTL_SECONDS=86400       # Keep completed/failed jobs for 24 hours
QUEUE_MAX_JOBS_RETAINED=100       # Maximum number of completed/failed jobs to keep
```

Completed and failed jobs are retained for inspection and debugging. After `QUEUE_JOB_TTL_SECONDS`, they are automatically removed from Redis.

### Worker Concurrency

```dotenv
WORKER_CONCURRENCY=3              # Process up to 3 jobs simultaneously per worker process
```

---

## Inspecting the Queue with redis-cli

```bash
# Connect to Redis
docker compose exec redis redis-cli

# Count jobs in each state
LLEN bull:review-queue:wait
LLEN bull:review-queue:active
ZCARD bull:review-queue:failed
ZCARD bull:review-queue:completed
ZCARD bull:review-queue:delayed

# List waiting job IDs (first 10)
LRANGE bull:review-queue:wait 0 9

# Get a specific job's data (replace <job-id> with actual ID)
HGETALL bull:review-queue:<job-id>
```

### Read a Job's Payload

```bash
# Get job JSON (the review request details)
redis-cli HGET bull:review-queue:1 data
```

---

## BullMQ Dashboard (Bull Board)

For a visual interface, install [Bull Board](https://github.com/felixmosh/bull-board) as a standalone service:

```bash
# Run bull-board as a separate Docker container
docker run -d \
  --name bull-board \
  -p 3001:3000 \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  --network ai-reviewer_default \
  ghcr.io/felixmosh/bull-board:latest
```

Access the dashboard at `http://localhost:3001`. It shows queue stats, job details, and allows retrying failed jobs via the UI.

> **Warning:** Bull Board has no authentication by default. Do not expose it publicly. Use SSH tunneling or restrict access via firewall.

---

## Manual Job Inspection (Command Line)

### List All Failed Jobs

```bash
docker compose exec redis redis-cli \
  ZRANGEBYSCORE "bull:review-queue:failed" -inf +inf WITHSCORES LIMIT 0 20
```

### Retry a Failed Job

BullMQ does not support manual retries via redis-cli directly. Use the Bull Board UI, or write a quick script:

```typescript
import { Queue } from 'bullmq';
import { connection } from './src/infrastructure/queue/connection';

const queue = new Queue('review-queue', { connection });
const job = await queue.getJob('job-id-here');
if (job) await job.retry();
await queue.close();
```

### Remove a Specific Job

```bash
# Get the job score first
docker compose exec redis redis-cli ZSCORE "bull:review-queue:failed" "<job-id>"

# Remove it
docker compose exec redis redis-cli ZREM "bull:review-queue:failed" "<job-id>"
```

---

## Clearing All Failed Jobs

> **Warning:** This permanently deletes job records. You cannot recover them after clearing.

```bash
# Via redis-cli — remove all failed jobs
docker compose exec redis redis-cli DEL "bull:review-queue:failed"
```

Or via a script using the BullMQ API:

```typescript
import { Queue } from 'bullmq';
const queue = new Queue('review-queue', { connection });

// Drain (remove all waiting jobs)
await queue.drain();

// Clean completed jobs older than 1 hour
await queue.clean(3600000, 100, 'completed');

// Clean all failed jobs
await queue.clean(0, 1000, 'failed');

await queue.close();
```

---

## Pausing and Resuming the Queue

To stop processing new jobs without stopping workers (useful during maintenance):

```typescript
const queue = new Queue('review-queue', { connection });
await queue.pause();    // Workers finish active jobs but don't pick up new ones
await queue.resume();   // Resume normal processing
```

---

## Monitoring Queue Health

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Waiting jobs | < 10 | 10–50 | > 50 |
| Active jobs | ≤ `WORKER_CONCURRENCY` | — | Stuck (same jobs active for > 10 min) |
| Failed jobs | 0 | 1–5 | > 5 in 1 hour |
| Queue lag | < 30s | 30s–5min | > 5 min |

Automate these checks by querying Redis and alerting via your monitoring stack.
