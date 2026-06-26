# Goal
Implement the AI runner adapter to communicate with 9Router.

# Scope
Create the HTTP client interface and 9Router adapter targeting the OpenCode model.

# Prerequisites
* Node setup (`000-foundation`).
* Config loader (`001-configuration`).

# Deliverables
* `src/domain/interfaces/ai-provider.interface.ts` port interface.
* `src/infrastructure/ai/nine-router.service.ts` client implementation.

# Tasks
- [ ] Install packages: `pnpm add axios`
- [ ] Create `IAiProvider` interface in `src/domain/interfaces/ai-provider.interface.ts`.
- [ ] Implement `NineRouterService` using axios in `src/infrastructure/ai/nine-router.service.ts`.
- [ ] Configure client authorization headers using `NINE_ROUTER_API_KEY`.
- [ ] Configure payload payload parameters (`model: 'opencode'`, `temperature: 0.1`, `response_format: { type: 'json_object' }`).
- [ ] Implement response error handling (checking for rate-limits, gateway timeouts) and export helper metrics.

# Acceptance Criteria
* Client requests payload structures conform to 9Router spec.
* Model returns JSON object output formats.
* API rate limits are caught and translated into custom exceptions.

# Testing Checklist
* **Unit Test**: Stub axios response and verify request parameters configuration.
* **Integration Test**: Send test prompt payload to 9Router sandbox and verify response.
* **Manual Test**: None.
* **Failure Scenarios**: Check request failure cases when incorrect keys are used.

# Risks
* 9Router API updates. Ensure client allows API endpoint customization.

# Notes
Ensure the response timeout is configured to match slower inference responses.
