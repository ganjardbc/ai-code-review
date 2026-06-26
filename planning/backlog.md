# Prioritized Backlog

This backlog lists the prioritized P0 (critical), P1 (high), P2 (medium), and P3 (low) execution tasks.

| Priority | Task Code | Description | Dependencies | Effort |
|---|---|---|---|---|
| **P0** | Foundation Scaffolding | Initial codebase setup, dependencies, configurations | None | 2h |
| **P0** | Safe Config Parser | Safe parsing using Zod & dotenv | None | 2h |
| **P0** | Pino Logger | Low-overhead structured JSON logger | None | 1.5h |
| **P0** | Fastify Server Setup | Base HTTP application instance configurations | Foundation | 2.5h |
| **P0** | Health endpoint | Basic `/health` endpoint checking server and Redis status | Server | 1.5h |
| **P0** | Webhook Controllers | GitHub and GitLab routes parsing and security signature validators | Server | 5h |
| **P0** | Queue Orchestration | BullMQ queue client setup | Server | 4h |
| **P0** | Worker Process | Background worker execution runner | Queue | 4h |
| **P0** | Git Operations | Sandboxed UUID directory wrapper with command array parameters | Foundation | 6h |
| **P0** | AI Runner | 9Router HTTP Client integrating OpenCode | Foundation | 5h |
| **P0** | JSON Schema Parser | Validation of comments against schemas using Ajv | Foundation | 4h |
| **P0** | Review Orchestrator | Complete application Use Case linking Git, AI, and comment posting | Git, AI, Queue | 8h |
| **P1** | VCS GitHub Adapter | Octokit wrapper posting inline comments | Review Orchestrator | 4h |
| **P1** | VCS GitLab Adapter | Gitbeaker wrapper posting discussions | Review Orchestrator | 4h |
| **P1** | Sandbox Cleanup | Recursive deletion routines in execution blocks | Git Operations | 2.5h |
| **P1** | Token Limit Pruning | Context window constraints logic trimming diff files | AI Runner | 3h |
| **P2** | Dockerization | Dockerfile and Compose setup | Worker, Server | 3.5h |
| **P2** | Redis TTL Eviction | Redis retention settings preventing memory storage leakage | Queue | 2h |
| **P3** | Event Observability | Execution duration tracking and metrics logs | Review Orchestrator | 2.5h |
