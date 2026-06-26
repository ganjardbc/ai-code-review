# Monitoring

This guide covers observability practices for the AI Code Reviewer: health checks, Redis metrics, disk usage, process supervision, and log aggregation.

---

## Health Endpoint

The API server exposes a health endpoint at `GET /health`.

### Response Codes

| Status | HTTP Code | Meaning |
|--------|-----------|---------|
| `healthy` | `200` | All dependencies reachable |
| `unhealthy` | `503` | Redis disconnected or other critical failure |

### Healthy Response

```json
{
  "status": "healthy",
  "redis": "connected"
}
```

### Unhealthy Response

```json
{
  "status": "unhealthy",
  "redis": "disconnected"
}
```

### Polling the Health Endpoint

**With curl (simple):**

```bash
watch -n 30 'curl -s http://localhost:3000/health | jq .'
```

**With a shell script for alerting:**

```bash
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ "$RESPONSE" != "200" ]; then
  echo "ALERT: AI Reviewer health check failed (HTTP $RESPONSE)" | mail -s "Health Alert" ops@example.com
fi
```

Run this script every minute via cron:

```cron
* * * * * /usr/local/bin/check-ai-reviewer.sh
```

### Uptime Monitoring Services

For external monitoring, configure an uptime service (e.g., UptimeRobot, Better Uptime, Grafana Cloud) to poll `https://reviewer.example.com/health` every 60 seconds and alert on `non-2xx` responses.

---

## Redis Monitoring

Redis memory and connection health directly impact job processing.

### Key Metrics to Watch

```bash
# Connect to Redis
docker compose exec redis redis-cli

# Memory usage
127.0.0.1:6379> INFO memory
# Look for: used_memory_human, maxmemory_human

# Connected clients
127.0.0.1:6379> INFO clients
# Look for: connected_clients, blocked_clients

# BullMQ queue length (waiting jobs)
127.0.0.1:6379> LLEN "bull:review-queue:wait"

# Active jobs
127.0.0.1:6379> LLEN "bull:review-queue:active"

# Failed jobs
127.0.0.1:6379> ZCARD "bull:review-queue:failed"
```

### Redis Memory Alerts

Set a `maxmemory` in Redis to prevent OOM:

```bash
# In redis.conf or as runtime command
CONFIG SET maxmemory 512mb
CONFIG SET maxmemory-policy allkeys-lru
```

Alert when used memory exceeds 80% of `maxmemory`.

### Prometheus + redis_exporter

For structured metrics, run `redis_exporter` alongside Redis:

```yaml
# Add to docker-compose.yml
services:
  redis-exporter:
    image: oliver006/redis_exporter:latest
    environment:
      REDIS_ADDR: redis://redis:6379
    ports:
      - "9121:9121"
```

Key Prometheus metrics exposed:
- `redis_memory_used_bytes`
- `redis_connected_clients`
- `redis_keyspace_hits_total`
- `redis_keyspace_misses_total`

---

## Disk Usage — Workspace Directory

The workspace directory (`WORKSPACE_DIR`, default `/tmp/ai-reviewer/workspace`) holds git clones during active jobs. In normal operation, each job cleans up after itself. However, if a worker crashes mid-job, the directory may persist.

### Check Current Disk Usage

```bash
# Size of workspace directory
du -sh /tmp/ai-reviewer/workspace

# List all job directories
ls -la /tmp/ai-reviewer/workspace/

# Total disk usage on the partition
df -h /tmp
```

### Alert Thresholds (Recommended)

| Threshold | Action |
|-----------|--------|
| > 5 GB | Investigate stuck jobs |
| > 10 GB | Alert operations team |
| > 80% disk full | Critical — stop accepting new jobs |

### Automated Disk Alert

```bash
#!/bin/bash
THRESHOLD=80
WORKSPACE=/tmp/ai-reviewer/workspace
PARTITION=$(df "$WORKSPACE" | tail -1 | awk '{print $5}' | tr -d '%')

if [ "$PARTITION" -gt "$THRESHOLD" ]; then
  echo "ALERT: Disk usage at ${PARTITION}% on workspace partition"
fi
```

For workspace-specific cleanup, see [Workspace Cleanup](../operations/workspace-cleanup.md).

---

## Process Monitoring

### Docker Compose (Built-in Restart Policy)

The `docker-compose.yml` should include restart policies:

```yaml
services:
  api:
    restart: unless-stopped

  worker:
    restart: unless-stopped
```

With `unless-stopped`, Docker automatically restarts crashed containers.

### PM2 (Non-Docker Alternative)

If running bare Node.js processes (without Docker):

```bash
npm install -g pm2

# Start API
pm2 start dist/presentation/web/server.js --name ai-reviewer-api

# Start Worker
pm2 start dist/worker.js --name ai-reviewer-worker

# Save process list for system startup
pm2 save
pm2 startup
```

PM2 key commands:

```bash
pm2 status               # List all processes
pm2 logs ai-reviewer-api # Stream logs
pm2 restart all          # Restart all processes
pm2 monit                # Real-time CPU/memory dashboard
```

### Systemd (Alternative to PM2)

```ini
# /etc/systemd/system/ai-reviewer-api.service
[Unit]
Description=AI Code Reviewer API Server
After=network.target redis.service

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/ai-reviewer
ExecStart=/usr/bin/node dist/presentation/web/server.js
Restart=always
RestartSec=10
EnvironmentFile=/etc/ai-reviewer/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ai-reviewer-api
sudo systemctl start ai-reviewer-api
sudo journalctl -u ai-reviewer-api -f  # Stream logs
```

---

## Log Aggregation

The application emits structured JSON logs via pino. Route them to a central aggregator for search and alerting.

### Loki + Grafana (Docker Compose)

```yaml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail-config.yml:/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
```

### Ship to Datadog

```yaml
services:
  datadog-agent:
    image: datadog/agent:latest
    environment:
      DD_API_KEY: ${DD_API_KEY}
      DD_LOGS_ENABLED: "true"
      DD_CONTAINER_LABELS_AS_TAGS: "true"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
```

### Ship to Elastic Stack (ECS)

Configure pino's transport to output ECS-compatible JSON:

```bash
pnpm add pino-ecs-transport
```

For more on log format and filtering, see [Logs](../operations/logs.md).
