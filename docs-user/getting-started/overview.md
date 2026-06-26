# Overview

## What AI Code Reviewer Does

AI Code Reviewer is a self-hosted service that automates the first pass of code review on pull requests (GitHub) and merge requests (GitLab). When a developer opens or updates a PR/MR, the service:

1. Receives a webhook event from the source platform.
2. Clones the repository and generates a filtered diff.
3. Sends the diff to an AI model through the 9Router API gateway.
4. Parses the structured JSON response.
5. Posts inline comments directly on the PR/MR at the relevant file and line number.

The result is that by the time a human reviewer opens the PR, trivial issues, potential bugs, and code-quality concerns are already surfaced as inline comments — allowing human reviewers to focus on design, intent, and context rather than mechanical checks.

---

## Who It Is For

AI Code Reviewer is aimed at:

- **Engineering teams** that want automated review coverage without adopting a SaaS code-review product.
- **Platform / DevOps engineers** who need a self-hosted service they can deploy inside a private network alongside GitHub Enterprise or self-managed GitLab.
- **Open-source maintainers** who want a first-pass review bot they can run on their own infrastructure.

It is a backend service with no graphical interface. Operators interact with it through configuration files, environment variables, and log output.

---

## How It Fits in the Workflow

```
Developer opens PR
       |
       v
GitHub / GitLab sends webhook --> AI Code Reviewer (202 Accepted)
                                          |
                                          v
                                   Job queued in Redis
                                          |
                                          v
                                   Worker clones repo
                                   generates diff
                                   calls AI via 9Router
                                   parses response
                                          |
                                          v
                               Inline comments posted on PR/MR
                                          |
                                          v
                               Human reviewer opens PR
                               (AI comments already visible)
```

The service sits entirely outside the critical path of the CI pipeline. Webhooks are acknowledged immediately (HTTP 202), and the review job runs asynchronously. A slow or failing review job does not block the developer or the CI system.

---

## Key Capabilities

| Capability | Detail |
|---|---|
| GitHub integration | Handles `pull_request` events (`opened`, `synchronize`, `reopened`) |
| GitLab integration | Handles merge request webhook events |
| Inline comments | Comments are posted at exact file path + line number |
| Severity tagging | Each comment carries `INFO`, `WARNING`, or `CRITICAL` severity |
| Diff filtering | Lockfiles, generated files, build outputs, and binary assets are excluded |
| Diff size cap | Diffs larger than 40 KB are rejected to stay within AI context limits |
| Queue resilience | BullMQ retries failed jobs; Redis persists the queue across restarts |
| Workspace isolation | Each job runs in its own temporary directory, cleaned up after completion |
| Health monitoring | `GET /health` returns service and dependency status in JSON |

---

## Limitations in the Current Release (v0.1.0)

The following are known limitations of the MVP. They are documented here so you can make an informed decision before deploying.

| Limitation | Details |
|---|---|
| No web UI | There is no dashboard or admin interface. All configuration is via environment variables and all observability is via structured JSON logs. |
| No authentication on webhooks UI | Webhook signature verification is implemented for both GitHub (`GITHUB_WEBHOOK_SECRET`) and GitLab (`GITLAB_WEBHOOK_SECRET`). There is no additional authentication layer on the API itself. |
| No multi-tenancy | A single deployment handles one set of credentials. To support multiple organizations you must run multiple instances. |
| No PR size enforcement | Only diff size (40 KB) is enforced. Repositories with very large histories may be slow to clone. |
| Single AI model | The model is selected via the 9Router gateway configuration. Hot-swapping models per repository or per team is not supported in v0.1.0. |
| No comment deduplication | If the same diff is reviewed twice (e.g., due to a retry), duplicate comments may appear on the PR/MR. |
| No historical storage | Review results are not persisted beyond what Redis retains in the job queue. |
