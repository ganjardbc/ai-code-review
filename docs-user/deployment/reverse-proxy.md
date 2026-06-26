# Reverse Proxy Configuration

The AI Code Reviewer API server (`port 3000`) should not be exposed directly to the internet. Place a reverse proxy in front of it to handle TLS termination, rate limiting, and header forwarding.

---

## Critical Requirement: Raw Body Preservation

> **Warning:** Webhook signature verification (HMAC-SHA256) is computed against the **raw request body** bytes. Any reverse proxy that re-encodes, normalizes, or modifies the body will break signature validation. All examples below preserve the raw body.

This applies specifically to:
- `POST /webhooks/github`
- `POST /webhooks/gitlab`

---

## Nginx

### Minimal Configuration

```nginx
upstream ai_reviewer {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name reviewer.example.com;

    # Redirect HTTP to HTTPS (see ssl.md)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name reviewer.example.com;

    # SSL config — see ssl.md for certificate setup
    ssl_certificate     /etc/letsencrypt/live/reviewer.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reviewer.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Logging
    access_log /var/log/nginx/ai-reviewer-access.log;
    error_log  /var/log/nginx/ai-reviewer-error.log;

    location / {
        proxy_pass         http://ai_reviewer;
        proxy_http_version 1.1;

        # Keep connections alive to the upstream
        proxy_set_header Connection "";

        # Forward real client info
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts — webhook handler returns 202 immediately, but set
        # conservative timeouts for safety
        proxy_connect_timeout 10s;
        proxy_send_timeout    30s;
        proxy_read_timeout    30s;

        # Raw body: do NOT enable proxy_request_buffering off unless
        # you have a reason; Nginx buffers to disk by default which
        # is fine and preserves byte-for-byte accuracy
        proxy_buffering on;
    }

    # Health check endpoint — can be used by load balancers
    location /health {
        proxy_pass         http://ai_reviewer;
        proxy_http_version 1.1;
        proxy_set_header   Connection "";
        access_log         off;
    }
}
```

### Body Size Limit

GitHub webhook payloads can be large for repositories with many changed files. Ensure Nginx does not reject them:

```nginx
# Inside http {} or server {} block
client_max_body_size 10m;
```

### Rate Limiting (Optional)

```nginx
# Define a rate limit zone in the http {} block
limit_req_zone $binary_remote_addr zone=webhook:10m rate=30r/m;

# Apply in the location block
location /webhooks/ {
    limit_req zone=webhook burst=10 nodelay;
    proxy_pass http://ai_reviewer;
    # ... other proxy settings
}
```

---

## Caddy

Caddy is the simplest option — it handles HTTPS automatically via Let's Encrypt.

### Caddyfile

```caddy
reviewer.example.com {
    # Caddy handles TLS automatically — no certificate config needed

    reverse_proxy localhost:3000 {
        header_up Host            {host}
        header_up X-Real-IP       {remote_host}
        header_up X-Forwarded-For {remote_host}

        # Upstream health checks
        health_uri     /health
        health_interval 30s
        health_timeout  5s

        # Timeouts
        dial_timeout   10s
        response_header_timeout 30s
    }

    # Access logging
    log {
        output file /var/log/caddy/ai-reviewer.log
        format json
    }
}
```

> **Tip:** Caddy does not modify the request body. Webhook HMAC verification works out of the box with Caddy.

### With Docker Compose

```caddy
reviewer.example.com {
    reverse_proxy api:3000
}
```

When running Caddy inside the same Docker Compose network, use the service name (`api`) instead of `localhost`.

---

## Traefik (Docker Label-Based)

If you are already running Traefik in your Docker environment:

```yaml
# In docker-compose.yml
services:
  api:
    image: ai-code-reviewer:latest
    command: node dist/presentation/web/server.js
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.ai-reviewer.rule=Host(`reviewer.example.com`)"
      - "traefik.http.routers.ai-reviewer.entrypoints=websecure"
      - "traefik.http.routers.ai-reviewer.tls.certresolver=letsencrypt"
      - "traefik.http.services.ai-reviewer.loadbalancer.server.port=3000"
```

---

## Verifying Header Forwarding

After configuring your reverse proxy, verify the upstream receives the correct client IP:

```bash
curl -s https://reviewer.example.com/health
```

Check the API server logs. You should see the actual client IP in the `remoteAddress` field, not `127.0.0.1`.

If you see `127.0.0.1` (the proxy's loopback address), configure your Node.js/Fastify app to trust the proxy:

```typescript
// In app.ts — already set if using @fastify/helmet with default config
fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, ...)
```

Fastify's `trustProxy` option must be enabled if you use `request.ip` in any route handler.
