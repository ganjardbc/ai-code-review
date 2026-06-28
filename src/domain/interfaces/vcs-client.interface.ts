import type { AiReviewComment } from './ai-provider.interface.js';

export interface PostReviewOptions {
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
  comments: AiReviewComment[];
}

export interface PostMrReviewOptions {
  projectId: number;
  mrIid: number;
  baseSha: string;
  startSha: string;
  headSha: string;
  comments: AiReviewComment[];
}

export interface PullRequestInfo {
  headRef: string;
  baseRef: string;
  headSha: string;
  cloneUrl: string;
}

export interface IGithubClient {
  postReview(options: PostReviewOptions): Promise<void>;
  getPullRequest(owner: string, repo: string, pullNumber: number): Promise<PullRequestInfo>;
}

export interface IGitlabClient {
  postReview(options: PostMrReviewOptions): Promise<void>;
}
