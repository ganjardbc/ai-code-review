# Logs

The AI Code Reviewer uses [pino](https://github.com/pinojs/pino) for structured JSON logging. All log output goes to stdout/stderr, which Docker captures and routes to your configured logging driver.

---

## Log Format

All logs are newline-delimited JSON objects:

```json
{
  "level": 30,
  "time": 1719481200000,
  "pid": 12,
  "hostname": "ai-reviewer-api-1",
  "msg": "Server started",
  "port": 3000
}
```

### Level Codes

| Code | Level | Meaning |
|------|-------|---------|
| 10 | `trace` | Very verbose — internal timing, raw payloads |
| 20 | `debug` | Developer info — request details, queue events |
| 30 | `info` | Normal operational events |
| 40 | `warn` | Recoverable problems, deprecated usage |
| 50 | `error` | Failures that affect a request or job |
| 60 | `fatal` | Process-level failure, process will exit |

### Setting Log Level

```dotenv
LOG_LEVEL=info   # Production (recommended)
LOG_LEVEL=debug  # Development
LOG_LEVEL=warn   # Noisy environments
```

Valid values: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.

---

## Development — Pretty Printing

In development (`NODE_ENV=development`), logs are formatted with `pino-pretty` for human-readable output:

```
[12:00:00.000] INFO (12): Server started
    port: 3000
[12:00:01.123] DEBUG (12): Webhook received
    provider: "github"
    event: "pull_request"
    action: "opened"
```

`pino-pretty` is only active when `NODE_ENV=development`. Do not use it in production — the overhead degrades throughput and the output is not JSON.

---

## Viewing Logs

### Docker Compose

```bash
# Stream all services
docker compose logs -f

# API server only
docker compose logs -f api

# Worker only
docker compose logs -f worker

# Last 100 lines
docker compose logs --tail=100 api

# Since a specific time
docker compose logs --since "2024-01-15T10:00:00" api
```

### Single Container

```bash
docker logs -f ai-reviewer-api
docker logs --tail=200 ai-reviewer-worker
```

---

## Filtering with jq

pino emits JSON, which makes `jq` the ideal tool for log analysis.

### Show only errors

```bash
docker compose logs -f api 2>&1 | jq 'select(.level >= 50)'
```

### Show log message and timestamp only

```bash
docker compose logs api 2>&1 | jq '{time: (.time | todate), level: .level, msg: .msg}'
```

### Filter by a specific field

```bash
# Show logs related to a specific job
docker compose logs worker 2>&1 | jq 'select(.jobId == "abc-123-def")'

# Show all webhook events
docker compose logs api 2>&1 | jq 'select(.msg | test("webhook"; "i"))'
```

### Count errors in the last hour

```bash
docker compose logs api 2>&1 | \
  jq --arg since "$(date -d '1 hour ago' --iso-8601=seconds)" \
  'select(.level >= 50 and (.time/1000 | todate) > $since)' | \
  wc -l
```

---

## Log Rotation

Docker's default `json-file` logging driver rotates logs automatically when configured:

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "5"
  }
}
```

Per-container override in `docker-compose.yml`:

```yaml
services:
  api:
    logging:
      driver: json-file
      options:
        max-size: "100m"
        max-file: "5"
```

For PM2 deployments, use `pm2 install pm2-logrotate` and configure max file size.

---

## Shipping to an External Aggregator

### Option 1: Docker Logging Driver (Zero App Changes)

Change the logging driver in `docker-compose.yml`:

```yaml
services:
  api:
    logging:
      driver: "fluentd"
      options:
        fluentd-address: "localhost:24224"
        tag: "ai-reviewer.api"
```

Supported drivers: `fluentd`, `gelf` (Graylog), `awslogs`, `splunk`, `syslog`.

### Option 2: Loki via Docker Plugin

```bash
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
```

```yaml
services:
  api:
    logging:
      driver: loki
      options:
        loki-url: "http://localhost:3100/loki/api/v1/push"
        loki-labels: "job=ai-reviewer,service=api"
```

### Option 3: Promtail (Sidecar)

Mount the Docker container log directory and run promtail to scrape and forward to Loki.

### Option 4: Datadog Agent

```yaml
services:
  datadog-agent:
    image: datadog/agent:7
    environment:
      DD_API_KEY: ${DD_API_KEY}
      DD_LOGS_ENABLED: "true"
      DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL: "true"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
```

---

## Key Log Events to Monitor

| Event | Level | Search term |
|-------|-------|-------------|
| Server started | info | `"Server started"` |
| Webhook received | info | `"webhook"` |
| Job enqueued | info | `"enqueued"` |
| Job started | info | `"Job started"` |
| Job completed | info | `"Job completed"` |
| Job failed | error | `"Job failed"` |
| HMAC signature mismatch | warn | `"signature"` |
| AI provider error | error | `"nine-router"` |
| Git clone failed | error | `"git clone"` |
| Workspace cleanup failed | warn | `"cleanup"` |
