# Goal
Implement the GitLab VCS provider integration.

# Scope
Create the GitLab integration adapter using GitBeaker to post review discussions.

# Prerequisites
* Node setup (`000-foundation`).
* Config loader (`001-configuration`).

# Deliverables
* `src/infrastructure/vcs/gitlab.service.ts` adapter implementation.

# Tasks
- [ ] Install packages: `pnpm add @gitbeaker/rest`
- [ ] Create `GitlabService` in `src/infrastructure/vcs/gitlab.service.ts` implementing `IVcsClient`.
- [ ] Initialize `GitBeaker` client using `GITLAB_ACCESS_TOKEN`.
- [ ] Implement `postComments` calling Merge Request Discussions API (`POST /projects/{id}/merge_requests/{merge_request_iid}/discussions`).
- [ ] Handle rate limits and authorization faults.

# Acceptance Criteria
* Discussions are posted successfully inline on merge requests.
* Network and credential issues are caught and logged.

# Testing Checklist
* **Unit Test**: Mock `@gitbeaker/rest` methods and assert API call structures.
* **Integration Test**: Post test comment payload to a mock GitLab project.
* **Manual Test**: None.
* **Failure Scenarios**: Check that invalid GitLab URLs throw clean connectivity errors.

# Risks
* GitLab project ID mappings. Ensure path-encoded repository names are parsed.

# Notes
GitLab uses discussions instead of isolated comments.
