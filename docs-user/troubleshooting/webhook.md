# Webhook Troubleshooting

This guide covers diagnosing problems with GitHub and GitLab webhook delivery. Webhooks are the entry point for all review jobs — if they fail, no reviews are triggered.

---

## Webhook Flow

```
GitHub/GitLab  ──POST──►  Reverse Proxy  ──►  API Server  ──►  BullMQ Queue
                           (port 443)          (port 3000)
```

Each step can fail independently. Start at the VCS provider's delivery log and work inward.

---

## Step 1: Check VCS Delivery Logs

### GitHub

1. Go to your repository → **Settings** → **Webhooks** → click your webhook
2. Scroll to **Recent Deliveries**
3. Click a delivery to see:
   - HTTP response code
   - Response body
   - Request headers (including `X-Hub-Signature-256`)
   - Timing

### GitLab

1. Go to your project → **Settings** → **Webhooks**
2. Click **Edit** on your webhook
3. Scroll to **Recent events** (or **Hook log**)
4. Click a delivery to see the response code and body

---

## Diagnosis by HTTP Response Code

### 202 — Success

The API server accepted the webhook and enqueued the job. This is the expected response.

If you see `202` but no review appears on the PR/MR:
- Check the worker logs: `docker compose logs -f worker`
- Check the failed job queue: `docker compose exec redis redis-cli ZCARD "bull:review-queue:failed"`

### 401 — Signature Mismatch

The HMAC-SHA256 signature in the request header did not match the expected signature computed from the body and secret.

**Causes:**

| Cause | Check |
|-------|-------|
| Wrong webhook secret | Compare VCS provider secret with `.env` secret |
| Trailing whitespace in secret | Copy the secret again carefully |
| Reverse proxy modifying body | See "Raw Body Requirement" below |
| Content-Type mismatch | GitHub must use `application/json` |

**Debug:**

```bash
# Check what secret is configured (do not log the value)
grep WEBHOOK_SECRET .env | cut -c1-30  # Show only first 30 chars for verification
```

### 400 — Bad Request

The request body failed schema validation. Possible causes:

- Unexpected GitHub/GitLab event type (only `pull_request` / `merge_request` are handled)
- Malformed JSON
- Missing required fields in the payload

Check what event type is being sent. The application only processes:
- `X-GitHub-Event: pull_request` with `action: opened | synchronize | reopened`
- GitLab merge request events with `object_kind: merge_request`

### 404 — Route Not Found

The webhook URL is incorrect. Expected routes:
- `POST /webhooks/github`
- `POST /webhooks/gitlab`

Check the configured webhook URL in the VCS provider settings.

### 408 / Gateway Timeout — Too Slow to Respond

The API server must return a response within the VCS provider's timeout window (typically 10–30 seconds). The application returns `202` immediately and processes asynchronously. If you are seeing timeouts:

- The reverse proxy timeout may be too low. Set to at least 30 seconds.
- The API server may be overloaded or restarting.

```bash
# Check if API server is running
docker compose ps api
curl -s http://localhost:3000/health
```

### 503 — Service Unavailable

The API server returned `503` — usually means Redis is down.

```bash
docker compose ps redis
docker compose exec redis redis-cli ping
```

### 5xx from Reverse Proxy

If the response comes from your reverse proxy (not the application), check proxy logs:

```bash
# Nginx
tail -50 /var/log/nginx/ai-reviewer-error.log

# Caddy
journalctl -u caddy -n 50
```

---

## Raw Body Requirement

GitHub and GitLab compute the HMAC signature over the **exact bytes** of the request body. The application verifies the signature using the same raw bytes.

If a reverse proxy:
- Re-serializes the JSON (reordering keys, changing whitespace)
- Decompresses and re-compresses
- Transcodes character encoding

...the signature will not match, and the request will be rejected with `401`.

**Nginx** buffers the body to disk without modification — this is safe.

**Caddy** also passes the body through without modification.

If you are using a custom proxy or middleware, ensure it does not touch the request body.

---

## Webhook Not Delivering (GitHub)

**Check if GitHub can reach your server:**

GitHub's webhook system may be blocked by:
- Firewall rules blocking GitHub's IP ranges
- DNS not resolving to the correct server

GitHub publishes its IP ranges at https://api.github.com/meta (look for `hooks`).

```bash
curl -s https://api.github.com/meta | jq '.hooks'
```

Ensure these CIDR ranges are allowed in your firewall.

**Test connectivity from your server:**

```bash
curl -s -o /dev/null -w "%{http_code}" https://github.com
```

---

## Webhook Not Delivering (GitLab)

### GitLab SaaS

GitLab.com does not restrict webhook outbound IPs. Connectivity issues are usually firewall-side.

### GitLab Self-Managed

GitLab self-managed blocks webhooks to local network addresses by default. If your AI reviewer is on the same network:

1. Go to **Admin Area** → **Settings** → **Network**
2. Under **Outbound requests**, enable **Allow requests to the local network from webhooks and services**
3. Add your server's IP/hostname to the allowlist

---

## Testing Webhooks Locally

Use ngrok to create a public tunnel to your local development server:

```bash
ngrok http 3000
```

Use the ngrok URL (e.g., `https://abc123.ngrok.io/webhooks/github`) as the webhook URL in the VCS provider. See [Local Development](../development/local-development.md#ngrok-webhook-testing) for full ngrok setup.
