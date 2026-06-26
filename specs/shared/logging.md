# Logging Utilities Specification

## Purpose
Expose shared logging context structures.

## Specifications
* All logs related to a single webhook execution pipeline must include the dynamically generated `jobId` (UUID v4) inside their logger bindings.
* Use child loggers to propagate tracing parameters:
  ```typescript
  const childLogger = logger.child({ jobId: uuidVal });
  childLogger.info("Starting git checkout operations");
  ```
