# GitLab Troubleshooting

Issues specific to GitLab integration: personal access tokens, self-managed GitLab configuration, SSL verification, and Merge Request discussion API errors.

---

## Personal Access Token (PAT) Scope Issues

### Required Scopes

The GitLab PAT set as `GITLAB_ACCESS_TOKEN` requires:

| Scope | Why It's Needed |
|-------|----------------|
| `api` | Full API access — clone repos, read MR diffs, post discussion notes |
| `read_repository` | Clone repository contents (included in `api`) |

> **Warning:** `read_api` scope is not sufficient. The application posts review comments using `POST /projects/:id/merge_requests/:mr_iid/discussions`, which requires full `api` scope.

### Verifying Token Scopes

```bash
curl -s \
  -H "PRIVATE-TOKEN: $GITLAB_ACCESS_TOKEN" \
  https://gitlab.com/api/v4/personal_access_tokens/self | jq '{scopes: .scopes, active: .active, expires_at: .expires_at}'
```

Expected output:

```json
{
  "scopes": ["api"],
  "active": true,
  "expires_at": null
}
```

### Token Expired

GitLab tokens can be created with an expiry date. If the token has expired:

1. Go to GitLab → **User Settings** → **Access Tokens**
2. Create a new token with `api` scope
3. Update `GITLAB_ACCESS_TOKEN` in `.env`
4. Restart the worker: `docker compose restart worker`

---

## GitLab Self-Managed URL Configuration

When using a self-hosted GitLab instance, you must configure the GitLab base URL.

> **Note:** Check `src/infrastructure/vcs/gitlab.service.ts` for how the GitLab client is configured. The base URL is typically sourced from the webhook payload's `repository.homepage` or a configured environment variable.

### Common Misconfiguration

If the worker tries to call `https://gitlab.com/api/v4/...` for a self-managed instance, all API calls will fail.

**Verify the webhook payload** contains the correct GitLab instance URL, and ensure the service uses that URL when constructing API clients.

### Accessing GitLab API

Test connectivity from the worker container:

```bash
docker compose exec worker curl -s \
  -H "PRIVATE-TOKEN: $GITLAB_ACCESS_TOKEN" \
  "https://your-gitlab.company.com/api/v4/user"
```

Expected: Your user's profile JSON.

---

## SSL Verification for Self-Hosted GitLab

Self-managed GitLab instances often use self-signed or internal CA certificates. The application's HTTP client (axios via `@gitbeaker/rest`) will reject these by default.

### Symptom

```
Error: self-signed certificate in certificate chain
Error: unable to verify the first certificate
```

### Fix — Add the CA Certificate

The safest fix is to add your internal CA certificate to the Node.js trust store:

```bash
# Get the CA certificate (PEM format)
openssl s_client -connect your-gitlab.company.com:443 -showcerts < /dev/null 2>/dev/null | \
  openssl x509 -outform PEM > /tmp/gitlab-ca.pem

# Set the environment variable
NODE_EXTRA_CA_CERTS=/path/to/gitlab-ca.pem node dist/worker.js
```

In Docker:

```dockerfile
# Add to Dockerfile or docker-compose.yml
COPY gitlab-ca.pem /usr/local/share/ca-certificates/gitlab-ca.crt
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/gitlab-ca.crt
```

Or via `docker-compose.yml`:

```yaml
services:
  worker:
    environment:
      NODE_EXTRA_CA_CERTS: /certs/gitlab-ca.pem
    volumes:
      - ./certs/gitlab-ca.pem:/certs/gitlab-ca.pem:ro
```

> **Warning:** Do not disable SSL verification (`NODE_TLS_REJECT_UNAUTHORIZED=0`) in production. This makes the connection vulnerable to man-in-the-middle attacks.

---

## MR Discussion API Errors

The application posts review comments using the GitLab Discussions API (`POST /projects/:id/merge_requests/:iid/discussions`).

### 404 Not Found

```
Error: 404 Not Found
GitLab API: /projects/123/merge_requests/42/discussions
```

**Causes:**
1. The project ID or MR IID in the webhook payload is incorrect
2. The MR was deleted between webhook delivery and job processing
3. The access token does not have access to the project

**Debug:**

```bash
curl -s \
  -H "PRIVATE-TOKEN: $GITLAB_ACCESS_TOKEN" \
  "https://your-gitlab.company.com/api/v4/projects/123/merge_requests/42"
```

### 403 Forbidden

```
Error: 403 Forbidden
GitLab API: insufficient permissions
```

**Causes:**
1. Token has `read_api` scope instead of `api`
2. Token belongs to a user who is not a project member
3. Project visibility is set to private, and the token user is not a member

**Fix:** Ensure the token owner is at least a **Developer** role on the project.

### 422 Unprocessable Entity

```
Error: 422 Unprocessable Entity
{"message": "Note {:commit_id=>['is invalid']}"}
```

**Causes:**
- The `line_code` or position parameters are invalid for the MR diff
- The commit SHA referenced in the diff position does not exist (force-pushed MR branch)

This is handled by the application's error handling — the reviewer falls back to a general MR comment when inline positioning fails.

---

## Webhook Secret Issues

GitLab sends the webhook secret in the `X-Gitlab-Token` header (not an HMAC). The application checks this header value directly against `GITLAB_WEBHOOK_SECRET`.

### Symptom

```
Webhook rejected: invalid GitLab token
```

**Fix:** Ensure `GITLAB_WEBHOOK_SECRET` in `.env` exactly matches the **Secret token** field in GitLab → Project Settings → Webhooks.

---

## Self-Managed: Outbound Webhook Restrictions

GitLab self-managed blocks webhooks to local/internal network addresses by default.

If the AI reviewer is deployed internally (same network as GitLab):

1. Go to GitLab **Admin Area** → **Settings** → **Network**
2. Under **Outbound requests**, enable:
   - "Allow requests to the local network from system hooks"
   - "Allow requests to the local network from web hooks and services"
3. Add your reviewer server's IP or hostname to the allowlist

Without this, webhook deliveries will fail silently from GitLab's perspective.

---

## Rate Limiting

GitLab enforces rate limits on API endpoints. The Discussions API is typically limited to 300 requests per minute per user.

```bash
# Check rate limit headers
curl -s -I \
  -H "PRIVATE-TOKEN: $GITLAB_ACCESS_TOKEN" \
  "https://your-gitlab.company.com/api/v4/user" | grep -i ratelimit
```

If rate limited, reduce `WORKER_CONCURRENCY` or add delays between API calls.
