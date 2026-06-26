# AI Provider Specification

## Purpose
Define the abstract ports separating domain logic from specific AI clients.

## Public Interfaces
```typescript
export interface AiReviewComment {
  filePath: string;
  lineNumber: number;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface ReviewResult {
  comments: AiReviewComment[];
}

export interface IAiProvider {
  review(prompt: string): Promise<ReviewResult>;
}
```
* Business logic must not import 9Router SDK libraries directly. It imports `IAiProvider`.
