# Goal
Expose a health monitoring endpoint to support status checks.

# Scope
Add a `/health` endpoint responding with server status and service connectivity status (Redis connection status, disk space status).

# Prerequisites
* Fastify Server (`003-http-server`).

# Deliverables
* `src/presentation/web/routes/health.ts` exposing the route.

# Tasks
- [ ] Create `/health` endpoint handler inside `src/presentation/web/routes/health.ts`.
- [ ] Add check logic verifying local disk write permissions and space availability.
- [ ] Add placeholder check logic verifying Redis connectivity (to be filled in during Phase 3).
- [ ] Return status code `200` with JSON status variables when all checks succeed.
- [ ] Return status code `503` with service status if checks fail.

# Acceptance Criteria
* Request to `GET /health` returns JSON response with status details.
* Correct status codes matching check outcome.

# Testing Checklist
* **Unit Test**: Test health router logic directly with stubbed check results.
* **Integration Test**: Send API call using Fastify inject and assert JSON output.
* **Manual Test**: Run curl command against `/health` and verify output.
* **Failure Scenarios**: Check that disk checks fail if the destination directory has write blockages.

# Risks
* False positives or blocking calls. Ensure check logic does not contain heavy blocking commands.

# Notes
Used by load balancer probes to route client webhooks.
