# Dockerfile

The `Dockerfile` uses a three-stage build to produce a minimal, non-root production image. Each
stage has a single responsibility; only the final stage is used at runtime.

---

## Stage Overview

```
Stage 1: builder   — install all deps, compile TypeScript → dist/
Stage 2: pruner    — install production-only deps (no devDependencies)
Stage 3: runner    — copy dist/ + node_modules, create non-root user, run
```

The final image contains no compiler, no source files, no devDependencies, and no pnpm binary.

---

## Stage 1 — builder

```dockerfile
FROM node:22-alpine AS builder

RUN npm install -g pnpm@9

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm build
```

**What happens:**

1. Installs pnpm 9 globally (matches the project's engine requirement).
2. Copies only the package manifest and lockfile first so the `pnpm install` layer is cached
   independently of source changes.
3. Runs `pnpm install --frozen-lockfile` — fails the build if `pnpm-lock.yaml` is out of sync
   with `package.json`.
4. Copies source and compiles via `tsc`, producing `dist/`.

**Cache behaviour:** As long as `package.json` and `pnpm-lock.yaml` do not change, the install
step is served from the Docker layer cache even after source edits. Only the `COPY src/` and
`RUN pnpm build` layers are invalidated on a typical code change.

---

## Stage 2 — pruner

```dockerfile
FROM node:22-alpine AS pruner

RUN npm install -g pnpm@9

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
```

**What happens:**

Installs only production dependencies (`--prod` excludes `devDependencies`). This layer is
copied into the runner stage, keeping devDependencies out of the final image.

Separated into its own stage rather than running `pnpm prune --prod` after a full install
because pruning can leave behind hoisting artifacts. A fresh `--prod` install is cleaner and
more predictable.

---

## Stage 3 — runner

```dockerfile
FROM node:22-alpine AS runner

RUN apk add --no-cache git

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=pruner --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --chown=appuser:appgroup package.json ./

RUN mkdir -p /workspace && chown appuser:appgroup /workspace

USER appuser

ENV NODE_ENV=production
ENV WORKSPACE_DIR=/workspace

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
```

**What happens:**

| Step | Reason |
|---|---|
| `apk add git` | `simple-git` shells out to the system `git` binary |
| `addgroup / adduser -S` | Creates a system (no-login) user and group; no home directory, no password |
| `COPY --from=pruner` | Brings in production `node_modules` with correct ownership |
| `COPY --from=builder` | Brings in compiled `dist/` |
| `mkdir /workspace && chown` | Pre-creates the workspace root with correct ownership before `USER appuser` |
| `USER appuser` | All subsequent instructions and the container process run as non-root |
| `ENV NODE_ENV=production` | Activates JSON logging, disables pino-pretty |
| `ENV WORKSPACE_DIR=/workspace` | Matches the Docker Compose volume mount |
| `EXPOSE 3000` | Documents the port; does not publish it (publishing is done in `docker-compose.yml` or `docker run -p`) |
| `HEALTHCHECK` | Docker daemon marks the container unhealthy if `/health` fails three times |

---

## Non-Root Security

The container runs as `appuser` (UID allocated by Alpine's `adduser -S`). This means:

- The process cannot write to `/app` (owned by root; no world-write).
- The process can only write to `/workspace` (pre-chowned to `appuser`).
- A container escape does not automatically grant root on the host.

Do not add `--privileged` or `--cap-add` to these containers. They require no elevated
capabilities.

---

## Build Targets

The Dockerfile uses named targets. You can stop the build at any stage:

```bash
# Build the full production image (runner stage)
docker build -t ai-code-reviewer:latest .

# Build only the compiler output (useful for CI artefact extraction)
docker build --target builder -t ai-code-reviewer:builder .

# Inspect production node_modules without the app code
docker build --target pruner -t ai-code-reviewer:pruner .
```

---

## Building Manually

```bash
# Standard build
docker build -t ai-code-reviewer:0.1.0 .

# Tag for a registry
docker build -t ghcr.io/your-org/ai-code-reviewer:0.1.0 .
docker push ghcr.io/your-org/ai-code-reviewer:0.1.0
```

Pass `--platform` when building on Apple Silicon for a Linux/amd64 target:

```bash
docker build --platform linux/amd64 -t ai-code-reviewer:0.1.0 .
```

---

## Environment Injection

The Docker image bakes in two environment variables (`NODE_ENV=production`,
`WORKSPACE_DIR=/workspace`). All other configuration must be injected at runtime:

```bash
# docker run example
docker run \
  -p 3000:3000 \
  --env-file .env \
  -e REDIS_URL=redis://redis:6379 \
  -v workspace:/workspace \
  ai-code-reviewer:0.1.0 \
  node dist/presentation/web/server.js
```

Never bake secret values into the image with `ENV` directives — they appear in plain text in
`docker inspect` and in any image layer history.

---

## Image Size

Expected layer sizes (approximate):

| Layer | Size |
|---|---|
| `node:22-alpine` base | ~50 MB |
| `git` package | ~8 MB |
| `node_modules` (prod only) | ~80–120 MB |
| `dist/` (compiled app) | ~500 KB |
| **Total** | **~160–180 MB** |

Compare to a non-multistage build that would include devDependencies (~400+ MB).
