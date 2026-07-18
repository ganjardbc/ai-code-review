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

function redactCredentials(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '';
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function isNonFastForwardError(err: unknown): boolean {
  // Deliberately excludes the generic "rejected" substring: branch-protection
  // and pre-receive-hook denials also say "[remote rejected] ... declined"
  // but aren't a real conflict, so retrying via rebase would be pointless.
  return err instanceof GitError && /non-fast-forward|fetch first/i.test(err.message);
}

async function ensureFullHistory(targetDir: string): Promise<void> {
  const isShallow = (await runGit(['rev-parse', '--is-shallow-repository'], targetDir)).trim();
  if (isShallow === 'true') {
    await runGit(['fetch', '--unshallow', 'origin'], targetDir);
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

    logger.info('Cloning repository', undefined, { repoUrl: redactCredentials(repoUrl), branch });

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

    try {
      return await runGit(
        ['diff', `origin/${baseBranch}...${headBranch}`, '--', '.'],
        targetDir,
      );
    } catch (err) {
      // Shallow history (CLONE_DEPTH) can leave head/base without a common
      // ancestor for branches that diverged further back. Deepen to full
      // history and retry once rather than failing or producing a bad diff.
      logger.warn('Diff failed at shallow depth, retrying with full history', undefined, { baseBranch, headBranch });
      await ensureFullHistory(targetDir);
      return runGit(
        ['diff', `origin/${baseBranch}...${headBranch}`, '--', '.'],
        targetDir,
      ).catch(() => {
        throw err;
      });
    }
  }

  async commitAll(targetDir: string, message: string): Promise<boolean> {
    assertInsideWorkspace(targetDir);

    await runGit(['add', '-A'], targetDir);

    const status = await runGit(['status', '--porcelain'], targetDir);
    if (!status.trim()) {
      logger.info('No changes to commit', undefined, { targetDir });
      return false;
    }

    await runGit(
      [
        '-c', 'user.name=ai-code-review-bot',
        '-c', 'user.email=ai-code-review-bot@users.noreply.github.com',
        'commit',
        '-m', message,
      ],
      targetDir,
    );

    logger.info('Committed fix changes', undefined, { targetDir });
    return true;
  }

  async push(targetDir: string, remoteUrl: string, branch: string): Promise<void> {
    assertInsideWorkspace(targetDir);

    try {
      await this.attemptPush(targetDir, remoteUrl, branch);
    } catch (err) {
      if (!isNonFastForwardError(err)) {
        throw err;
      }

      logger.warn('Push rejected — branch moved since clone, rebasing onto latest remote commit', undefined, { branch });
      await ensureFullHistory(targetDir);
      await runGit(['fetch', '--', remoteUrl, branch], targetDir);

      try {
        await runGit(['rebase', 'FETCH_HEAD'], targetDir);
      } catch (rebaseErr) {
        await runGit(['rebase', '--abort'], targetDir).catch(() => undefined);
        const msg = rebaseErr instanceof Error ? rebaseErr.message : String(rebaseErr);
        throw new GitError(`Push rejected and rebase onto latest ${branch} failed, likely a real conflict: ${msg}`);
      }

      await this.attemptPush(targetDir, remoteUrl, branch);
    }
  }

  private async attemptPush(targetDir: string, remoteUrl: string, branch: string): Promise<void> {
    logger.info('Pushing fix commit', undefined, { branch });
    await runGit(['push', '--', remoteUrl, `HEAD:refs/heads/${branch}`], targetDir);
  }
}
