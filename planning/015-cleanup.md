# Goal
Implement filesystem cleanup managers to prevent disk storage leaks.

# Scope
Create the directory clean utilities to recursively delete workspace job subdirectories.

# Prerequisites
* Node setup (`000-foundation`).
* Config loader (`001-configuration`).

# Deliverables
* `src/infrastructure/git/cleanup.ts` helper module.

# Tasks
- [ ] Create workspace path validator verifying paths are subdirectories of `WORKSPACE_DIR` to prevent path traversal attempts.
- [ ] Implement recursive directory deletion using node native `fs.promises.rm`.
- [ ] Incorporate cleanup steps in all finally execution blocks inside worker execution pipelines.
- [ ] Log details of cleared directories and caught errors.

# Acceptance Criteria
* Deleted paths are verified as children of the root workspace directory.
* Sandboxed workspace directories are deleted after reviews.
* Errors during deletion (e.g. locked files) do not crash the worker thread.

# Testing Checklist
* **Unit Test**: Test validator rejects paths escaping workspace directory (e.g., `/tmp/workspace/../../etc`).
* **Integration Test**: Create dummy workspace subdirectory, run cleanup utility, and assert folder is deleted.
* **Manual Test**: None.
* **Failure Scenarios**: Check behavior when target cleanup path does not exist.

# Risks
* Accidental recursive deletion of root directories. Ensure path verification is active.

# Notes
Ensure this utility is imported and invoked in all error catch structures of worker jobs.
