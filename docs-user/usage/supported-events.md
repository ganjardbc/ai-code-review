# Supported Events

The AI Code Reviewer responds only to events that indicate new or updated code needing review. All other events are acknowledged but intentionally ignored.

---

## GitHub Events

The webhook must be configured to send **Pull requests** events (see [GitHub Integration](../integrations/github.md)).

| Event type | Action | Triggers review? | Notes |
|---|---|---|---|
| `pull_request` | `opened` | **Yes** | New PR created |
| `pull_request` | `synchronize` | **Yes** | New commits pushed to an existing PR |
| `pull_request` | `reopened` | **Yes** | Previously closed PR re-opened |
| `pull_request` | `closed` | No | Ignored |
| `pull_request` | `merged` | No | Sent as `closed` with `merged: true`; ignored |
| `pull_request` | `labeled` | No | Ignored |
| `pull_request` | `unlabeled` | No | Ignored |
| `pull_request` | `assigned` | No | Ignored |
| `pull_request` | `review_requested` | No | Ignored |
| `pull_request` | `ready_for_review` | No | Ignored |
| `push` | — | No | Push events are not subscribed; only PR events |
| `pull_request_review_comment` | — | No | Comment-only events do not trigger re-review |
| `issue_comment` | — | No | Issue and PR comments do not trigger review |

### Response for Ignored GitHub Actions

```json
HTTP/1.1 200 OK
{ "status": "ignored", "action": "labeled" }
```

---

## GitLab Events

The webhook must be configured to send **Merge request events** (see [GitLab Integration](../integrations/gitlab.md)).

| Event type | Action (`object_attributes.action`) | Triggers review? | Notes |
|---|---|---|---|
| `Merge Request Hook` | `open` | **Yes** | New MR created |
| `Merge Request Hook` | `update` | **Yes** | New commits pushed to an existing MR |
| `Merge Request Hook` | `reopen` | **Yes** | Previously closed MR re-opened |
| `Merge Request Hook` | `close` | No | Ignored |
| `Merge Request Hook` | `merge` | No | Ignored |
| `Merge Request Hook` | `approved` | No | Ignored |
| `Merge Request Hook` | `unapproved` | No | Ignored |
| `Push Hook` | — | No | Push events are not subscribed |
| `Note Hook` | — | No | Comment events do not trigger review |
| `Pipeline Hook` | — | No | CI pipeline events do not trigger review |

### Response for Ignored GitLab Actions

```json
HTTP/1.1 200 OK
{ "status": "ignored", "action": "close" }
```

---

## What Triggers a Review

A review is triggered when **all** of the following are true:

1. The webhook payload passes cryptographic signature verification.
2. The event type is `pull_request` (GitHub) or `Merge Request Hook` (GitLab).
3. The action is in the supported set (`opened`/`synchronize`/`reopened` for GitHub; `open`/`update`/`reopen` for GitLab).
4. Both `headRef` and `baseRef` branch names pass the safety regex (`[a-zA-Z0-9_\-\/\.:]+`).
5. The payload matches the expected Zod schema.

---

## What Does NOT Trigger a Review

| Scenario | Reason |
|---|---|
| A push to a branch without an open PR/MR | Push events are not subscribed |
| Adding a label or assignee to a PR/MR | Action is not in the supported set |
| Commenting on a PR/MR | Comment events are not subscribed |
| Merging or closing a PR/MR | These actions are explicitly ignored |
| Approving or unapproving a GitLab MR | Action not in the supported set |
| A PR/MR with only lockfile or asset changes | Diff filtering removes these files; if no reviewable content remains, the job skips AI and posts no comments |
| An empty diff | Worker detects empty diff and exits without calling the AI |
| CI pipeline events | Not subscribed |

---

## Re-triggering a Review Manually

There is no API endpoint for manual re-trigger in the MVP. To force a re-review:

- **GitHub:** Push an empty commit to the PR branch (`git commit --allow-empty -m "trigger review"`) — this sends a `synchronize` action.
- **GitLab:** Use the **Redeliver** button in **Project → Settings → Webhooks → Recent events** to replay a previous delivery.

---

## Duplicate Reviews

Each `synchronize` or `update` event triggers a new independent review job. If multiple commits are pushed in quick succession, multiple review jobs may queue and each post its own set of comments on the PR/MR. This is by design — each review reflects the diff at the time its commit was received.
