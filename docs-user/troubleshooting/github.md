# GitHub Troubleshooting

Issues specific to GitHub integration: personal access tokens (PATs), rate limiting, comment posting, and organization requirements.

---

## Personal Access Token (PAT) Issues

### Required Scopes

The GitHub PAT set as `GITHUB_ACCESS_TOKEN` requires the following scopes:

| Scope | Why It's Needed |
|-------|----------------|
| `repo` | Clone private repositories, read PR diffs, post review comments |
| `public_repo` | Same as above, but for public repositories (subset of `repo`) |

> **Note:** For GitHub Apps (future feature), the required permissions are `pull_requests: write` and `contents: read`. This guide covers classic PATs and fine-grained PATs only.

### Fine-Grained PATs

Fine-grained tokens (available on GitHub.com) offer more granular control. Set these permissions:

| Permission | Access Level |
|-----------|-------------|
| Contents | Read |
| Pull requests | Read and write |
| Metadata | Read (required) |

> **Warning:** Fine-grained PATs are scoped to specific repositories or organizations. If you add new repositories to the reviewer, you must update the PAT's repository access.

### Verifying Token Scopes

```bash
# Check what scopes your token has
curl -s -I \
  -H "Authorization: Bearer $GITHUB_ACCESS_TOKEN" \
  https://api.github.com/user | grep -i x-oauth-scopes
```

The `X-OAuth-Scopes` header lists all granted scopes.

### Token Has No `repo` Scope

Symptom:
```
Error: Resource not accessible by personal access token
GitHub API: 403 Forbidden
```

Fix: Generate a new token with `repo` scope or add the scope to the existing token.

---

## Rate Limiting

GitHub enforces rate limits per authenticated token.

### Rate Limit Values

| Account Type | Requests per Hour |
|-------------|-----------------|
| Authenticated (PAT) | 5,000 |
| GitHub App (installation) | 15,000 |
| Unauthenticated | 60 |

### Checking Current Rate Limit

```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_ACCESS_TOKEN" \
  https://api.github.com/rate_limit | jq .
```

Response:

```json
{
  "resources": {
    "core": {
      "limit": 5000,
      "remaining": 4800,
      "reset": 1719485200
    }
  }
}
```

`reset` is a Unix timestamp when the limit resets.

### Symptoms of Rate Limiting

```
HTTP 403 Forbidden
{
  "message": "API rate limit exceeded for user ID 12345",
  "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"
}
```

### Mitigation

1. **Reduce `WORKER_CONCURRENCY`** — fewer parallel jobs mean fewer API calls per minute.
2. **Use GitHub Apps instead of PATs** — Apps have a higher rate limit (15,000 req/hr per installation).
3. **Cache API responses** — if multiple workers call the same API endpoint, add caching.
4. **Review large PRs in batches** — the reviewer already truncates diffs at 40KB; ensure this limit is active.

---

## PR Comment Permission Denied

### Symptom

```
Error: Not Found — 404
# or
Error: Must have push access to create a review comment — 403
```

### Causes

1. **Token scoped to a different repo** — Fine-grained PATs must include the target repo
2. **Organization visibility restriction** — The repository may be in an organization that restricts PAT access
3. **Repository archived** — Archived repositories do not accept new PR comments

### Fix for Organization Restrictions

Organization admins can restrict PAT access at the org level. Check:

1. Go to **org** → **Settings** → **Third-party access** → **Personal access tokens**
2. If "Restrict access via fine-grained personal access tokens" is enabled, the PAT must be approved
3. Request approval or use a GitHub App token instead

---

## Deprecated Token Types

### OAuth Tokens (Legacy)

`Authorization: token ghp_...` style tokens are being deprecated in some contexts. Use `Bearer` authorization:

The application already uses the correct format via `@octokit/rest`, which handles authentication headers correctly for classic PATs.

### GitHub Apps vs PATs

For organization deployments, GitHub Apps are preferred over PATs:

| | PAT | GitHub App |
|--|-----|-----------|
| Rate limit | 5,000/hr | 15,000/hr |
| Audit log | Tied to user | Tied to app |
| Org approval | Required (fine-grained) | One-time installation |
| Expiry | Optional | Token auto-rotates |

GitHub Apps support is a planned future feature. Track progress in the project issues.

---

## Organization SSO Requirements

If your GitHub organization enforces SAML SSO, PATs must be authorized for the organization.

### Symptom

```
{
  "message": "Resource protected by organization SAML enforcement. You must grant your OAuth token access to this organization.",
  "documentation_url": "..."
}
```

### Fix

1. Go to **github.com** → **Settings** → **Developer settings** → **Personal access tokens**
2. Find your token
3. Click **Configure SSO** next to the token
4. Click **Authorize** for your organization

After authorization, the same token can access the organization's repositories.

---

## Webhook Delivery Issues

See [Webhook Troubleshooting](./webhook.md) for GitHub-specific webhook delivery problems (signature verification, IP allowlist, delivery logs).
