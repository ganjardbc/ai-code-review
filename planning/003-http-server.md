# Goal
Bootstrap the Fastify HTTP Web Server configuration.

# Scope
* Initialize Fastify server.
* Add performance setups, body parser middleware, and security headers.
* Configure graceful shutdown triggers.

# Prerequisites
* Node setup (`000-foundation`).
* Config loader (`001-configuration`).
* Logger setup (`002-logging`).

# Deliverables
* `src/presentation/web/server.ts` entrypoint.
* `src/presentation/web/app.ts` configuring Fastify instance.

# Tasks
- [ ] Install packages: `pnpm add fastify @fastify/helmet`
- [ ] Create `src/presentation/web/app.ts` initializing Fastify and registering `@fastify/helmet` for security.
- [ ] Bind Fastify request logs to our Pino logger module.
- [ ] Setup global error handling logic converting uncaught exceptions to standardized JSON responses.
- [ ] Create `src/presentation/web/server.ts` to listen on configured `PORT` and setup process lifecycle event handlers (`SIGTERM`, `SIGINT`) to close database/queue connections gracefully.

# Acceptance Criteria
* Server starts successfully and listens on `PORT`.
* HTTP response headers contain security headers (e.g. `X-Content-Type-Options: nosniff`).
* Standard uncaught exceptions do not crash the node process and return standard JSON error payload.

# Testing Checklist
* **Unit Test**: None.
* **Integration Test**: Send dummy requests and verify status codes and payload structure.
* **Manual Test**: Run curl requests and verify responses.
* **Failure Scenarios**: Check that server startup exits safely if the port is already in use.

# Risks
* Connection timeouts or thread locks. Configure reasonable timeout boundaries in Fastify.

# Notes
Ensure keep-alive and request timeout headers match the reverse proxy specifications.
