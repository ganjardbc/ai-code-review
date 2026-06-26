# Scaling Workers

The AI Code Reviewer separates the API server (webhook ingestion) from the worker (actual review processing). Workers are the compute-intensive part — they clone repos, build diffs, and call the AI provider. Scaling workers independently lets you handle review throughput without over-provisioning the API tier.

---

## Architecture Overview

```
                  ┌─────────────┐
Webhooks ──────► │  API Server  │ ─────► BullMQ Queue (Redis)
                  └─────────────┘               │
                                                 │
                  ┌────────────────────────────────────────┐
                  │              Workers (N processes)       │
                  │  Worker 1 ──────────────────────────    │
                  │  Worker 2 ──────────────────────────    │
                  │  Worker N ──────────────────────────    │
                  └────────────────────────────────────────┘
                                    │
                            Shared Workspace Volume
                            (WORKSPACE_DIR)
```

Redis acts as the coordination layer — all workers consume from the same BullMQ queue. BullMQ handles distributed locking so two workers never process the same job.

---

## Two Dimensions of Scale

| Dimension | Controlled By | Scope |
|-----------|--------------|-------|
| Worker concurrency per process | `WORKER_CONCURRENCY` env var | Per container |
| Number of worker processes | `docker compose --scale` | Cluster level |

### WORKER_CONCURRENCY

Each worker process handles up to `WORKER_CONCURRENCY` jobs simultaneously (default: `3`). Increase this if:
- Jobs are I/O-bound (waiting on AI provider or Git)
- The host has spare CPU and memory
- You observe queue backlog but idle CPU

Decrease this if:
- Jobs are CPU-bound or memory-intensive
- Git clones are hitting disk I/O limits

```dotenv
WORKER_CONCURRENCY=5
```

### Number of Worker Containers

Scale the number of worker containers to distribute load across multiple hosts or cores:

```bash
# Scale to 4 worker containers
docker compose up -d --scale worker=4
```

> **Note:** The `api` service does not need scaling unless you receive extremely high webhook volume. One API instance handles hundreds of webhook requests per minute.

---

## Shared Workspace Volume — Critical Requirement

All worker containers **must share the same workspace volume**. Each job creates a directory at `WORKSPACE_DIR/job-<uuid>`, clones the repository there, and deletes it in a `finally` block after completion.

If workers run on different hosts without a shared filesystem, workspace directories will leak — the container that created the directory cannot clean up after a crash on a different host.

### Docker Compose — Named Volume (Single Host)

```yaml
# docker-compose.yml
volumes:
  workspace:
    driver: local

services:
  api:
    volumes:
      - workspace:/workspace

  worker:
    volumes:
      - workspace:/workspace
    deploy:
      replicas: 4
```

### Multi-Host — NFS or Network Volume

For multi-host deployments, mount the same NFS share or use a cloud storage driver:

```yaml
volumes:
  workspace:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server.internal,rw,nfsvers=4
      device: ":/exports/ai-reviewer-workspace"
```

> **Warning:** NFS adds latency to git clone and file operations. Benchmark with your typical repository size before committing to multi-host worker scaling. For most teams, a single large host with multiple containers is faster and simpler.

---

## Redis as Coordination Point

BullMQ relies on Redis for:

- Job queuing and FIFO ordering
- Distributed locking (preventing duplicate job processing)
- Job state tracking (waiting / active / completed / failed)
- Retry scheduling

Redis is a single point of coordination. For high availability, configure Redis Sentinel or Redis Cluster. However, BullMQ has limited Cluster support — use Sentinel for production HA.

### Redis Sentinel Example (docker-compose addition)

```yaml
services:
  redis-sentinel:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
    volumes:
      - ./redis/sentinel.conf:/etc/redis/sentinel.conf
```

Update `REDIS_URL` to the Sentinel format (requires ioredis Sentinel configuration — see `src/infrastructure/queue/connection.ts`).

---

## Scaling Decision Guide

| Scenario | Action |
|----------|--------|
| Queue backlog, CPU usage low | Increase `WORKER_CONCURRENCY` |
| Queue backlog, CPU saturated | Add worker containers (`--scale worker=N`) |
| Single large repo takes too long | Cannot parallelize a single job; reduce diff size or increase timeout |
| AI provider rate-limiting | Reduce `WORKER_CONCURRENCY` to stay under rate limits |
| Disk full in workspace | Reduce concurrency, add disk, or reduce `QUEUE_MAX_JOBS_RETAINED` |

---

## Monitoring Queue Depth

To check how many jobs are waiting:

```bash
# Connect to Redis and check queue length
docker compose exec redis redis-cli llen "bull:review-queue:wait"
```

Or use a BullMQ dashboard — see [Queue Operations](../operations/queue.md).

---

## Draining Workers Before Shutdown

BullMQ workers wait for in-progress jobs to complete before exiting when they receive `SIGTERM`. Docker Compose sends `SIGTERM` before `SIGKILL`:

```yaml
services:
  worker:
    stop_grace_period: 120s  # Give jobs up to 2 minutes to finish
```

The default Docker stop grace period is 10 seconds — too short for AI review jobs. Set it to at least the expected job duration.
