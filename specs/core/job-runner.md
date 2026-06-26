# Job Runner Specification

## Purpose
Expose execution hooks mapping BullMQ worker payloads to `ProcessReviewUseCase`.

## Responsibilities
* Map incoming JSON payload attributes.
* Trigger Use Cases execution.
* Handle job status logging.

## Dependencies
* Internal: `ProcessReviewUseCase`.

## Public Interfaces
```typescript
export class JobRunner {
  constructor(private readonly useCase: ProcessReviewUseCase) {}
  
  run(jobId: string, data: Record<string, any>): Promise<void>;
}
```

## Folder Structure
```text
src/application/services/
└── job-runner.ts     # Maps worker jobs to Use Case executions
```
