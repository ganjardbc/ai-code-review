# Goal
Coordinate the entire code review workflow pipeline.

# Scope
Create the application-layer `ProcessReview` use case orchestrating Git clone, diffing, AI analysis, payload validation, and posting findings.

# Prerequisites
* Git operations (`008-git`).
* Prompt engine (`009-prompt-engine`).
* AI runner (`010-ai-runner`).
* Review parser (`011-review-parser`).
* VCS clients (`012-github-provider`, `013-gitlab-provider`).

# Deliverables
* `src/application/use-cases/process-review.use-case.ts` orchestration layer.

# Tasks
- [ ] Create `ProcessReviewUseCase` class.
- [ ] Implement constructor injecting dependency interfaces: `IGitService`, `IAiProvider`, `IVcsClientFactory` (or separate clients).
- [ ] Implement `execute` routine receiving job details:
  * Create sandbox workspace path using a new UUID v4.
  * Trigger Git shallow branch clone.
  * Generate diff.
  * Build system and context prompts (enforcing 40KB limits).
  * Call AI runner.
  * Validate JSON payload output.
  * Post inline comments using matching VCS client.
  * Clean up sandboxed workspace paths recursively in a `finally` execution block.

# Acceptance Criteria
* Review jobs execute end-to-end.
* Webhook trigger metadata successfully initiates VCS comment postings.
* Workspace cleanup always runs, even if Git or AI calls fail.

# Testing Checklist
* **Unit Test**: Test use case execution step sequence by mocking all dependencies.
* **Integration Test**: Run end-to-end integration test with local git mock, fake AI gateway, and VCS client stubs.
* **Manual Test**: None.
* **Failure Scenarios**: Verify that failing to parse AI JSON response triggers cleanup logic and throws validation error.

# Risks
* Concurrency race conditions. Ensure UUID folders isolate workspaces.

# Notes
Ensure all operations log progress to Pino for debugging.
