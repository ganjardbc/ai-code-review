# Docker Compose Specification

## Purpose
Expose container deployment layout maps linking services.

## Specifications
* Compose config specifies 3 linked containers:
  * `redis`: runs `redis:7-alpine`, exposing `6379`.
  * `api`: exposes port `3000` executing Fastify.
  * `worker`: runs worker scripts polling the queue.
* API and Worker share a Docker volume mapped to the host's `/tmp/ai-reviewer/workspace` to allow file sandbox read/writes.
