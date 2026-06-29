export interface ReviewNotification {
  jobId: string;
  provider: 'github' | 'gitlab';
  repoLabel: string;
  prNumber: number;
  commentCount: number;
  durationMs: number;
  prUrl?: string;
}

export interface ReviewFailureNotification {
  jobId: string;
  provider: 'github' | 'gitlab';
  repoLabel: string;
  prNumber: number;
  errorMessage: string;
}

export interface INotifier {
  notifyReviewComplete(info: ReviewNotification): Promise<void>;
  notifyReviewFailed(info: ReviewFailureNotification): Promise<void>;
}
