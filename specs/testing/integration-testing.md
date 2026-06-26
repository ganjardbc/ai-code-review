# Integration Testing Specification

## Purpose
Expose integration testing requirements and execution boundaries.

## Specifications
* Use `supertest` to trigger Fastify API endpoints.
* Use `ioredis-mock` to test BullMQ operations without requiring a running Redis instance.
* Verify webhook trigger calls properly add jobs to the queue.
* Assert that worker execution loops trigger the use case, process mock files, and output comments correctly.
