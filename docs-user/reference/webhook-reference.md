# Webhook Reference

Reference documentation for incoming webhook payloads from GitHub and GitLab. Includes payload schemas, signature headers, and response codes.

---

## GitHub Webhook

### Endpoint

```
POST /webhooks/github
```

### Required Headers

| Header | Value | Description |
|--------|-------|-------------|
| `Content-Type` | `application/json` | GitHub must be configured to send JSON (not form-encoded) |
| `X-GitHub-Event` | `pull_request` | Event type — only `pull_request` triggers a review |
| `X-Hub-Signature-256` | `sha256=<hmac>` | HMAC-SHA256 of the raw request body using `GITHUB_WEBHOOK_SECRET` |
| `X-GitHub-Delivery` | UUID string | Unique delivery ID from GitHub |

### Triggering Events

Only the following `action` values trigger a review job:

| Action | Description |
|--------|-------------|
| `opened` | New PR created |
| `synchronize` | New commits pushed to the PR branch |
| `reopened` | Closed PR was reopened |

All other `action` values (e.g., `closed`, `labeled`, `review_requested`) return `202` but no job is enqueued.

### GitHub Pull Request Payload (Relevant Fields)

```json
{
  "action": "opened",
  "number": 42,
  "pull_request": {
    "id": 123456789,
    "number": 42,
    "title": "Add feature X",
    "state": "open",
    "draft": false,
    "html_url": "https://github.com/org/repo/pull/42",
    "diff_url": "https://github.com/org/repo/pull/42.diff",
    "head": {
      "sha": "abc123def456",
      "ref": "feature/my-branch",
      "repo": {
        "full_name": "org/repo",
        "clone_url": "https://github.com/org/repo.git",
        "private": true
      }
    },
    "base": {
      "sha": "789xyz000111",
      "ref": "main"
    }
  },
  "repository": {
    "id": 987654321,
    "name": "repo",
    "full_name": "org/repo",
    "clone_url": "https://github.com/org/repo.git",
    "private": true
  },
  "sender": {
    "login": "username",
    "id": 1234567
  }
}
```

### GitHub Payload Schema Table

| Field | Type | Used By App | Description |
|-------|------|------------|-------------|
| `action` | string | Yes | Determines if review is triggered |
| `pull_request.number` | integer | Yes | PR number for posting comments |
| `pull_request.head.sha` | string | Yes | Head commit SHA for diff |
| `pull_request.base.sha` | string | Yes | Base commit SHA for diff |
| `pull_request.head.repo.clone_url` | string | Yes | Repository URL for git clone |
| `pull_request.head.repo.private` | boolean | Yes | Determines if auth token is needed |
| `pull_request.draft` | boolean | No | Draft PRs are processed (can be filtered in route) |
| `repository.full_name` | string | Yes | `owner/repo` for GitHub API calls |

### Signature Verification

```
X-Hub-Signature-256: sha256=<hex_digest>
```

The digest is HMAC-SHA256 computed over the **raw request body bytes** using `GITHUB_WEBHOOK_SECRET` as the key.

Verification example:

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

function verifyGitHubSignature(rawBody: Buffer, secret: string, header: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
```

---

## GitLab Webhook

### Endpoint

```
POST /webhooks/gitlab
```

### Required Headers

| Header | Value | Description |
|--------|-------|-------------|
| `Content-Type` | `application/json` | Payload format |
| `X-Gitlab-Event` | `Merge Request Hook` | Event type |
| `X-Gitlab-Token` | `<secret>` | The secret token set in GitLab webhook configuration (plain text, not HMAC) |

### Triggering Events

Only merge request events with these actions trigger a review job:

| Action | Description |
|--------|-------------|
| `open` | New MR created |
| `update` | MR updated (new commits) |
| `reopen` | Closed MR was reopened |

### GitLab Merge Request Payload (Relevant Fields)

```json
{
  "object_kind": "merge_request",
  "event_type": "merge_request",
  "user": {
    "id": 1,
    "username": "john.doe"
  },
  "project": {
    "id": 12345,
    "name": "my-project",
    "http_url": "https://gitlab.com/org/my-project",
    "git_http_url": "https://gitlab.com/org/my-project.git",
    "path_with_namespace": "org/my-project"
  },
  "object_attributes": {
    "id": 67890,
    "iid": 42,
    "title": "Add feature X",
    "state": "opened",
    "action": "open",
    "source_branch": "feature/my-branch",
    "target_branch": "main",
    "last_commit": {
      "id": "abc123def456"
    },
    "source": {
      "git_http_url": "https://gitlab.com/org/my-project.git"
    },
    "target": {
      "http_url": "https://gitlab.com/org/my-project"
    },
    "work_in_progress": false
  },
  "repository": {
    "name": "my-project",
    "url": "git@gitlab.com:org/my-project.git",
    "homepage": "https://gitlab.com/org/my-project"
  }
}
```

### GitLab Payload Schema Table

| Field | Type | Used By App | Description |
|-------|------|------------|-------------|
| `object_kind` | string | Yes | Must be `merge_request` |
| `object_attributes.action` | string | Yes | Determines if review is triggered |
| `object_attributes.iid` | integer | Yes | MR IID for posting discussion notes |
| `object_attributes.last_commit.id` | string | Yes | Head commit SHA |
| `project.id` | integer | Yes | Project ID for GitLab API calls |
| `project.git_http_url` | string | Yes | Repository URL for git clone |
| `object_attributes.work_in_progress` | boolean | No | Draft MRs are processed by default |

### Token Verification

GitLab sends the secret token as a plain-text header (not an HMAC):

```
X-Gitlab-Token: your_webhook_secret
```

Verification:

```typescript
function verifyGitLabToken(header: string, secret: string): boolean {
  return timingSafeEqual(Buffer.from(header), Buffer.from(secret));
}
```

> **Note:** GitLab uses a simpler verification scheme than GitHub. The header value is compared directly to `GITLAB_WEBHOOK_SECRET`. Use `timingSafeEqual` to prevent timing attacks.

---

## Response Codes

| HTTP Status | Meaning | When Returned |
|-------------|---------|--------------|
| `202 Accepted` | Webhook received; review job enqueued | Valid payload, signature OK, job enqueued |
| `202 Accepted` | Webhook received; event ignored | Valid payload but event type not reviewable (e.g., PR closed) |
| `400 Bad Request` | Invalid payload | Missing required fields, schema validation failure |
| `401 Unauthorized` | Signature mismatch | HMAC verification failed (GitHub) or token mismatch (GitLab) |
| `404 Not Found` | Route not found | Wrong URL |
| `405 Method Not Allowed` | Wrong HTTP method | GET instead of POST |
| `503 Service Unavailable` | Health check failed | Redis is unreachable |

### Success Response Body

```json
{
  "status": "queued",
  "jobId": "abc-123-def"
}
```

### Error Response Format

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "HMAC signature mismatch"
}
```
