# Diff Generator Specification

## Purpose
Expose command parsing outputs generating git diff text payload reports.

## Responsibilities
* Query git trees to generate standard diff blocks.
* Return diff text output formatting results.

## Dependencies
* External: `execa`.

## Public Interfaces
```typescript
export interface IDiffGenerator {
  getDiff(workspacePath: string, base: string, head: string): Promise<string>;
}
```
* **Parameters**:
  * `workspacePath`: absolute sandbox directory.
  * `base`: Base target branch (e.g. `origin/main`).
  * `head`: Source development branch (e.g. `origin/feature-auth`).
