# Errors Module Specification

## Purpose
Expose a centralized error handling hierarchy to ensure reliable recovery.

## Responsibilities
* Define base application error classes.
* Define error mappings matching standard HTTP statuses.

## Public Interfaces
```typescript
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class UnauthorizedError extends AppError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;
}

export class GitError extends AppError {
  readonly code = 'GIT_ERROR';
  readonly statusCode = 500;
}

export class AiProviderError extends AppError {
  readonly code = 'AI_PROVIDER_ERROR';
  readonly statusCode = 502;
}
```

## Folder Structure
```text
src/domain/errors/
└── app-errors.ts     # Standard error classes definitions
```
