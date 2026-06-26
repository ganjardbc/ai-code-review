# Goal
Package and deploy the application using Docker and Docker Compose.

# Scope
Create production Dockerfiles, Docker Compose configurations linking the API server, worker, and Redis, and verify setup scripts.

# Prerequisites
* Node setup (`000-foundation`).

# Deliverables
* `Dockerfile` multi-stage build.
* `docker-compose.yml` local orchestration.

# Tasks
- [ ] Create `Dockerfile` with multi-stage build:
  * Stage 1: Build dependencies and compile TypeScript to `dist/`.
  * Stage 2: Prune dev dependencies.
  * Stage 3: Runner stage utilizing a lightweight Node.js 22 alpine base image, copying only production code and required assets.
- [ ] Create `docker-compose.yml` containing definitions for:
  * Redis (alpine).
  * API (built from local Dockerfile).
  * Worker (built from local Dockerfile with worker runner commands).
- [ ] Bind volumes for workspace files (`/app/workspace`).
- [ ] Enforce environment configurations pointing to the containers.

# Acceptance Criteria
* Running `docker compose build` succeeds.
* Containers start up and connect correctly without database connection errors.

# Testing Checklist
* **Unit Test**: None.
* **Integration Test**: Check running containers using docker health probes.
* **Manual Test**: Post test webhooks to the dockerized API port and verify reviews run end-to-end.
* **Failure Scenarios**: Check behavior when Redis is unavailable during service start.

# Risks
* Container permission errors. Ensure the runner container utilizes a non-root user account and has write permissions to workspace directories.

# Notes
Ensure configuration variables match staging or production values during deployment.
