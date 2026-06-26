# Queue Module Specification

## Purpose
Expose asynchronous task queuing backend using Redis and BullMQ.

## Responsibilities
* Persist jobs metadata in Redis.
* Configure auto-eviction policies.

## Dependencies
* External: `bullmq`, `ioredis`.

## Public Interfaces
```typescript
export interface IQueue {
  addJob(name: string, data: Record<string, any>): Promise<string>;
  close(): Promise<void>;
}
```

## Configuration
* Enforce job cleanup options when adding items:
  ```typescript
  {
    removeOnComplete: { age: config.QUEUE_JOB_TTL_SECONDS, count: config.QUEUE_MAX_JOBS_RETAINED },
    removeOnFail: { age: config.QUEUE_JOB_TTL_SECONDS, count: config.QUEUE_MAX_JOBS_RETAINED }
  }
  ```
