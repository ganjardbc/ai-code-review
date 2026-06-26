# Logging Module Specification

## Purpose
Expose a high-performance, structured JSON logging mechanism using `pino` to simplify system diagnostic checks and monitoring logs.

## Responsibilities
* Provide logging levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.
* Format output dynamically: pretty-printing in development, raw single-line JSON in production.
* Bind logger instances to Fastify requests to inherit context fields.
* **Must Not**: Write logs directly to network targets (must output directly to stdout/stderr).

## Dependencies
* External: `pino`, `pino-pretty`.

## Public Interfaces
```typescript
export interface ILogger {
  trace(msg: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
  info(msg: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  error(msg: string, err?: Error, ...args: any[]): void;
  fatal(msg: string, err?: Error, ...args: any[]): void;
  child(bindings: Record<string, any>): ILogger;
}
```

## Folder Structure
```text
src/infrastructure/logging/
├── logger.ts              # Pino initialization adapter
└── logger.interface.ts    # ILogger contract export
```

## Security
* **PII Redaction**: Strip authorization headers, secrets, private tokens, and Git author email properties before rendering to stdout.
