# Filesystem Specification

## Purpose
Document filesystem operations and safety rules.

## Specifications
* Use Node's native `fs/promises` interface to read/write files.
* **Sandbox Directory Isolation**: Files are cloned inside `<WORKSPACE_DIR>/job-<uuid-v4>`.
* Workspace paths must be validated using path checks before execution to prevent Path Traversal escapes:
  ```typescript
  const resolvedPath = path.resolve(dirPath);
  if (!resolvedPath.startsWith(path.resolve(config.WORKSPACE_DIR))) {
    throw new Error("Target folder lies outside of workspace boundaries");
  }
  ```
