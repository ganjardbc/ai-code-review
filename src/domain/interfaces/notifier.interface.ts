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

export interface FixNotification {
  jobId: string;
  provider: 'github' | 'gitlab';
  repoLabel: string;
  prNumber: number;
  filesFixed: number;
  durationMs: number;
  prUrl?: string;
}

export interface FixFailureNotification {
  jobId: string;
  provider: 'github' | 'gitlab';
  repoLabel: string;
  prNumber: number;
  errorMessage: string;
}

export interface INotifier {
  notifyReviewComplete(info: ReviewNotification): Promise<void>;
  notifyReviewFailed(info: ReviewFailureNotification): Promise<void>;
  notifyFixComplete(info: FixNotification): Promise<void>;
  notifyFixFailed(info: FixFailureNotification): Promise<void>;
}
