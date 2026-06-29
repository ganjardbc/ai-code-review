import { z } from 'zod';

export const severityLevels = ['INFO', 'WARNING', 'CRITICAL'] as const;

export const repoConfigSchema = z.object({
  ignore_files: z.array(z.string()).default([]),
  prompt_extra: z.string().max(2000).optional(),
  min_severity: z.enum(severityLevels).default('INFO'),
});

export type RepoConfig = z.infer<typeof repoConfigSchema>;

export interface IRepoConfigLoader {
  load(repoPath: string): Promise<RepoConfig>;
}
