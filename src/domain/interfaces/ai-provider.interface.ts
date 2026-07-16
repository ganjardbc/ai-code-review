export interface AiReviewComment {
  filePath: string;
  lineNumber: number;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface ReviewResult {
  comments: AiReviewComment[];
}

export interface FileFix {
  filePath: string;
  content: string;
}

export interface FixResult {
  fixes: FileFix[];
}

export interface IAiProvider {
  review(prompt: string): Promise<ReviewResult>;
  fix(prompt: string): Promise<FixResult>;
}
