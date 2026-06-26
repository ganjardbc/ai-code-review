# Docker Compose

`docker-compose.yml` defines three services — `redis`, `api`, and `worker` — plus two named
volumes. It is the fastest way to run the full stack locally or on a single-host deployment.

---

## Full File Walkthrough

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    command: node dist/presentation/web/server.js
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - WORKSPACE_DIR=/workspace
    volumes:
      - workspace:/workspace
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      start_period: 15s
      retries: 3

  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    command: node dist/worker.js
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - WORKSPACE_DIR=/workspace
      - WORKER_CONCURRENCY=3
    volumes:
      - workspace:/workspace
    depends_on:
      redis:
        condition: service_healthy

volumes:
  redis_data:
  workspace:
```

---

## Service Descriptions

### redis

| Property | Value | Notes |
|---|---|---|
| Image | `redis:7-alpine` | Minimal Alpine-based Redis 7 image |
| Restart policy | `unless-stopped` | Survives Docker daemon restarts; manual `stop` is respected |
| Memory limit | `256 MB` | Set via `--maxmemory 256mb` in the server command |
| Eviction policy | `allkeys-lru` | Suitable for development; use `noeviction` in production |
| Port | `6379:6379` | Exposes Redis to the host; remove this mapping in production |
| Volume | `redis_data:/data` | Persists RDB snapshots across container restarts |
| Health check | `redis-cli ping` | Checked every 10 s; `api` and `worker` wait for `healthy` |

### api

Runs the Fastify web server. Receives webhook payloads from GitHub / GitLab, validates HMAC
signatures, and enqueues review jobs into BullMQ.

| Property | Value | Notes |
|---|---|---|
| Build target | `runner` | Uses the final stage of the multistage Dockerfile |
| Command | `node dist/presentation/web/server.js` | Compiled entry point |
| Port | `${PORT:-3000}:3000` | Uses `PORT` from `.env`, defaulting to `3000` |
| `depends_on` | `redis: condition: service_healthy` | Does not start until Redis responds to `PING` |
| Health check | `wget /health` | Returns 200 when Redis and disk are both reachable |

### worker

Consumes BullMQ jobs from Redis. Clones repositories, runs AI review, and posts comments back to
GitHub / GitLab.

| Property | Value | Notes |
|---|---|---|
| Build target | `runner` | Same image as `api` |
| Command | `node dist/worker.js` | Worker entry point |
| No exposed ports | — | Workers have no HTTP surface |
| `WORKER_CONCURRENCY` | `3` | Set in the `environment` block, can be overridden |

---

## Shared Volume: workspace

Both `api` and `worker` mount the `workspace` named volume at `/workspace`. The `api` service
does not write to the workspace today, but the shared mount ensures future use cases (e.g. a
status endpoint that inspects active clones) work without configuration changes.

The volume is managed by Docker and survives `docker compose stop`. It is removed only with:

```bash
docker compose down -v
```

---

## env_file vs environment Precedence

Both `api` and `worker` use `env_file: .env` **and** an `environment` block. Docker Compose
applies them in this order — later entries win:

1. Values from `env_file` (`.env` file on disk)
2. Values from `environment` block in `docker-compose.yml`
3. Values from the shell environment at the time `docker compose up` runs

The `environment` block always overrides `.env` for the three keys it sets:

```yaml
environment:
  - NODE_ENV=production          # overrides NODE_ENV=development from .env
  - REDIS_URL=redis://redis:6379 # overrides any REDIS_URL in .env
  - WORKSPACE_DIR=/workspace     # overrides the default /tmp path from .env
```

This means you can keep `NODE_ENV=development` and `REDIS_URL=redis://localhost:6379` in your
`.env` for local development without Compose, while Compose automatically applies the correct
production values when running the stack.

---

## Health Checks

### redis health check

```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 3s
  retries: 5
```

Docker checks every 10 seconds. After 5 consecutive failures the container is marked `unhealthy`
and dependent services (`api`, `worker`) will not start.

### api health check

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
  interval: 30s
  timeout: 5s
  start_period: 15s
  retries: 3
```

`start_period: 15s` gives the Node.js process time to load modules and connect to Redis before
health checks begin. The `/health` endpoint checks both Redis and disk, so a healthy `api`
container implies the full data path is functional.

The `worker` service has no health check because it has no HTTP interface. Monitor it via BullMQ
metrics or log-based alerting on `"Worker stopped"` messages.

---

## Scaling the Worker

Run multiple worker replicas to increase job throughput:

```bash
docker compose up --scale worker=3
```

Each replica reads `WORKER_CONCURRENCY` (default `3`), so three replicas yield up to 9 parallel
review jobs. All replicas share the same `workspace` volume and the same Redis queue — BullMQ
handles job distribution automatically.

> **Note:** Scaling `api` with `--scale api=N` requires a load balancer in front of the exposed
> port since only one container can bind `host:3000`. Use a reverse proxy (nginx, Caddy, Traefik)
> and remove the `ports` mapping from the `api` service in favour of a proxy network.

---

## Common Commands

```bash
# Build images and start all services in the background
docker compose up --build -d

# Stream logs from all services
docker compose logs -f

# Stream logs from a specific service
docker compose logs -f worker

# Check service health status
docker compose ps

# Restart a single service (e.g. after a config change)
docker compose restart worker

# Stop all services (volumes preserved)
docker compose stop

# Stop and remove containers (volumes preserved)
docker compose down

# Stop, remove containers AND volumes (destructive — loses Redis data and workspace)
docker compose down -v

# Run a one-off command inside the api container
docker compose run --rm api node dist/presentation/web/server.js --version

# Open a shell in the running api container
docker compose exec api sh
```

---

## Overriding with docker-compose.override.yml

For local development overrides (e.g. mounting source for live reload, enabling debug ports),
create a `docker-compose.override.yml` alongside the main file. Compose merges it automatically:

```yaml
# docker-compose.override.yml (not committed)
services:
  api:
    command: npx tsx src/presentation/web/server.ts
    volumes:
      - ./src:/app/src:ro
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
```

This avoids modifying the canonical `docker-compose.yml`.
