# GitHub Webhook Specification

## Purpose
Expose endpoint routes parsing and validating GitHub webhook signals.

## Responsibilities
* Validate raw body payloads matching HMAC-SHA256 signatures.
* Parse payload schemas.
* Sanitize branch parameters.
* Enqueue review jobs.

## Dependencies
* External: `fastify`.
* Internal: `IQueue`.

## Webhook Signature Verification
* Use `crypto.timingSafeEqual` to verify the header `X-Hub-Signature-256` matching:
  ```typescript
  const expectedSignature = crypto
    .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  ```

## Parameter Sanitation
* Sanitize inputs against target allowlist: `/^[a-zA-Z0-9_\-\/\.:]+$/`.
