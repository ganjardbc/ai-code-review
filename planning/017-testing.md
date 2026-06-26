# Goal
Configure unit, integration, and end-to-end testing setups.

# Scope
Install testing libraries, set up config mocks, configure execution scripts, and setup test database/redis environment templates.

# Prerequisites
* Node setup (`000-foundation`).

# Deliverables
* Test configs and environment files.
* Test execution commands in `package.json`.

# Tasks
- [ ] Install packages: `pnpm add -D jest @types/jest ts-jest supertest`
- [ ] Create `jest.config.js` mapping tests folders.
- [ ] Implement global mocking helpers for:
  * 9Router API (stubbings axios results).
  * VCS API (mocking Octokit / GitBeaker networks).
  * Redis (using `ioredis-mock`).
- [ ] Implement basic unit tests for:
  * Webhook validation.
  * Prompt builder.
  * Response validation schemas.
- [ ] Implement end-to-end integration test asserting webhooks trigger queue jobs and worker execution processes.

# Acceptance Criteria
* Test suites execute successfully running `pnpm test`.
* Mocks prevent tests from triggering actual network calls to 9Router, GitHub, or GitLab.

# Testing Checklist
* **Unit Test**: Run tests and check coverage reports.
* **Integration Test**: Check that database/redis mock contexts are cleared before and after each test.
* **Manual Test**: None.
* **Failure Scenarios**: Confirm tests fail if mocked components return bad values.

# Risks
* Stale mock data causing false passes. Regularly verify matches against actual APIs.

# Notes
Tests run automatically on CI/CD validation checks.
