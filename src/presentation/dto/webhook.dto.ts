import { z } from 'zod';

export const githubWebhookSchema = z.object({
  action: z.string(),
  number: z.number().int().positive(),
  pull_request: z.object({
    head: z.object({
      ref: z.string().min(1),
      sha: z.string().min(1),
    }),
    base: z.object({
      ref: z.string().min(1),
    }),
  }),
  repository: z.object({
    name: z.string().min(1),
    owner: z.object({
      login: z.string().min(1),
    }),
    clone_url: z.url(),
  }),
});

export type GithubWebhookPayload = z.infer<typeof githubWebhookSchema>;

export const gitlabWebhookSchema = z.object({
  object_kind: z.literal('merge_request'),
  object_attributes: z.object({
    action: z.string(),
    iid: z.number().int().positive(),
    source_branch: z.string().min(1),
    target_branch: z.string().min(1),
    last_commit: z.object({
      id: z.string().min(1),
    }),
    target: z.object({
      git_http_url: z.url(),
    }),
    diff_refs: z.object({
      base_sha: z.string().min(1),
      start_sha: z.string().min(1),
      head_sha: z.string().min(1),
    }).optional(),
  }),
  project: z.object({
    id: z.number().int().positive(),
  }),
});

export type GitlabWebhookPayload = z.infer<typeof gitlabWebhookSchema>;
