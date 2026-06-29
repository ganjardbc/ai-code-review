import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import YAML from 'yaml';
import { repoConfigSchema, type RepoConfig, type IRepoConfigLoader } from '../../domain/interfaces/repo-config.interface.js';
import { logger } from '../logging/logger.js';

const CONFIG_FILENAME = '.ai-reviewer.yml';
const MAX_CONFIG_BYTES = 10 * 1024;

export const DEFAULT_REPO_CONFIG: RepoConfig = repoConfigSchema.parse({});

export class RepoConfigService implements IRepoConfigLoader {
  async load(repoPath: string): Promise<RepoConfig> {
    const filePath = join(repoPath, CONFIG_FILENAME);

    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      return DEFAULT_REPO_CONFIG;
    }

    if (Buffer.byteLength(raw, 'utf-8') > MAX_CONFIG_BYTES) {
      logger.warn(`${CONFIG_FILENAME} exceeds ${MAX_CONFIG_BYTES} byte limit, using defaults`, undefined, { repoPath });
      return DEFAULT_REPO_CONFIG;
    }

    let parsed: unknown;
    try {
      parsed = YAML.parse(raw);
    } catch (err) {
      logger.warn(`Failed to parse ${CONFIG_FILENAME}, using defaults`, undefined, {
        repoPath,
        error: err instanceof Error ? err.message : String(err),
      });
      return DEFAULT_REPO_CONFIG;
    }

    const result = repoConfigSchema.safeParse(parsed ?? {});
    if (!result.success) {
      logger.warn(`Invalid ${CONFIG_FILENAME} schema, using defaults`, undefined, {
        repoPath,
        errors: result.error.issues.map((i) => i.message),
      });
      return DEFAULT_REPO_CONFIG;
    }

    return result.data;
  }
}

export const repoConfigService = new RepoConfigService();
