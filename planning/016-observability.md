# Goal
Set up event listeners and performance metrics logging.

# Scope
Add execution duration metrics, job failure counts, and detailed trace logs for API and Worker services.

# Prerequisites
* Node setup (`000-foundation`).
* Config loader (`001-configuration`).
* Logger setup (`002-logging`).

# Deliverables
* Integrated Pino traces inside web controllers and BullMQ workers.

# Tasks
- [ ] Add request timing logs inside Fastify web controllers calculating request completion latency.
- [ ] Log job lifecycle events inside worker processes (enqueued time, dequeue time, execution duration).
- [ ] Count and log review outcomes (number of comments posted, validation errors, truncated files count).
- [ ] Format all trace metadata using standard, queryable JSON fields to simplify analysis in centralized logging systems.

# Acceptance Criteria
* Review durations are logged in milliseconds.
* Traces log target metadata (repository name, PR number, commit SHA) in standard JSON fields.
* Job failures print complete error traces.

# Testing Checklist
* **Unit Test**: None.
* **Integration Test**: Verify execution logs emit correct JSON properties upon mock webhook execution.
* **Manual Test**: None.
* **Failure Scenarios**: Check that telemetry failures do not block the execution of code reviews.

# Risks
* PII leaks. Strip tokens, authorization headers, and commit author emails before logging review details.

# Notes
Used to compute service SLA KPIs.
