# System Configuration

The system is configured via environment variables. In local development, these are read from a `.env` file in the root directory. In containerized environments, these variables are injected by the orchestrator (Docker Compose, Kubernetes).

---

## Environment Variables Reference

| Variable Name | Type | Default | Description | Required |
|---|---|---|---|---|
| `PORT` | Number | `3000` | The port Fastify web server listens on. | No |
| `NODE_ENV` | String | `development` | Node execution environment (`development`, `production`, `test`). | No |
| `LOG_LEVEL` | String | `info` | Minimum log output severity (`trace`, `debug`, `info`, `warn`, `error`, `fatal`). | No |
| `REDIS_URL` | String | `redis://localhost:6379` | Connection URI for the Redis instance running BullMQ. | Yes |
| `NINE_ROUTER_API_KEY` | String | - | API token for 9Router platform. | Yes |
| `NINE_ROUTER_BASE_URL` | String | `https://api.9router.com/v1` | Root URL for the 9Router API gateway. | No |
| `GITHUB_WEBHOOK_SECRET` | String | - | Signing token to verify incoming GitHub webhook events. | Yes |
| `GITHUB_ACCESS_TOKEN` | String | - | Personal access token / App installation token with permissions to comment on PRs. | Yes |
| `GITLAB_WEBHOOK_SECRET` | String | - | Secret token value to verify incoming GitLab merge request payloads. | Yes |
| `GITLAB_ACCESS_TOKEN` | String | - | GitLab personal access token with API access to post comments on MRs. | Yes |
| `WORKSPACE_DIR` | String | `/tmp/ai-reviewer/workspace` | Root filesystem directory where workers clone repositories. | No |
| `QUEUE_JOB_TTL_SECONDS` | Number | `86400` | Duration (in seconds) to keep completed/failed jobs in Redis before automatic cleanup. | No |
| `QUEUE_MAX_JOBS_RETAINED` | Number | `100` | Maximum number of completed/failed job records retained in the queue logs. | No |

---

## Secrets Management

* **Encryption**: In production, secrets must not be stored in plain text configuration files. Use container environment injections from secret engines such as AWS Secrets Manager, HashiCorp Vault, or Google Cloud Secret Manager.
* **Rotation**: Design authentication interfaces to support dynamic credentials. Webhook handlers retrieve credentials based on project references rather than statically compiling them.

---

## Workspace Directory Management

* All Git operations are scoped within a dedicated scratch folder: `<WORKSPACE_DIR>/job-<job-id>`.
* The server process requires read and write permissions to this directory.
* **Disk Size Warnings**: Since repository clones require storage, configure disk cleanup watchdogs or volume attachments on staging containers. Disk storage space is checked during the `/health` checks.

---

## Logging Configuration

The system implements structured JSON logs utilizing the `pino` engine integrated directly inside Fastify.

* **Development Mode**: Logs are printed using `pino-pretty` to enhance console readability.
* **Production Mode**: Logs are printed in raw, single-line JSON format, allowing automatic indexing and analysis in central log aggregators like Datadog, Elasticsearch, or AWS CloudWatch.

Example log output structure:
```json
{"level":30,"time":1782531600000,"pid":14052,"hostname":"service-pod-3","msg":"Job processed successfully","jobId":"git-91823-abc-928"}
```
