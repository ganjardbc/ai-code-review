import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from '../../config/index.js';
import { ValidationError } from '../../domain/errors/app-errors.js';
import { logger } from '../logging/logger.js';

const WORKSPACE_ROOT = resolve(config.WORKSPACE_DIR);

export function assertSafeWorkspacePath(dirPath: string): void {
  const resolved = resolve(dirPath);
  if (!resolved.startsWith(WORKSPACE_ROOT + '/') && resolved !== WORKSPACE_ROOT) {
    throw new ValidationError(`Cleanup path escape attempt detected: ${dirPath}`);
  }
}

export async function cleanupWorkspace(dirPath: string): Promise<void> {
  assertSafeWorkspacePath(dirPath);

  try {
    await rm(dirPath, { recursive: true, force: true });
    logger.debug('Workspace cleaned up', undefined, { path: dirPath });
  } catch (err) {
    logger.error(
      'Failed to cleanup workspace (non-fatal)',
      err instanceof Error ? err : new Error(String(err)),
      { path: dirPath },
    );
  }
}
