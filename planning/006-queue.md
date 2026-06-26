# Goal
Implement BullMQ queues to handle incoming code review tasks.

# Scope
Create the Redis connection manager and initialize the BullMQ queue instance with retention limits.

# Prerequisites
* Config loader (`001-configuration`).
* Logger setup (`002-logging`).

# Deliverables
* `src/infrastructure/queue/client.ts` defining connection and queues.

# Tasks
- [ ] Install packages: `pnpm add bullmq ioredis`
- [ ] Implement Redis connection client helper inside `src/infrastructure/queue/client.ts`.
- [ ] Create `ReviewQueue` class wrapper.
- [ ] Configure BullMQ job options using environment configuration variables:
  * Configure `removeOnComplete` and `removeOnFail` retention options using `QUEUE_JOB_TTL_SECONDS` and `QUEUE_MAX_JOBS_RETAINED`.
- [ ] Expose an `addJob()` function to push standardized VCS payloads.

# Acceptance Criteria
* Review jobs are added to the Redis queue.
* Completed/failed job logs do not exceed `QUEUE_MAX_JOBS_RETAINED` limits in Redis memory.

# Testing Checklist
* **Unit Test**: Test `addJob()` pushes values correctly to mocked BullMQ instance.
* **Integration Test**: Connect to local Redis, push a job, and assert job properties in Redis.
* **Manual Test**: None.
* **Failure Scenarios**: Check that queue commands fail if the Redis service is down.

# Risks
* Redis memory leak. Keep retention limits low.

# Notes
Ensure the Redis client configuration uses robust reconnect options.
