# GitHub Provider Specification

## Purpose
Expose GitHub integration API adapters.

## Responsibilities
* Post inline comments to exact lines on GitHub pull requests.

## Dependencies
* External: `@octokit/rest`.
* Internal: `IScmProvider`.

## Public Interfaces
```typescript
export interface IScmProvider {
  postReview(pullRequestNumber: number, comments: AiReviewComment[]): Promise<void>;
}
```

* **API Endpoints Called**:
  * `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews` to create reviews with multiple inline comments.
  * Parameters passed match: `commit_id`, `event: "COMMENT"`, and `comments` array containing `path`, `line`, `side: "RIGHT"`, and `body`.
