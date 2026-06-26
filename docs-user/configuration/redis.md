# Redis

Redis is the only external data store. It serves as the BullMQ queue backend and the job state
store. Both the `api` process (enqueuing jobs) and the `worker` process (consuming jobs) must be
able to reach the same Redis instance.

---

## REDIS_URL

| Variable | Default | Required |
|---|---|---|
| `REDIS_URL` | — | **Yes** |

The value must be a valid URL. It is parsed by ioredis to extract `host`, `port`, and optionally
`password`.

### URL Format

```
redis[s]://[[username:]password@]host[:port][/db-index]
```

| Example | Description |
|---|---|
| `redis://localhost:6379` | Unauthenticated local instance (development) |
| `redis://:mysecretpassword@redis:6379` | Password-only auth (no username) |
| `redis://default:mysecretpassword@redis:6379` | Username + password (Redis 6+ ACL) |
| `redis://redis:6379/1` | Database index 1 |
| `rediss://user:pass@my-redis.example.com:6380` | TLS (`rediss://` scheme) |

> **Note:** ioredis ignores the `username` component for Redis instances older than 6.0. For
> Redis 6+ with ACL, use `redis://username:password@host:port`.

---

## Redis Version Requirements

**Minimum: Redis 7** (as used in the Docker Compose setup via `redis:7-alpine`).

BullMQ 5.x requires Redis ≥ 6.2 for the `LMPOP` and `LPOS` commands it uses internally. Redis 7
is recommended because it ships with those commands and is the current LTS-equivalent major
version.

---

## Connection Behaviour

The application uses two ioredis clients with different retry semantics:

| Client | Used by | Retry policy |
|---|---|---|
| `getRedisClient()` | Health check, general use | `maxRetriesPerRequest: 3`, `enableReadyCheck: true`, `lazyConnect: true` |
| `getRedisConnectionOptions()` | BullMQ Worker / Queue | `maxRetriesPerRequest: null` (BullMQ requirement), `enableReadyCheck: false` |

BullMQ mandates `maxRetriesPerRequest: null` on connections it manages — do not override this.

Connection lifecycle events are logged:

```
INFO  Redis connected
WARN  Redis reconnecting
ERROR Redis client error  { err: ... }
```

---

## AOF Persistence

The Docker Compose `redis` service enables AOF (Append-Only File) persistence via the named
`redis_data` volume:

```yaml
volumes:
  - redis_data:/data
```

Redis AOF defaults (`appendonly yes` is off by default in Redis 7; the compose file relies on
Docker volume durability and the `redis_data` named volume surviving restarts). For stronger
durability guarantees in production, pass explicit AOF options to the Redis server:

```yaml
command: redis-server --appendonly yes --appendfsync everysec
```

`appendfsync everysec` (the default when AOF is on) balances durability and performance: at most
one second of data is lost on a crash.

---

## maxmemory-policy

> **Warning:** The Docker Compose default uses `allkeys-lru`, which will silently evict BullMQ
> job records when Redis approaches its memory limit. This is unsuitable for production.

The compose file sets:

```yaml
command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

For production, change the policy to `noeviction`:

```yaml
command: redis-server --maxmemory 1gb --maxmemory-policy noeviction --appendonly yes --appendfsync everysec
```

With `noeviction`, Redis returns an error to writers when memory is full rather than deleting
data. BullMQ will surface this as a job enqueue failure, which is far preferable to silently
losing job state. Alert on Redis memory usage and increase `maxmemory` before it is reached.

---

## Managed Redis Options

### Redis Cloud

[Redis Cloud](https://redis.com/redis-enterprise-cloud/overview/) offers a free tier suitable for
low-volume deployments. Use the TLS-enabled endpoint:

```dotenv
REDIS_URL=rediss://default:YOUR_PASSWORD@redis-12345.c1.us-east-1-2.ec2.cloud.redislabs.com:12345
```

Ensure the selected plan has no eviction policy applied, or configure a dedicated database with
`noeviction`.

### AWS ElastiCache for Redis

Use the Primary Endpoint for a single-node cluster or a Replication Group endpoint for HA:

```dotenv
REDIS_URL=redis://:AUTH_TOKEN@my-cluster.abc123.0001.use1.cache.amazonaws.com:6379
```

Enable **cluster mode disabled** (BullMQ's ioredis client does not support Redis Cluster mode
without additional configuration). Enable **in-transit encryption** (`rediss://`).

### Upstash Redis

[Upstash](https://upstash.com) provides a serverless Redis with a REST API and a standard Redis
endpoint. Use the Redis-compatible endpoint, not the REST URL:

```dotenv
REDIS_URL=rediss://default:YOUR_TOKEN@global-decisive-carp-32391.upstash.io:6379
```

Upstash's free tier limits throughput; verify it meets your job volume before committing.

---

## Connection Troubleshooting

**`ECONNREFUSED redis:6379`**
: The `api` or `worker` container cannot reach the `redis` service. In Docker Compose, ensure
  the service is named `redis` in `docker-compose.yml` and that `depends_on` includes a
  `service_healthy` condition. Outside Compose, verify the hostname and port.

**`NOAUTH Authentication required`**
: Redis requires a password but none was provided. Add `:<password>@` to `REDIS_URL`.

**`ERR max number of clients reached`**
: Redis has hit its `maxclients` limit (default: 10 000). Investigate connection leaks. Each
  BullMQ Worker opens at least two connections per queue.

**`OOM command not allowed when used memory > 'maxmemory'`**
: Redis is full and using `noeviction`. Increase `maxmemory`, prune old jobs, or reduce
  `QUEUE_MAX_JOBS_RETAINED` and `QUEUE_JOB_TTL_SECONDS`.

**Health endpoint returns `"redis": "down"`**
: The health check sends a `PING` to Redis. If it returns anything other than `PONG`, or throws,
  `redis` is reported as `"down"` and the endpoint returns HTTP 503. Check Redis logs and
  `REDIS_URL` configuration.

---

## Sizing Reference

BullMQ stores job payloads, state, and metadata in Redis. Each completed job record occupies
roughly 1–5 KB depending on payload size and result data.

With defaults (`QUEUE_MAX_JOBS_RETAINED=100`, `QUEUE_JOB_TTL_SECONDS=86400`):

- Maximum retained records: 100 completed + 100 failed = 200 jobs
- Rough upper bound: ~1 MB for job records at 5 KB each

Active jobs (in-progress) also occupy memory while running. Total queue memory usage is well
under 50 MB for most workloads; Redis memory is dominated by worker connection overhead and
keyspace metadata.
