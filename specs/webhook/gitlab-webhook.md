# GitLab Webhook Specification

## Purpose
Expose endpoint routes parsing and validating GitLab webhook signals.

## Responsibilities
* Verify token security headers.
* Parse payload schemas.
* Sanitize branch parameters.
* Enqueue review jobs.

## Dependencies
* External: `fastify`.
* Internal: `IQueue`.

## Webhook Token Verification
* Perform a secure, constant-time validation check comparing header `X-Gitlab-Token` with the configured `GITLAB_WEBHOOK_SECRET`.

## Parameter Sanitation
* Sanitize inputs against target allowlist: `/^[a-zA-Z0-9_\-\/\.:]+$/`.
