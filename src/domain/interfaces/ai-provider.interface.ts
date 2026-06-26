export interface AiReviewComment {
  filePath: string;
  lineNumber: number;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface ReviewResult {
  comments: AiReviewComment[];
}

export interface IAiProvider {
  review(prompt: string): Promise<ReviewResult>;
}
