# Workspace Manager Specification

## Purpose
Expose secure folder boundaries mapping repository sandbox directories.

## Responsibilities
* Create randomized sandbox directories matching UUID prefixes.
* Delete directories recursively.
* Verify path boundaries to block escapes.

## Dependencies
* External: `fs-extra`, `uuid`.

## Public Interfaces
```typescript
export interface IWorkspaceManager {
  createWorkspace(): Promise<string>;
  cleanupWorkspace(dirPath: string): Promise<void>;
  validatePath(dirPath: string): boolean;
}
```

## Security
* **Path Traversal Prevention**: Verify `dirPath` resides strictly inside the configured `WORKSPACE_DIR` using absolute resolution matches.
  ```typescript
  const resolved = path.resolve(dirPath);
  if (!resolved.startsWith(path.resolve(config.WORKSPACE_DIR))) {
    throw new ValidationError('Workspace path escape attempt detected');
  }
  ```
