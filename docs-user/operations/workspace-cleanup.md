# Workspace Cleanup

Each review job clones a git repository to a temporary directory inside `WORKSPACE_DIR`. This document explains the cleanup lifecycle, how to detect stuck workspaces, and how to perform manual cleanup.

---

## Normal Cleanup Lifecycle

The worker processes each job in a `try/catch/finally` block. Cleanup runs in the `finally` block — it executes regardless of whether the job succeeds or fails:

```
Job starts
│
├─ Create: WORKSPACE_DIR/job-<uuid>/
├─ git clone <repo> into WORKSPACE_DIR/job-<uuid>/
├─ Run review logic
│
└─ finally:
   └─ rm -rf WORKSPACE_DIR/job-<uuid>/   ← Always runs
```

Under normal operation, no workspace directories persist after a job finishes. Each job UUID is unique (generated per webhook event), so no two jobs share a directory.

---

## When Workspaces Can Leak

| Scenario | Leak Risk | Details |
|----------|-----------|---------|
| Worker process killed with `SIGKILL` | Yes | `finally` block does not run |
| Host runs out of disk during clone | Partial | Incomplete clone left on disk |
| Worker container crash (OOM) | Yes | OS reclaims the container's memory, but the workspace volume persists |
| Network volume disconnect mid-clone | Yes | Clone may be incomplete and directory not removed |

Docker Compose uses `SIGTERM` (which triggers graceful shutdown and `finally`) before sending `SIGKILL`. Extend the grace period:

```yaml
services:
  worker:
    stop_grace_period: 120s
```

---

## Checking for Stuck Workspaces

```bash
# List all job directories
ls -la "$WORKSPACE_DIR/"

# How many directories exist?
ls "$WORKSPACE_DIR/" | wc -l

# Which ones are older than 1 hour?
find "$WORKSPACE_DIR" -maxdepth 1 -type d -name "job-*" -mmin +60

# Total disk usage
du -sh "$WORKSPACE_DIR/"

# Largest directories (potential runaway clones)
du -sh "$WORKSPACE_DIR"/job-* 2>/dev/null | sort -rh | head -20
```

A healthy system shows **zero** job directories when no jobs are active. If you see directories during a quiet period (no webhooks received), they are stuck and can be safely removed.

---

## Manual Cleanup

### Remove All Job Directories

> **Warning:** Only do this when no workers are actively processing jobs. Deleting a workspace mid-job will cause the active job to fail with file-not-found errors.

First, verify no jobs are currently active:

```bash
docker compose exec redis redis-cli LLEN "bull:review-queue:active"
# Expected: (integer) 0
```

Then remove all job directories:

```bash
# Remove all job-* directories, keep the workspace root
find "$WORKSPACE_DIR" -maxdepth 1 -type d -name "job-*" -exec rm -rf {} +

# Or using a glob (bash)
rm -rf "$WORKSPACE_DIR"/job-*
```

### Remove Directories Older Than N Hours

Safe to run even when workers are active — only targets old directories:

```bash
# Remove job directories older than 2 hours
find "$WORKSPACE_DIR" -maxdepth 1 -type d -name "job-*" -mmin +120 -exec rm -rf {} +
```

---

## Automated Cleanup Cron Job

Run a periodic cleanup to handle any leaked workspaces:

```bash
# /etc/cron.d/ai-reviewer-cleanup
# Run every hour, remove workspaces older than 2 hours
0 * * * * root find /tmp/ai-reviewer/workspace -maxdepth 1 -type d -name "job-*" -mmin +120 -exec rm -rf {} +
```

For Docker deployments, add the cron job inside the worker container or as a separate `cleanup` service in docker-compose:

```yaml
services:
  cleanup:
    image: alpine:3
    volumes:
      - workspace:/workspace
    entrypoint: crond
    command: -f -d 8
    configs:
      - source: cleanup_crontab
        target: /etc/crontabs/root

configs:
  cleanup_crontab:
    content: |
      0 * * * * find /workspace -maxdepth 1 -type d -name "job-*" -mmin +120 -exec rm -rf {} +
```

---

## Disk Usage Alert Thresholds

| Workspace Size | Action |
|---------------|--------|
| < 1 GB | Normal |
| 1–5 GB | Investigate — possibly slow jobs or high concurrency |
| 5–10 GB | Alert operations; check for stuck workers |
| > 10 GB | Critical; run manual cleanup, check for runaway clones |
| > 80% disk full | Emergency; stop workers immediately to prevent data corruption |

---

## Changing the Workspace Location

The workspace location defaults to `/tmp/ai-reviewer/workspace`. To change it:

```dotenv
WORKSPACE_DIR=/data/ai-reviewer/workspace
```

Ensure the new directory:
1. Exists and is writable by the process user (`appuser` UID 1000 in Docker)
2. Has enough free space for `WORKER_CONCURRENCY × average_repo_size`
3. Is on a fast local disk (NFS mounts add significant latency to git clone)

```bash
# Create directory with correct ownership
sudo mkdir -p /data/ai-reviewer/workspace
sudo chown 1000:1000 /data/ai-reviewer/workspace
```
