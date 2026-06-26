# GitHub Integration

This document covers everything needed to connect the AI Code Reviewer to a GitHub repository or organization.

---

## Prerequisites

- A running instance of the AI Code Reviewer with a publicly reachable URL (or a tunneled endpoint for local development).
- A GitHub account with admin access to the target repository.

---

## Step 1: Create a Personal Access Token (PAT)

The reviewer uses a PAT to authenticate against the GitHub API when posting review comments.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Set a descriptive note, e.g. `ai-code-reviewer`.
4. Choose an expiration date appropriate for your security policy.
5. Select the following scopes:

   | Scope | Why it is needed |
   |---|---|
   | `repo` | Read repository contents, clone URL, PR metadata |
   | `pull_requests:write` (implied by `repo`) | Post review comments on pull requests |

6. Click **Generate token** and copy the value immediately — it is shown only once.
7. Set it as the `GITHUB_ACCESS_TOKEN` environment variable.

> **Tip:** If you prefer not to use a PAT tied to a personal account, see the [GitHub App alternative](#github-app-alternative) section below.

---

## Step 2: Configure the Webhook

1. Go to the **repository** (or organization) **Settings → Webhooks → Add webhook**.
2. Fill in the fields:

   | Field | Value |
   |---|---|
   | Payload URL | `https://<your-host>/webhooks/github` |
   | Content type | `application/json` |
   | Secret | A long random string (minimum 32 characters); set this same value as `GITHUB_WEBHOOK_SECRET` |
   | SSL verification | **Enable** (required in production) |

3. Under **Which events would you like to trigger this webhook?** choose **Let me select individual events** and tick only **Pull requests**.
4. Confirm **Active** is checked.
5. Click **Add webhook**.

GitHub will immediately send a `ping` event. You should see a `200 OK` response in the **Recent Deliveries** tab.

---

## Step 3: Environment Variables

Add the following to your `.env` file (or container environment):

```env
GITHUB_WEBHOOK_SECRET=your-random-secret-here
GITHUB_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

---

## Verifying Delivery

1. Open the repository **Settings → Webhooks → (your webhook)**.
2. Click the **Recent Deliveries** tab.
3. Each delivery shows the payload, response headers, and response body.
4. A `202 Accepted` response with `{"status":"enqueued","jobId":"..."}` confirms the event was accepted and queued.

### Testing with the GitHub CLI

```bash
# Redeliver the most recent ping event
gh api repos/<owner>/<repo>/hooks/<hook-id>/deliveries --jq '.[0].id' \
  | xargs -I{} gh api -X POST repos/<owner>/<repo>/hooks/<hook-id>/deliveries/{}/attempts
```

---

## Viewing Logs

The reviewer emits structured JSON logs. Filter for GitHub activity:

```bash
# Docker Compose
docker compose logs -f app | grep '"provider":"github"'

# Raw node
LOG_LEVEL=debug node dist/server.js 2>&1 | grep github
```

Key log fields to look for:

| Field | Meaning |
|---|---|
| `"GitHub PR webhook enqueued"` | Webhook accepted and job placed on queue |
| `"Posted GitHub PR review"` | Comments successfully posted to the PR |
| `"Failed to post GitHub review"` | Octokit API call failed; check `GITHUB_ACCESS_TOKEN` scopes |

---

## GitHub App Alternative

Using a GitHub App instead of a PAT is recommended for organizations because:

- Permissions are scoped to specific repositories.
- The token is short-lived (60-minute installation tokens).
- Actions are attributed to the app, not a personal account.

**Required GitHub App permissions:**

| Permission | Level |
|---|---|
| Pull requests | Read & write |
| Contents | Read |

**Setup:**

1. Create the App under **Settings → Developer settings → GitHub Apps**.
2. Generate a private key and note the App ID.
3. Install the App on the target repositories.
4. Implement token exchange in `GithubService` using `@octokit/auth-app` before instantiating `Octokit`.

> The current MVP uses a static PAT. GitHub App support is a planned enhancement.

---

## Common Errors

| Symptom | Cause | Fix |
|---|---|---|
| `401 Unauthorized` on webhook | `GITHUB_WEBHOOK_SECRET` mismatch | Ensure the secret in GitHub Settings matches `GITHUB_WEBHOOK_SECRET` exactly (no trailing spaces) |
| `401` when posting comments | `GITHUB_ACCESS_TOKEN` invalid or expired | Regenerate the PAT and update the env variable |
| `403 Forbidden` when posting comments | PAT missing `repo` scope | Regenerate with the correct scopes |
| `422 Unprocessable Entity` on review | `commit_id` or line number out of range | Usually caused by a stale job; the PR was force-pushed after the job was queued |
| `200 ignored` in delivery log | PR action is not `opened`, `reopened`, or `synchronize` | Expected behavior — other PR actions (e.g. `labeled`) are intentionally ignored |
| Webhook delivers to wrong URL | Misconfigured Payload URL | Verify the URL in **Settings → Webhooks** matches your deployment |
