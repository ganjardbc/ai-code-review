export interface IQueue {
  addJob(name: string, data: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

export interface JobPayload {
  jobId: string;
  jobType: 'review' | 'fix';
  provider: 'github' | 'gitlab';
  cloneUrl: string;
  headRef: string;
  baseRef: string;
  headSha: string;
  prNumber?: number;
  mrIid?: number;
  repoOwner?: string;
  repoName?: string;
  projectId?: number;
  baseSha?: string;
  startSha?: string;
}

export type JobRunner = (job: { name: string; data: JobPayload; id: string }) => Promise<void>;
