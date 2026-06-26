# Production Deployment Specification

## Purpose
Expose scaling and staging configuration guidelines.

## Specifications
* **Worker Scaling**: Scale workers horizontally when webhook volume increases by adding container instances:
  ```bash
  docker compose up -d --scale worker=3
  ```
* **Redis Configurations**: Enforce persistence by enabling append-only flags: `--appendonly yes`. Configure memory limitations with noeviction: `maxmemory-policy noeviction`.
