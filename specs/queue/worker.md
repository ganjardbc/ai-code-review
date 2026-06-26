# Worker Module Specification

## Purpose
Expose background consumer process loop running enqueued jobs.

## Responsibilities
* Listen to Redis queues.
* Deserialize metadata.
* Handle job execution.

## Dependencies
* External: `bullmq`.
* Internal: `JobRunner`.

## Public Interfaces
```typescript
export class QueueWorker {
  constructor(
    private readonly runner: JobRunner,
    private readonly redisUrl: string
  ) {}

  start(): void;
  stop(): Promise<void>;
}
```

## Security
* Catch errors gracefully within job processors to prevent background runner crashes.
* Graceful signal catching (`SIGINT`, `SIGTERM`) stops dequeuing new tasks and awaits active ones before exiting.
