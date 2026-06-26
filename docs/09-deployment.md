# Deployment Guide

This document describes how to deploy and scale the AI Code Reviewer platform locally and in production.

---

## Local Development Setup

### Prerequisites
* Node.js v22.x or higher
* pnpm v9.x or higher
* Docker & Docker Compose (for running Redis locally)

### Steps

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-org/ai-code-reviewer.git
   cd ai-code-reviewer
   ```

2. **Install Dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in the values:
   ```bash
   cp .env.example .env
   ```

4. **Start Redis**:
   Run the local Redis container required by BullMQ:
   ```bash
   docker compose up -d redis
   ```

5. **Run the Server in Dev Mode**:
   ```bash
   pnpm run dev
   ```
   The Fastify server starts on `http://localhost:3000`.

---

## Docker Compose Configuration (Self-Hosted Staging/Production)

You can run the entire stack (API and worker) using the following `docker-compose.yml` configuration:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: ai_reviewer_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: always

  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    container_name: ai_reviewer_api
    environment:
      - PORT=3000
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=info
      - WORKSPACE_DIR=/app/workspace
      - NINE_ROUTER_API_KEY=${NINE_ROUTER_API_KEY}
      - GITHUB_ACCESS_TOKEN=${GITHUB_ACCESS_TOKEN}
      - GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - redis
    volumes:
      - workspace_volume:/app/workspace
    restart: always

  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    container_name: ai_reviewer_worker
    command: node dist/worker.js
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=info
      - WORKSPACE_DIR=/app/workspace
      - NINE_ROUTER_API_KEY=${NINE_ROUTER_API_KEY}
      - GITHUB_ACCESS_TOKEN=${GITHUB_ACCESS_TOKEN}
    depends_on:
      - redis
    volumes:
      - workspace_volume:/app/workspace
    restart: always

volumes:
  redis_data:
  workspace_volume:
```

---

## Production Deployment & Scaling

### 1. Scaling the Worker
* **Decoupled API and Worker**: The architecture separates the API listener (webhooks) from the execution worker. If webhook volume is high, scale the `worker` service horizontally by running multiple instances.
  ```bash
  docker compose up -d --scale worker=3
  ```
* **Concurrency**: Set the worker concurrency parameter inside the BullMQ configuration file (e.g., `concurrency: 5` per container) to handle multiple jobs in parallel.

### 2. Redis Configuration
* **Persistence**: Ensure Redis has Append Only File (AOF) enabled (`--appendonly yes`) to prevent loss of queued review requests in case of a crash.
* **Memory Allocation**: Configure `maxmemory-policy noeviction` so Redis rejects new jobs instead of silently discarding existing queued review requests when memory runs low.

### 3. Reverse Proxy & Security
* Place a reverse proxy (e.g., NGINX, Traefik, Caddy) in front of the API containers to handle TLS termination.
* Ensure HTTP request timeout settings on the proxy are at least 10 seconds to accommodate webhook processing, though enqueuing is asynchronous.
