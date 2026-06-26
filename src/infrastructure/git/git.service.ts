import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import type { IGitService } from '../../domain/interfaces/git.interface.js';
import { config } from '../../config/index.js';
import { GitError, ValidationError } from '../../domain/errors/app-errors.js';
import { logger } from '../logging/logger.js';

const WORKSPACE_ROOT = resolve(config.WORKSPACE_DIR);
const CLONE_DEPTH = 50;

const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_ASKPASS: 'echo',
};

function assertInsideWorkspace(dirPath: string): void {
  const resolved = resolve(dirPath);
  if (!resolved.startsWith(WORKSPACE_ROOT + '/') && resolved !== WORKSPACE_ROOT) {
    throw new ValidationError(`Path escape attempt detected: ${dirPath}`);
  }
}

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      cwd,
      env: GIT_ENV,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];

    proc.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => err.push(chunk));

    proc.on('close', (code, signal) => {
      if (code === 0) {
        resolve(Buffer.concat(out).toString('utf-8'));
      } else {
        const msg = Buffer.concat(err).toString('utf-8').trim();
        reject(new GitError(`git ${args[0]} failed (${code ?? signal}): ${msg}`));
      }
    });

    proc.on('error', (spawnErr) => {
      reject(new GitError(`git spawn error: ${spawnErr.message}`));
    });
  });
}

export class GitService implements IGitService {
  async clone(repoUrl: string, branch: string, targetDir: string): Promise<void> {
    assertInsideWorkspace(targetDir);

    logger.info('Cloning repository', undefined, { repoUrl, branch });

    await runGit(
      [
        'clone',
        '--depth', String(CLONE_DEPTH),
        '--single-branch',
        '--branch', branch,
        '--',
        repoUrl,
        targetDir,
      ],
      WORKSPACE_ROOT,
    );

    logger.debug('Clone complete', undefined, { targetDir });
  }

  async checkout(targetDir: string, commitSha: string): Promise<void> {
    assertInsideWorkspace(targetDir);

    if (!/^[0-9a-f]{7,40}$/i.test(commitSha)) {
      throw new ValidationError(`Invalid commit SHA: ${commitSha}`);
    }

    logger.debug('Checking out commit', undefined, { commitSha });
    await runGit(['checkout', '--detach', commitSha], targetDir);
  }

  async generateDiff(targetDir: string, baseBranch: string, headBranch: string): Promise<string> {
    assertInsideWorkspace(targetDir);

    logger.debug('Fetching base branch for diff', undefined, { baseBranch });

    // Allow fetching any branch (--single-branch restricts refspecs by default)
    await runGit(
      ['remote', 'set-branches', 'origin', '*'],
      targetDir,
    );

    await runGit(
      ['fetch', 'origin', baseBranch, `--depth=${CLONE_DEPTH}`],
      targetDir,
    );

    const diff = await runGit(
      ['diff', `origin/${baseBranch}...${headBranch}`, '--', '.'],
      targetDir,
    );

    return diff;
  }
}
