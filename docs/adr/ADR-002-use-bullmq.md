# ADR-002: Use BullMQ and Redis for Job Queuing

## Context
Code review tasks are resource-intensive because they require cloning repositories, generating diffs, making network requests to AI models, and communicating with VCS APIs. If these tasks are processed synchronously within the web server request lifecycle, it will lead to:
1. **Web Server Timeouts**: GitHub/GitLab expect webhooks to respond within a few seconds. Git and AI operations can take much longer.
2. **Resource Exhaustion**: A sudden burst of webhooks could overwhelm the server's CPU and memory if processed concurrently.

We need a persistent, asynchronous queuing system to decouple webhook ingestion from task execution.

## Decision
We will use **BullMQ** backed by **Redis** as the job queue management framework.

## Alternatives Considered
1. **RabbitMQ / SQS**: Traditional message brokers. While powerful, they require additional client libraries, complex setup, and do not offer native Node.js-focused features like job progress tracking, retries, and UI monitoring tools out of the box.
2. **In-Memory Queue (e.g. async.queue)**: Very simple to implement, but lacks persistence. If the server restarts, all queued review jobs are lost.

## Consequences
* **Reliability**: Jobs are persisted in Redis. If a worker crashes midway, the job can be retried automatically.
* **Concurrency Control**: We can limit the number of active workers processing reviews simultaneously, protecting the server from running out of disk space or CPU.
* **Scalability**: Workers can be deployed as standalone processes or containers independent of the Fastify web server, allowing us to scale processing capacity based on queue depth.
* **Operational Overhead**: Requires running a Redis instance, which is easy to set up using Docker Compose.
