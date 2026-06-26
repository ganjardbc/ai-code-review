# Goal
Create secure endpoints to receive and validate GitHub and GitLab webhook events.

# Scope
Expose webhook routes, validate payload signature headers using cryptographic comparisons, validate parameter strings against regex rules, and map inputs to standard interfaces.

# Prerequisites
* Fastify Server (`003-http-server`).
* Config loader (`001-configuration`).

# Deliverables
* `src/presentation/web/routes/webhooks.ts` containing the routes.
* `src/presentation/dto/webhook.dto.ts` containing payload schemas.

# Tasks
- [ ] Install packages: `pnpm add raw-body` (to extract raw body strings for signature validation)
- [ ] Configure Fastify to parse raw request body fields on `/webhooks/*` endpoints.
- [ ] Create `src/presentation/dto/webhook.dto.ts` using validation packages (e.g. `zod` or Fastify native validation) to check webhook payloads.
- [ ] Implement signature validation utility in `src/infrastructure/vcs/security.ts`:
  * GitHub: HMAC-SHA256 comparison on `X-Hub-Signature-256` utilizing `crypto.timingSafeEqual`.
  * GitLab: Strict token matching on `X-Gitlab-Token`.
- [ ] Implement input sanitation checks inside webhook handlers checking branch names against allowlist regex: `/^[a-zA-Z0-9_\-\/\.:]+$/`.
- [ ] Register routes `/webhooks/github` and `/webhooks/gitlab` in `src/presentation/web/routes/webhooks.ts`.

# Acceptance Criteria
* Request fails with `401 Unauthorized` status if payload signature is missing or incorrect.
* Requests with invalid branch names or directory traversal parameters return `400 Bad Request`.
* Valid webhook requests return `202 Accepted` and log metadata.

# Testing Checklist
* **Unit Test**: Test signature verification logic using valid/invalid signatures.
* **Integration Test**: Send mock webhook payload to endpoints with valid/invalid signatures and assert status codes.
* **Manual Test**: Use mock webhook tools to POST mock requests to endpoints.
* **Failure Scenarios**: Check that requests are rejected if the payload string changes after signing.

# Risks
* Timing attacks. Ensure timing-safe comparisons are used during HMAC checks.

# Notes
We return `202 Accepted` immediately without waiting for worker execution completion.
