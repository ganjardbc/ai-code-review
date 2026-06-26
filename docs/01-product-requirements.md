# Product Requirements Document (PRD)

## Vision
The AI Code Reviewer is a self-hosted, scalable, and secure platform designed to automate code reviews directly within the engineering workflow. By integrating seamlessly with GitHub and GitLab, it analyzes pull/merge request diffs using state-of-the-art AI models, providing high-quality, actionable feedback in seconds. This reduces code review cycles, enhances code quality, and allows senior engineers to focus on architecture and complex business logic instead of style guidelines or standard bugs.

## Goals
* **Automate Routine Reviews**: Catch syntax issues, logical bugs, formatting, security vulnerabilities, and code smell patterns automatically.
* **Low Latency & High Reliability**: Provide feedback within a few minutes of PR/MR creation or updates.
* **Self-Hosted & Private**: Allow organizations to run the service within their own infrastructure (using Docker/Docker Compose) to preserve intellectual property and code privacy.
* **Extensible Platform Architecture**: Design the codebase following Clean Architecture principles so that additional VCS adapters, AI models, custom lint rules, and databases can be easily integrated in future phases.

## MVP Features
The MVP focuses on executing the core loop of an automated code review:

1. **VCS Integrations (GitHub & GitLab)**:
   * Support receiving and validating standard Webhook events (e.g., Pull Request opened/synchronized for GitHub, Merge Request opened/updated for GitLab).
   * Verify signature headers (webhook secrets) for secure payload handling.
2. **Review Queue Management**:
   * Use BullMQ backed by Redis to manage incoming review tasks asynchronously, ensuring that high volumes of webhooks do not overwhelm the system or lose review requests.
3. **Repository Workspace Operations**:
   * Temporarily clone the repository to a local sandbox directory using `simple-git`.
   * Check out the target PR/MR branch and pull changes.
   * Generate standard git diffs comparing the source branch with the destination branch.
4. **AI Review Execution**:
   * Send the generated diff along with system instruction prompts to **OpenCode** via **9Router** API.
   * Require structured JSON output detailing specific comments, files, line numbers, and severities.
5. **VCS Comment Posting**:
   * Parse the structured JSON response.
   * Post inline review comments on the exact files and lines of the PR/MR.
6. **Logging & Monitoring**:
   * Provide comprehensive logging (using Pino via Fastify) for traceability.
   * Expose a standard Health Check endpoint (`/health`) for status reporting.

## Non-Goals (Out of Scope for MVP)
To maintain focus and speed of delivery, the following features are explicitly out of scope for the MVP:
* User registration, authentication, and permission management (RBAC).
* A web dashboard UI or configuration interface.
* Billing, usage quotas, or multi-tenant workspace separation.
* Detailed analytics, review metrics, or performance dashboards.
* Storing conversation history with the AI or supporting multi-turn review conversations.
* Multi-tenancy isolation at the database level.

## Success Criteria
* **Execution Time**: The turnaround time from Webhook receipt to comment posting on a small-to-medium PR/MR (under 100 files changed) is less than 90 seconds.
* **Fault Tolerance**: The system gracefully handles network failures, API rate limits (GitHub/GitLab/9Router), and Git checkout errors using queue retries without crashing.
* **Zero Resource Leaks**: Cloned repositories are fully cleaned up from the workspace directory immediately after execution, regardless of whether the review succeeded or failed.
