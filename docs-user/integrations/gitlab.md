# GitLab Integration

This document covers everything needed to connect the AI Code Reviewer to a GitLab project.

---

## Prerequisites

- A running instance of the AI Code Reviewer with a publicly reachable URL (or a tunneled endpoint for local development).
- Maintainer or Owner access on the target GitLab project.

---

## Step 1: Create a Personal Access Token (PAT)

The reviewer uses a PAT to post inline discussion comments on merge requests.

1. Go to **GitLab → User Settings → Access Tokens** (or **Profile → Access Tokens**).
2. Click **Add new token**.
3. Set a name, e.g. `ai-code-reviewer`, and an expiry date.
4. Select the following scopes:

   | Scope | Why it is needed |
   |---|---|
   | `api` | Full API access — required to create MR discussions |
   | `read_repository` | Clone repository contents over HTTPS |

5. Click **Create personal access token** and copy the value immediately.
6. Set it as the `GITLAB_ACCESS_TOKEN` environment variable.

> **Note:** If you are using a project-level or group-level access token (GitLab Premium/Ultimate), the process is similar. Navigate to **Project → Settings → Access Tokens** instead.

---

## Step 2: Configure the Webhook

1. Go to **Project → Settings → Webhooks**.
2. Fill in the fields:

   | Field | Value |
   |---|---|
   | URL | `https://<your-host>/webhooks/gitlab` |
   | Secret token | A long random string (minimum 32 characters); set this same value as `GITLAB_WEBHOOK_SECRET` |
   | Trigger | Tick **Merge request events** only |
   | Enable SSL verification | **Checked** (required in production) |

3. Click **Add webhook**.
4. Use the **Test** button next to the webhook and choose **Merge request events** to send a test payload.

A `202 Accepted` response with `{"status":"enqueued"}` confirms the webhook is working.

---

## Step 3: Environment Variables

```env
GITLAB_WEBHOOK_SECRET=your-random-secret-here
GITLAB_ACCESS_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
```

---

## Verifying Delivery

1. Go to **Project → Settings → Webhooks → (your webhook) → Edit**.
2. Scroll to the **Recent events** section at the bottom of the page.
3. Each event shows the request, response code, and response body.

### Checking logs

```bash
docker compose logs -f app | grep '"provider":"gitlab"'
```

Key log messages:

| Message | Meaning |
|---|---|
| `"GitLab MR webhook enqueued"` | Webhook validated and job placed on queue |
| `"Posted GitLab MR review comments"` | All comments submitted successfully |
| `"Failed to post GitLab discussion comment"` | One or more comment submissions failed; partial success is still logged |

---

## GitLab Self-Managed Notes

If you run GitLab on-premises, consider these additional steps:

### Allow outbound connections from your GitLab instance

GitLab restricts webhooks to external hosts by default. Go to **Admin Area → Settings → Network → Outbound requests** and ensure your reviewer's hostname is allowlisted, or disable the restriction for trusted internal hosts.

### Custom CA certificates

If your reviewer is behind a self-signed TLS certificate, either:

- Disable SSL verification on the webhook (acceptable only in a trusted internal network), or
- Add your CA certificate to the GitLab instance trust store.

### API URL for self-managed

The `@gitbeaker/rest` client defaults to `https://gitlab.com`. If you are using a self-managed instance, you must pass the `host` option. Update `GitlabService` constructor:

```typescript
this.api = new Gitlab({
  token: config.GITLAB_ACCESS_TOKEN,
  host: 'https://gitlab.your-company.com',
});
```

Add `GITLAB_HOST` to the config schema and pass it here.

---

## Common Errors

| Symptom | Cause | Fix |
|---|---|---|
| `401 Unauthorized` on webhook | `GITLAB_WEBHOOK_SECRET` mismatch | Verify the secret in GitLab Settings matches `GITLAB_WEBHOOK_SECRET` exactly |
| `403 Forbidden` when posting comments | `GITLAB_ACCESS_TOKEN` missing `api` scope | Regenerate the token with the `api` scope |
| `404 Not Found` on project | Token does not have access to the project | Ensure the token owner is a member of the project |
| `422` when creating discussion | Line number out of range for the diff | The diff position data may be stale; check that `headSha`, `baseSha`, and `startSha` match the MR's current diff refs |
| `200 ignored` in delivery log | MR action is not `open`, `reopen`, or `update` | Expected — other MR events (e.g. `merge`, `close`) are intentionally ignored |
| Webhook not triggered | SSL verification failed | Add the reviewer's certificate to GitLab's trust store or disable SSL verification on a private network |
