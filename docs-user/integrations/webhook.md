# Webhook Security

The reviewer's webhook endpoints use cryptographic verification to ensure that only requests originating from GitHub or GitLab are processed. This document explains the security model and how to verify it is configured correctly.

---

## GitHub: HMAC-SHA256 Signature Verification

GitHub signs every webhook payload with an HMAC-SHA256 digest computed over the **raw request body** using your `GITHUB_WEBHOOK_SECRET` as the key. The signature is sent in the `X-Hub-Signature-256` header:

```
X-Hub-Signature-256: sha256=<hex-digest>
```

### How Verification Works

```typescript
// src/infrastructure/vcs/security.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyGithubSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) {
    return false;
  }

  // Strip the "sha256=" prefix and decode the hex digest to bytes
  const provided = Buffer.from(signatureHeader.slice(7), 'hex');

  // Compute HMAC-SHA256 of the raw body using our secret
  const expected = Buffer.from(
    createHmac('sha256', secret).update(rawBody).digest('hex'),
    'hex',
  );

  // Length check prevents short-circuit attacks before timingSafeEqual
  if (provided.length !== expected.length) {
    return false;
  }

  // Constant-time comparison prevents timing-based secret oracle attacks
  return timingSafeEqual(provided, expected);
}
```

**Key properties:**

- `timingSafeEqual` prevents timing oracle attacks — the comparison takes the same time regardless of where the first mismatch occurs.
- The raw body (not the parsed JSON) is used for the digest. The framework must preserve the raw body before JSON parsing.
- A failed verification returns `401 Unauthorized` immediately; the payload is never parsed.

---

## GitLab: Shared Secret Token Verification

GitLab uses a simpler approach: the webhook secret is sent in plain text in the `X-Gitlab-Token` header. The reviewer compares it against `GITLAB_WEBHOOK_SECRET` using a constant-time comparison:

```typescript
export function verifyGitlabToken(
  tokenHeader: string | undefined,
  secret: string,
): boolean {
  if (!tokenHeader) {
    return false;
  }

  const provided = Buffer.from(tokenHeader);
  const expected = Buffer.from(secret);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
```

> **Warning:** Unlike HMAC-SHA256, the GitLab token is transmitted over the wire in cleartext. Always use HTTPS in production to prevent token interception.

---

## Raw Body Requirement

Fastify must expose the raw request body buffer for GitHub signature verification. The application registers the raw body plugin:

```typescript
// The Content-Type: application/json body is also stored as rawBody (Buffer)
// before JSON parsing so that the HMAC can be computed over the exact bytes
// GitHub sent.
```

If you add a middleware layer (proxy, load balancer) that re-encodes or modifies the body in transit, signature verification will fail. Ensure your reverse proxy forwards the body byte-for-byte.

---

## Payload Validation

After signature verification passes, the payload is validated using Zod schemas:

- `githubWebhookSchema` — validates the GitHub `pull_request` event shape.
- `gitlabWebhookSchema` — validates the GitLab Merge Request Hook shape.

A `400 Bad Request` is returned if the payload does not match the schema.

Branch names are additionally validated against `/^[a-zA-Z0-9_\-\/\.:]+$/` to prevent command injection via branch names that could be passed to git commands.

---

## Replay Attack Prevention

The current implementation does not use webhook delivery timestamps to enforce replay windows. To add replay protection:

1. Parse the `X-GitHub-Delivery` (GitHub) or check a timestamp field (GitLab) from the payload.
2. Store recent delivery IDs in Redis with a TTL equal to your acceptable replay window (e.g. 5 minutes).
3. Reject any delivery whose ID is already present in the set.

This is a recommended hardening step for production deployments exposed to the internet.

---

## Generating a Secure Webhook Secret

Use a cryptographically random string of at least 32 characters:

```bash
# macOS / Linux
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the same value in both your Git provider's webhook settings and the `GITHUB_WEBHOOK_SECRET` / `GITLAB_WEBHOOK_SECRET` environment variable.

---

## Rotating Webhook Secrets

1. Generate a new secret using the command above.
2. Update the webhook configuration in GitHub/GitLab with the new secret.
3. Update the environment variable in your deployment and restart the reviewer.
4. Verify at least one successful delivery after rotation before removing the old secret.

> **Note:** There is a brief window during rotation where deliveries signed with the new secret will fail if the service has not yet restarted. Plan rotations during low-traffic periods.

---

## IP Allowlisting (Optional)

GitHub publishes its webhook source IP ranges at:

```
https://api.github.com/meta
```

The `hooks` field contains the CIDR ranges. You can configure your firewall or reverse proxy to accept webhook traffic only from these ranges in addition to signature verification. This is defense-in-depth — signature verification alone is sufficient cryptographically.

GitLab.com webhook source IPs are not published; check your GitLab instance's network egress if using self-managed.

---

## Security Checklist

- [ ] `GITHUB_WEBHOOK_SECRET` is at least 32 random characters
- [ ] `GITLAB_WEBHOOK_SECRET` is at least 32 random characters
- [ ] Secrets are stored in environment variables, not in source code
- [ ] Both webhook URLs use HTTPS with a valid certificate
- [ ] SSL verification is enabled in the webhook settings (GitHub and GitLab)
- [ ] The reviewer is not reachable over plain HTTP from the internet
- [ ] Webhook secrets are rotated at least annually
