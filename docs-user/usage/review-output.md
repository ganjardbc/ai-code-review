# Review Output

This document describes how AI review comments appear on GitHub pull requests and GitLab merge requests, the severity model, and the underlying JSON schema.

---

## AI Response JSON Schema

OpenCode is instructed to return a JSON object matching this schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["comments"],
  "properties": {
    "comments": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["filePath", "lineNumber", "message", "severity"],
        "properties": {
          "filePath": {
            "type": "string",
            "description": "Relative path from the repository root"
          },
          "lineNumber": {
            "type": "integer",
            "description": "Line number in the new (right-hand) version of the file"
          },
          "message": {
            "type": "string",
            "description": "Actionable description of the issue and how to fix it"
          },
          "severity": {
            "type": "string",
            "enum": ["INFO", "WARNING", "CRITICAL"]
          }
        },
        "additionalProperties": true
      }
    }
  },
  "additionalProperties": true
}
```

Validation is performed by Ajv. Comments that fail per-item validation are dropped with a warning log rather than failing the entire review.

---

## Severity Levels

| Severity | Visual prefix | Meaning | Typical examples |
|---|---|---|---|
| `INFO` | `[INFO]` | Non-blocking improvement suggestion | Simplify a conditional, add a missing null check, improve variable name clarity |
| `WARNING` | `[WARNING]` | Potential bug, security smell, or maintainability concern | Unhandled promise rejection, missing error boundary, deprecated API usage, possible race condition |
| `CRITICAL` | `[CRITICAL]` | Definite bug, exploitable vulnerability, or data loss risk | SQL injection, hardcoded secret, unvalidated user input passed to `eval`, off-by-one causing buffer overflow |

There is no notion of severity filtering in the MVP — all severity levels are posted as comments.

---

## Where Comments Appear

### GitHub Pull Requests

Comments are posted as a **pull request review** using `octokit.pulls.createReview`. All comments from a single AI review are submitted in one batch with `event: 'COMMENT'` (non-approving, non-requesting-changes). Each comment is an inline comment anchored to a specific file and line on the right-hand (new) side of the diff.

Comment body format on GitHub:

```
**[CRITICAL]** Hardcoded secret detected in `config.ts`. Move this value to an
environment variable and add the file to `.gitignore`.
```

### GitLab Merge Requests

Comments are posted as **merge request discussions** using `@gitbeaker/rest`. Each comment creates a separate discussion thread anchored to a specific file, line, and commit SHA set (`baseSha`, `startSha`, `headSha`).

Comment body format on GitLab:

```
**[WARNING]** The `setTimeout` callback captures `userId` by reference.
If `userId` changes before the callback fires, the wrong user context will be used.
Use a closure or copy the value at call time.
```

---

## Inline Comment Positioning

| Platform | Anchoring method |
|---|---|
| GitHub | `path` + `line` + `side: RIGHT` on the review commit |
| GitLab | `newPath` + `newLine` + diff refs (`baseSha`, `startSha`, `headSha`) |

Line numbers refer to the **new file version** (added lines and their context). If the AI returns a line number that is not present in the diff, the VCS API will return a `422 Unprocessable Entity` and the comment will be skipped.

---

## Truncation Notice

When the diff exceeds the 40 KB limit, not all files are reviewed. In this case the prompt sent to OpenCode includes:

```
[TRUNCATED: diff exceeded 40KB limit. Some files were omitted from this review.]
```

OpenCode is instructed to communicate this as a comment if it detects the notice. The truncation notice is appended to the prompt, not posted separately — if OpenCode does not reflect it in its comments, no truncation notice will appear on the PR/MR in the MVP.

> **Tip:** Keep PRs focused. Large diffs reduce review coverage and increase AI latency.

---

## Example Review Output

### Raw JSON from AI

```json
{
  "comments": [
    {
      "filePath": "src/auth/token.service.ts",
      "lineNumber": 23,
      "message": "Using Math.random() for token generation is not cryptographically secure. Use crypto.randomBytes() instead.",
      "severity": "CRITICAL"
    },
    {
      "filePath": "src/auth/token.service.ts",
      "lineNumber": 41,
      "message": "Token expiry is not validated before use. Add an expiry check to prevent replaying expired tokens.",
      "severity": "WARNING"
    },
    {
      "filePath": "src/utils/logger.ts",
      "lineNumber": 12,
      "message": "Consider using structured logging (JSON) for easier log aggregation in production.",
      "severity": "INFO"
    }
  ]
}
```

### How It Appears on GitHub

Each entry in `comments` becomes an inline comment on the PR diff. The comment body is formatted as:

```
**[CRITICAL]** Using Math.random() for token generation is not cryptographically secure.
Use crypto.randomBytes() instead.
```

All three comments are submitted in one `createReview` API call, appearing together under a single "AI Code Reviewer" review.

---

## When No Comments Are Posted

The reviewer posts no comments in these cases:

| Reason | Log message |
|---|---|
| Diff is empty (no reviewable changes) | `Empty diff — skipping review` |
| All diff files were filtered out (lockfiles, assets) | `No comments to post` (after AI returns `[]`) |
| AI returned `{ "comments": [] }` | `No comments to post` |
| All AI comments failed schema validation | Comments dropped with warning; nothing posted |
| VCS API returned errors for all comments | Errors logged; job may retry |
