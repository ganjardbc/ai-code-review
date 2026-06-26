# Release Process

How to cut a new release of the AI Code Reviewer. Releases follow [Semantic Versioning](https://semver.org/).

---

## Versioning Scheme

| Change Type | Version Bump | Example |
|------------|-------------|---------|
| Bug fix, documentation, internal refactor | Patch | `1.0.0` → `1.0.1` |
| New feature, new env var (backward compatible) | Minor | `1.0.0` → `1.1.0` |
| Breaking change (env var renamed, API changed, Docker image structure changed) | Major | `1.0.0` → `2.0.0` |

**What counts as breaking:**
- Renaming or removing an environment variable
- Changing the HTTP API response format for existing endpoints
- Changing the BullMQ job payload schema in a way that invalidates queued jobs
- Dropping support for a Node.js major version
- Changing the Docker image's default user or file paths

**What does not count as breaking:**
- Adding a new optional environment variable
- Adding a new HTTP endpoint
- Adding new log fields
- Internal refactors with no external behavior change

---

## Release Checklist

### 1. Prepare the Release Branch (for significant changes)

For patch releases, commit directly to `main`. For minor/major releases:

```bash
git checkout -b release/v1.2.0 main
```

### 2. Update Version in `package.json`

```bash
pnpm version minor   # or major, patch
# This updates package.json and creates a git tag automatically
```

Or manually:

```bash
# Edit package.json
# "version": "1.1.0"

git add package.json
git commit -m "chore: bump version to 1.2.0"
```

### 3. Update CHANGELOG.md

Add a new entry following the [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [1.2.0] - 2024-01-15

### Added
- GitLab support for merge request reviews
- `WORKER_CONCURRENCY` environment variable to control parallel jobs

### Fixed
- Workspace cleanup no longer fails when directory does not exist

### Changed
- Health endpoint now includes Redis connection status in response body
```

### 4. Run Full Verification

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test --run
pnpm build
```

All four commands must pass with zero errors.

### 5. Create and Push the Git Tag

```bash
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin main
git push origin v1.2.0
```

### 6. Build and Tag the Docker Image

```bash
# Build with version tag and latest
docker build \
  -t ai-code-reviewer:1.2.0 \
  -t ai-code-reviewer:latest \
  .

# Push to registry
docker push registry.example.com/ai-code-reviewer:1.2.0
docker push registry.example.com/ai-code-reviewer:latest
```

### 7. Create a GitHub Release

```bash
gh release create v1.2.0 \
  --title "v1.2.0 — GitLab Support" \
  --notes-file release-notes.md \
  --verify-tag
```

Or manually via GitHub UI: go to Releases → Draft a new release → select the tag.

---

## Post-Release

### Verify the Release

```bash
# Pull the new image and verify
docker pull registry.example.com/ai-code-reviewer:1.2.0
docker run --rm \
  -e PORT=3000 \
  -e REDIS_URL=redis://redis:6379 \
  registry.example.com/ai-code-reviewer:1.2.0 \
  node dist/presentation/web/server.js &
curl http://localhost:3000/health
```

### Update Deployments

For Docker Compose deployments:

```bash
# Update the image tag in docker-compose.yml
# image: registry.example.com/ai-code-reviewer:1.2.0

docker compose pull
docker compose up -d
```

### Announce the Release

Notify the team via your preferred channel. Include:
- What changed (link to CHANGELOG)
- Whether migration steps are needed (env var changes, Docker volume changes)
- Whether a rolling restart or maintenance window is required

---

## Hotfix Release

For critical bugs in production:

```bash
# Branch from the release tag, not main
git checkout -b hotfix/v1.2.1 v1.2.0

# Fix the bug
# ...

# Bump patch version
pnpm version patch

# Update CHANGELOG
# Create tag and push
git push origin hotfix/v1.2.1
git tag -a v1.2.1 -m "Hotfix: fix workspace cleanup race condition"
git push origin v1.2.1

# Merge back to main
git checkout main
git merge hotfix/v1.2.1
git push origin main
```
