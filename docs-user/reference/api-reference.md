# API Reference

Complete HTTP API specification for the AI Code Reviewer.

---

## Base URL

All endpoints are relative to the API server base URL:

```
http://localhost:3000
# or in production:
https://reviewer.example.com
```

---

## POST /webhooks/github

Receives GitHub webhook events. Validates the HMAC-SHA256 signature and enqueues a review job for eligible pull request events.

### Request

**Method:** `POST`

**URL:** `/webhooks/github`

**Headers:**

| Header | Required | Value |
|--------|----------|-------|
| `Content-Type` | Yes | `application/json` |
| `X-GitHub-Event` | Yes | `pull_request` (other values accepted but ignored) |
| `X-Hub-Signature-256` | Yes | `sha256=<hmac_sha256_of_raw_body>` |
| `X-GitHub-Delivery` | No | UUID (logged but not used) |

**Body:** GitHub pull request webhook payload (see [Webhook Reference](./webhook-reference.md))

**Example:**

```bash
PAYLOAD='{"action":"opened","number":42,...}'
SECRET="your_webhook_secret"
SIG="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)"

curl -X POST https://reviewer.example.com/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$PAYLOAD"
```

### Responses

**202 Accepted — Job enqueued**

```json
{
  "status": "queued",
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**202 Accepted — Event ignored (non-reviewable action)**

```json
{
  "status": "ignored",
  "reason": "Event action 'closed' does not trigger a review"
}
```

**400 Bad Request — Payload validation failed**

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body must have required property 'pull_request'"
}
```

**401 Unauthorized — Signature mismatch**

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "HMAC signature mismatch"
}
```

---

## POST /webhooks/gitlab

Receives GitLab webhook events. Validates the `X-Gitlab-Token` header and enqueues a review job for eligible merge request events.

### Request

**Method:** `POST`

**URL:** `/webhooks/gitlab`

**Headers:**

| Header | Required | Value |
|--------|----------|-------|
| `Content-Type` | Yes | `application/json` |
| `X-Gitlab-Event` | Yes | `Merge Request Hook` |
| `X-Gitlab-Token` | Yes | The secret token configured in GitLab webhook settings |

**Body:** GitLab merge request webhook payload (see [Webhook Reference](./webhook-reference.md))

**Example:**

```bash
curl -X POST https://reviewer.example.com/webhooks/gitlab \
  -H "Content-Type: application/json" \
  -H "X-Gitlab-Event: Merge Request Hook" \
  -H "X-Gitlab-Token: your_gitlab_webhook_secret" \
  -d '{"object_kind":"merge_request","object_attributes":{"action":"open",...}}'
```

### Responses

**202 Accepted — Job enqueued**

```json
{
  "status": "queued",
  "jobId": "550e8400-e29b-41d4-a716-446655440001"
}
```

**202 Accepted — Event ignored**

```json
{
  "status": "ignored",
  "reason": "Event action 'merge' does not trigger a review"
}
```

**401 Unauthorized — Token mismatch**

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid GitLab webhook token"
}
```

---

## GET /health

Returns the health status of the API server and its dependencies.

### Request

**Method:** `GET`

**URL:** `/health`

**Headers:** None required

**Body:** None

**Example:**

```bash
curl -s https://reviewer.example.com/health | jq .
```

### Responses

**200 OK — All dependencies healthy**

```json
{
  "status": "healthy",
  "redis": "connected"
}
```

**503 Service Unavailable — One or more dependencies unhealthy**

```json
{
  "status": "unhealthy",
  "redis": "disconnected"
}
```

The `503` response should be used by load balancers and monitoring systems to detect and route around unhealthy instances.

---

## Error Response Format

All error responses follow the Fastify default error format:

```json
{
  "statusCode": <integer>,
  "error": "<HTTP status phrase>",
  "message": "<human-readable description>"
}
```

### Common Error Codes

| HTTP Status | Error | Description |
|-------------|-------|-------------|
| `400` | `Bad Request` | Request body failed schema validation |
| `401` | `Unauthorized` | Webhook signature or token verification failed |
| `404` | `Not Found` | Requested endpoint does not exist |
| `405` | `Method Not Allowed` | Wrong HTTP method for the endpoint |
| `413` | `Payload Too Large` | Request body exceeds the 10MB limit |
| `500` | `Internal Server Error` | Unexpected server error (check logs) |
| `503` | `Service Unavailable` | Dependency (Redis) is unreachable |

---

## Notes for Webhook Consumers

1. **Always use `POST`** — All webhook endpoints only accept POST requests.
2. **Return-fast contract** — The API returns `202` immediately without waiting for the review to complete. Use the VCS provider's PR/MR to see the review output.
3. **No duplicate protection** — If a webhook is delivered twice (e.g., GitHub retry after timeout), two review jobs will be enqueued and two review comments may appear. GitHub retries up to 3 times before marking a delivery as failed.
4. **Body must be raw JSON** — Do not re-serialize or transform the request body between the VCS provider and this API. The HMAC is computed over the original bytes.
