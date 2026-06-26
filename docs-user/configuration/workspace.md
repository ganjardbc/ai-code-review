# Workspace Directory

The workspace directory is where the worker clones repositories before analysing them. Each review
job gets its own isolated subdirectory, which is removed when the job finishes (or fails). Nothing
persists between jobs.

---

## WORKSPACE_DIR

| Variable | Default | Required |
|---|---|---|
| `WORKSPACE_DIR` | `/tmp/ai-reviewer/workspace` | No |

Set this to an absolute path with enough free disk space and write permission for the process user
(`appuser` inside Docker, your local user outside it).

```dotenv
WORKSPACE_DIR=/tmp/ai-reviewer/workspace     # development default
WORKSPACE_DIR=/workspace                     # Docker Compose / production
```

---

## Per-Job Subdirectories

Every time the worker picks up a review job, `WorkspaceManager.createWorkspace()` creates a
unique subdirectory:

```
<WORKSPACE_DIR>/job-<uuid>/
```

For example:

```
/workspace/job-3f8a1c2e-7b4d-4e9a-a123-0f1e2d3c4b5a/
  └── repo/          ← git clone lands here
```

The UUID comes from `node:crypto`'s `randomUUID()`, so directory names are globally unique and
never reused.

### Path Validation

Before any cleanup operation, the code resolves the full path with `node:path`'s `resolve()` and
verifies it starts with `WORKSPACE_ROOT + '/'`. Any path that would escape the workspace root
throws a `ValidationError` and the cleanup is aborted:

```
ValidationError: Workspace path escape attempt detected: /etc/passwd
```

This guard prevents a malformed job payload from deleting files outside the designated workspace.

---

## Cleanup Behaviour

Cleanup runs in two places:

### 1. Normal job completion (`src/infrastructure/git/cleanup.ts`)

```
finally block → cleanupWorkspace(jobDir)
```

The `finally` block in the use-case layer ensures the directory is removed whether the job
succeeded or threw an error. The cleanup itself uses `fs/promises.rm({ recursive: true, force: true })`,
which tolerates a directory that was already removed.

If the `rm` call itself fails (e.g. permission error, NFS hiccup), the failure is logged at
`error` level but is **non-fatal** — the job result is not affected:

```
Failed to cleanup workspace (non-fatal) { path: '/workspace/job-abc...' }
```

Orphaned directories from non-fatal cleanup failures should be rare, but monitor disk usage in
production (see [Health Check](#health-check) below).

### 2. On-demand cleanup via `WorkspaceManager`

`WorkspaceManager.cleanupWorkspace()` uses `fs-extra`'s `remove()` for the same effect and is
available to any component that holds a `WorkspaceManager` instance.

---

## Permissions

| Context | Required permission |
|---|---|
| Local development | Write access for your shell user |
| Docker (production) | Directory pre-created and owned by `appuser:appgroup` |
| Kubernetes | `securityContext.runAsUser` must match the mounted volume owner |

Inside the Docker image, the Dockerfile pre-creates `/workspace` and chowns it:

```dockerfile
RUN mkdir -p /workspace && chown appuser:appgroup /workspace
```

The named `workspace` volume in Docker Compose is mounted at this path for both `api` and
`worker` services, so both can read and write job directories.

---

## Disk Space Guidance

A single review job clones one branch of a repository. Disk usage depends entirely on repository
size and the number of concurrent jobs.

Rough estimates:

| Repository size | Clone size (shallow\*) | Max concurrent (default 3) |
|---|---|---|
| Small (<100 files) | ~5 MB | ~15 MB |
| Medium (1 000 files) | ~50 MB | ~150 MB |
| Large (10 000 files) | ~500 MB | ~1.5 GB |

\* The worker performs a full clone, not a shallow clone, so large repositories with deep history
will use more space.

**Recommended minimum:** allocate at least 5 GB for the workspace volume in production. Monitor
free space and alert before it drops below 20%.

### Tuning `WORKER_CONCURRENCY`

Lowering concurrency directly reduces peak disk usage:

```dotenv
WORKER_CONCURRENCY=1    # minimum disk pressure, one job at a time
WORKER_CONCURRENCY=3    # default
WORKER_CONCURRENCY=8    # high throughput; ensure disk headroom
```

---

## Health Check

The `/health` endpoint includes a disk probe that writes and immediately deletes a temporary file
inside `WORKSPACE_DIR`:

```http
GET /health HTTP/1.1
```

```json
{
  "status": "healthy",
  "timestamp": "2026-06-27T10:30:00.000Z",
  "services": {
    "redis": "up",
    "disk": "up"
  }
}
```

`disk: "down"` means the process cannot write to `WORKSPACE_DIR`. Common causes:

- The directory does not exist (mount failed or `WORKSPACE_DIR` typo).
- The volume is full.
- Permission mismatch — the running user cannot write to the path.

The endpoint returns HTTP 503 when any service is `"down"`, which integrates cleanly with Docker
Compose `healthcheck`, Kubernetes liveness probes, and uptime monitors.

---

## Troubleshooting

**"ENOENT: no such file or directory"** at job start
: `WORKSPACE_DIR` does not exist. `WorkspaceManager.createWorkspace()` calls `mkdirSync` with
  `{ recursive: true }`, so the root is created automatically on first use — unless the parent
  path itself is missing or unwritable. Check that the volume mount is active.

**Disk full during clone**
: The `git clone` will fail and the job will be marked as failed in BullMQ. The `finally` block
  still attempts cleanup. Free space and re-queue the job.

**Orphaned `job-*` directories accumulating**
: These are left by non-fatal cleanup failures. Add a cron-based cleanup:

  ```bash
  # Remove job dirs older than 24 hours
  find /workspace -maxdepth 1 -name 'job-*' -type d -mmin +1440 -exec rm -rf {} +
  ```
