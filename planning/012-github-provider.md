# Goal
Implement the GitHub VCS provider integration.

# Scope
Create the GitHub integration adapter using Octokit to post inline review comments.

# Prerequisites
* Node setup (`000-foundation`).
* Config loader (`001-configuration`).

# Deliverables
* `src/domain/interfaces/vcs-client.interface.ts` port interface.
* `src/infrastructure/vcs/github.service.ts` adapter implementation.

# Tasks
- [ ] Install packages: `pnpm add @octokit/rest`
- [ ] Implement `IVcsClient` port in `src/domain/interfaces/vcs-client.interface.ts`.
- [ ] Create `GithubService` in `src/infrastructure/vcs/github.service.ts`.
- [ ] Initialize `Octokit` using `GITHUB_ACCESS_TOKEN`.
- [ ] Implement `postComments` calling Pull Request Review Comments API (`POST /repos/{owner}/{repo}/pulls/{pull_number}/comments`).
- [ ] Handle rate limits and authorization faults gracefully.

# Acceptance Criteria
* Comments are posted inline on specified files/lines.
* Octokit network errors are caught and logged without breaking process execution.

# Testing Checklist
* **Unit Test**: Mock `@octokit/rest` calls and verify call parameters.
* **Integration Test**: Run integration tests against a mock GitHub repository.
* **Manual Test**: None.
* **Failure Scenarios**: Check behavior when token does not have access permissions to target repository.

# Risks
* GitHub API rate limits. Ensure client handles limit responses.

# Notes
Ensure token scopes are limited strictly to repository pull request read/write.
