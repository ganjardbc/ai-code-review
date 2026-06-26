# Git Service Specification

## Purpose
Expose secure, isolated Git commands wrapper.

## Responsibilities
* Run clone, checkout, and diffing commands.
* **Must Not**: Expose shell parser injection targets.

## Dependencies
* External: `execa`.

## Public Interfaces
```typescript
export interface IGitService {
  clone(repoUrl: string, branch: string, targetDir: string): Promise<void>;
  checkout(targetDir: string, commitSha: string): Promise<void>;
  generateDiff(targetDir: string, baseBranch: string, headBranch: string): Promise<string>;
}
```

## Security
* **Command Injection Prevention**: Pass commands strictly as parameter arrays. NEVER use shell string concatenations.
  ```typescript
  // Safe
  await execa('git', ['clone', '--depth=1', '--single-branch', '--branch', branch, repoUrl, targetDir]);
  ```
