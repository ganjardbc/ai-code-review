import type { JobPayload } from '../../domain/interfaces/queue.interface.js';

export function buildPrUrl(job: JobPayload): string | undefined {
  if (job.provider === 'github' && job.repoOwner && job.repoName && job.prNumber) {
    return `https://github.com/${job.repoOwner}/${job.repoName}/pull/${job.prNumber}`;
  }
  if (job.provider === 'gitlab' && job.mrIid) {
    const url = new URL(job.cloneUrl);
    url.username = '';
    url.password = '';
    const base = url.toString().replace(/\.git$/, '');
    return `${base}/-/merge_requests/${job.mrIid}`;
  }
  return undefined;
}

export function repoLabel(job: JobPayload): string {
  if (job.repoOwner && job.repoName) return `${job.repoOwner}/${job.repoName}`;
  return job.repoName ?? String(job.projectId ?? 'unknown');
}
