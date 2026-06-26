# Review Orchestrator Specification

## Purpose
Expose the core application Use Case orchestrating git, AI, and comment posting stages.

## Responsibilities
* Orchestrate the flow of review operations.
* Build sandbox workspaces using dynamic UUIDs.
* Trigger Git shallow clone.
* Enforce prompt diff limits (40KB).
* Post reviews inline.
* Verify sandbox workspaces are cleared post-run.

## Dependencies
* Internal: `IGitService`, `IAiProvider`, `IScmProvider`.

## Public Interfaces
```typescript
export interface ReviewPayload {
  repositoryUrl: string;
  sourceBranch: string;
  targetBranch: string;
  pullRequestNumber: number;
  commitSha: string;
  provider: 'github' | 'gitlab';
}

export class ProcessReviewUseCase {
  constructor(
    private readonly gitService: IGitService,
    private readonly aiProvider: IAiProvider,
    private readonly scmProviderFactory: IScmProviderFactory
  ) {}

  execute(payload: ReviewPayload): Promise<void>;
}
```

## Data Flow
1. Receive `ReviewPayload` input parameters.
2. Initialize SCM Provider based on provider tag.
3. Call `gitService.clone()` and check out target commit branch inside sandboxed directory.
4. Compute unified diff.
5. Build context prompt verifying 40KB size thresholds.
6. Call `aiProvider.review()` returning structured JSON array of findings.
7. Validate array schema.
8. Call `scmProvider.postReview()` posting inline comments to VCS pull requests.
9. Recursive cleanup.
