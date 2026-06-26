# Maintenance

This document covers routine and periodic maintenance tasks: application upgrades, Redis maintenance, job cleanup, log rotation, and dependency updates.

---

## Upgrading the Application

### Docker Compose Deployment

```bash
# 1. Pull latest code
git -C /opt/ai-reviewer pull origin main

# 2. Install updated dependencies
docker compose run --rm api pnpm install --frozen-lockfile

# 3. Build updated TypeScript
docker compose run --rm api pnpm build

# 4. Rebuild Docker images
docker compose build --no-cache

# 5. Drain workers before restart
#    (Workers finish current jobs before new containers start)
docker compose up -d --no-deps --scale worker=0 worker
sleep 30  # Give in-progress jobs time to complete

# 6. Restart all services
docker compose up -d

# 7. Verify health
curl -s http://localhost:3000/health | jq .
```

### Zero-Downtime Upgrade (Blue-Green)

For production deployments where uptime matters:

1. Start new containers alongside existing ones (different port or service name)
2. Update load balancer to route to new containers
3. Drain old containers (send SIGTERM, wait for active jobs to finish)
4. Remove old containers

```bash
# Start new version on a different compose project
docker compose -p ai-reviewer-new up -d

# Verify new version is healthy
curl -s http://localhost:3001/health  # New port

# Switch traffic (update nginx upstream or load balancer)
# Then stop old version
docker compose -p ai-reviewer stop
```

### Rolling Update (Single Host)

```bash
# Restart API first (no in-flight state)
docker compose restart api

# Restart workers one at a time
for i in $(docker compose ps -q worker); do
  docker restart "$i"
  sleep 30  # Wait for the new container to be healthy
done
```

---

## Redis Maintenance

### Memory Reclamation

Redis does not always release memory back to the OS after keys are deleted. Force memory reclamation:

```bash
docker compose exec redis redis-cli MEMORY PURGE
```

### Checking Memory Fragmentation

```bash
docker compose exec redis redis-cli INFO memory | grep mem_fragmentation_ratio
# < 1.5 is normal; > 2.0 indicates fragmentation
```

If fragmentation is high, restart Redis (it defragments on startup):

```bash
docker compose restart redis
```

> **Warning:** Restarting Redis during active job processing will fail those jobs. They will retry according to BullMQ retry configuration.

### Upgrading Redis

```bash
# Update the image tag in docker-compose.yml
# redis:7-alpine  →  redis:7.2-alpine

docker compose pull redis
docker compose stop redis
docker compose up -d redis
```

Redis is backward-compatible across minor versions. Check the [Redis release notes](https://redis.io/docs/latest/operate/rs/release-notes/) for major version upgrades.

---

## Clearing Old Jobs

BullMQ automatically removes jobs older than `QUEUE_JOB_TTL_SECONDS`. You can also clean manually:

```bash
# Remove completed jobs older than 1 hour
docker compose exec redis redis-cli EVAL "
  local jobs = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
  for i, job in ipairs(jobs) do
    redis.call('DEL', 'bull:review-queue:' .. job)
  end
  redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
  return #jobs
" 1 bull:review-queue:completed $(date -d '1 hour ago' +%s)000
```

Or use the BullMQ API in a one-off script:

```typescript
import { Queue } from 'bullmq';
const queue = new Queue('review-queue', { connection });

// Clean jobs older than 24 hours, keep max 50
await queue.clean(86400000, 50, 'completed');
await queue.clean(86400000, 50, 'failed');

await queue.close();
```

---

## Log Rotation

### Docker json-file Driver

```bash
# Check current log size
du -sh /var/lib/docker/containers/*/
```

Ensure Docker daemon is configured for log rotation (see [Logs](./logs.md)):

```json
{
  "log-opts": {
    "max-size": "100m",
    "max-file": "5"
  }
}
```

Apply changes without restarting Docker:

```bash
# Reload Docker daemon config (Linux)
sudo kill -HUP $(pidof dockerd)
```

> **Note:** Log rotation config only applies to new containers. Existing containers keep the settings they were created with.

### PM2 Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # Daily at midnight
```

---

## Dependency Updates

### Check for Outdated Packages

```bash
pnpm outdated
```

### Update Dependencies

```bash
# Update to latest minor/patch (safe)
pnpm update

# Update to latest major (potentially breaking — review changelog first)
pnpm update --latest
```

### After Updating

```bash
pnpm install --frozen-lockfile  # Verify lockfile is consistent
pnpm typecheck                  # Ensure no type regressions
pnpm lint                       # Ensure no lint regressions
pnpm test                       # Run full test suite
pnpm build                      # Verify compilation succeeds
```

### Security Audit

```bash
pnpm audit
pnpm audit --fix   # Automatically fix low-risk vulnerabilities
```

Address any high or critical severity findings before deploying.

---

## Workspace Cleanup

Run periodically to remove any leaked workspace directories:

```bash
find "$WORKSPACE_DIR" -maxdepth 1 -type d -name "job-*" -mmin +120 -exec rm -rf {} +
```

See [Workspace Cleanup](./workspace-cleanup.md) for full details.

---

## Maintenance Window Checklist

Use this checklist before planned maintenance:

- [ ] Notify users of planned downtime (if applicable)
- [ ] Wait for active jobs to complete (`redis-cli LLEN bull:review-queue:active`)
- [ ] Take Redis backup (`redis-cli BGSAVE`)
- [ ] Back up `.env` file
- [ ] Perform maintenance tasks
- [ ] Verify health endpoint returns 200
- [ ] Confirm queue is processing by checking logs after sending a test webhook
- [ ] Monitor error logs for 15 minutes post-maintenance
