# Changelog Guide

How to maintain `CHANGELOG.md` for this project.

---

## Format

This project follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Every user-visible change is documented here so operators can assess the impact of an upgrade before applying it.

### File Location

```
CHANGELOG.md  (at the project root)
```

---

## Entry Structure

```markdown
## [Unreleased]

### Added
- Description of new feature

### Changed
- Description of changed behavior

### Fixed
- Description of bug fix

### Removed
- Description of removed feature

### Deprecated
- Description of deprecated feature (still works, will be removed)

### Security
- Description of security fix

---

## [1.2.0] - 2024-03-15

### Added
- GitLab merge request webhook support
- `WORKER_CONCURRENCY` environment variable for controlling parallel job processing

### Fixed
- Workspace directory no longer leaks when git clone fails with a network error
```

---

## Change Categories

| Category | What Goes Here |
|----------|---------------|
| **Added** | New features, new endpoints, new environment variables |
| **Changed** | Behavioral changes to existing features, updated defaults, changed log formats |
| **Fixed** | Bug fixes |
| **Removed** | Features or environment variables that have been removed |
| **Deprecated** | Features that still work but will be removed in a future version |
| **Security** | Fixes for security vulnerabilities — always include the CVE or description |

---

## Versioning Rules

This project uses [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

### PATCH — Bug Fixes Only

Increment patch for:
- Bug fixes that do not change any external interface
- Documentation corrections
- Internal refactors with no behavior change
- Dependency updates that fix security issues (no API changes)

```
1.0.0 → 1.0.1
```

### MINOR — Backward-Compatible New Features

Increment minor for:
- New environment variables with a default value (existing deployments work without change)
- New HTTP endpoints
- New VCS provider support (existing provider behavior unchanged)
- New AI provider support
- New log fields (additive)

```
1.0.0 → 1.1.0
```

### MAJOR — Breaking Changes

Increment major for any change that requires existing deployments to take action:

| Breaking Change | Example |
|----------------|---------|
| Environment variable renamed | `REDIS_URL` → `QUEUE_REDIS_URL` |
| Environment variable removed | Removing `QUEUE_MAX_JOBS_RETAINED` |
| Required new environment variable | Adding `GITLAB_BASE_URL` with no default |
| HTTP endpoint URL changed | `/webhooks/github` → `/api/webhooks/github` |
| Response format changed | Renaming `status` to `result` in health response |
| Docker image breaking changes | Changing default user, changing file paths |
| Node.js version dropped | Dropping Node 20 support |

```
1.0.0 → 2.0.0
```

---

## Writing Good Entries

### Be User-Focused

Describe the change from the operator's perspective, not the implementation detail.

**Bad:**
```
- Refactored GitHubService to use the new diff endpoint
```

**Good:**
```
- GitHub integration now uses the Files API instead of the raw diff URL, improving accuracy for large PRs
```

### Migration Notes for Breaking Changes

When a breaking change requires operator action, include explicit migration steps:

```markdown
### Changed
- **BREAKING:** `REDIS_URL` has been renamed to `QUEUE_REDIS_URL`

  **Migration:** Update your `.env` file:
  ```
  # Before
  REDIS_URL=redis://localhost:6379

  # After
  QUEUE_REDIS_URL=redis://localhost:6379
  ```
  Restart all services after updating.
```

### Security Entries

Always describe security fixes, even if brief. Include severity and impact:

```markdown
### Security
- Fixed HMAC signature comparison using string equality instead of `timingSafeEqual`, which was vulnerable to timing attacks. Upgrade recommended for all production deployments. (CWE-208)
```

---

## Unreleased Section

Keep an `[Unreleased]` section at the top for changes on `main` that have not been tagged yet. This makes it easy to draft release notes:

```markdown
## [Unreleased]

### Added
- Bitbucket Cloud webhook support

### Fixed
- Worker no longer retries jobs when the repository is not found (404) — saves unnecessary retries for deleted repositories
```

When you cut a release, rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` and add a new empty `[Unreleased]` section above it.

---

## Linking Versions

At the bottom of `CHANGELOG.md`, add diff links for each version:

```markdown
[Unreleased]: https://github.com/your-org/ai-code-reviewer/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/your-org/ai-code-reviewer/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/your-org/ai-code-reviewer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/your-org/ai-code-reviewer/releases/tag/v1.0.0
```

These links allow readers to click a version number and see the full diff on GitHub.
