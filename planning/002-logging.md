# Goal
Set up a structured JSON logging system with pino to support tracing and performance tracking.

# Scope
Initialize `pino` configurations, set up conditional pretty formatting (for local development), and exports of standard logging helpers.

# Prerequisites
* Node setup (`000-foundation`).
* Config loader (`001-configuration`).

# Deliverables
* `src/infrastructure/logging/logger.ts` config file.

# Tasks
- [ ] Install packages: `pnpm add pino` and `pnpm add -D pino-pretty`
- [ ] Create logger adapter instance inside `src/infrastructure/logging/logger.ts`.
- [ ] Set minimum log level dynamically based on `LOG_LEVEL` environment variable.
- [ ] Configure `pino-pretty` formatting for `development` mode and standard single-line JSON formatting for `production` mode.
- [ ] Export configured logger object.

# Acceptance Criteria
* Output logs in development are clean, colorized, and human-readable.
* Output logs in production are single-line JSON objects with standard fields (`level`, `time`, `pid`, `hostname`, `msg`).

# Testing Checklist
* **Unit Test**: Mock environment variables and assert logger formatting configuration.
* **Integration Test**: None.
* **Manual Test**: Run script emitting logs of various levels (`info`, `error`, `debug`) and verify formatting in stdout.
* **Failure Scenarios**: Check that fallback settings are used if invalid `LOG_LEVEL` value is provided.

# Risks
* Disk space exhaustion from excessive debug log strings. Make sure log level is configurable.

# Notes
Use logger instances bound to Fastify where appropriate to propagate request tracking headers.
