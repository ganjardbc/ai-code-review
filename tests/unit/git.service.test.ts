import '../mocks/env.js';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitService } from '../../src/infrastructure/git/git.service.js';

const WORKSPACE_ROOT = '/tmp/ai-reviewer-test';

function git(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

function initBareOrigin(originPath: string): void {
  mkdirSync(originPath, { recursive: true });
  git(['init', '--bare', '--initial-branch=main'], originPath);
}

function seedOrigin(originPath: string): void {
  const seedDir = `${originPath}-seed`;
  mkdirSync(seedDir, { recursive: true });
  git(['init', '--initial-branch=main'], seedDir);
  writeFileSync(join(seedDir, 'file.txt'), 'hello\n');
  git(['add', '-A'], seedDir);
  git(['-c', 'user.name=t', '-c', 'user.email=t@t.com', 'commit', '-m', 'init'], seedDir);
  git(['remote', 'add', 'origin', originPath], seedDir);
  git(['push', 'origin', 'main'], seedDir);
  rmSync(seedDir, { recursive: true, force: true });
}

describe('GitService.commitAll / push', () => {
  let originPath: string;
  let targetDir: string;
  const gitService = new GitService();

  beforeEach(async () => {
    const suffix = Math.random().toString(36).slice(2);
    originPath = join(WORKSPACE_ROOT, `origin-${suffix}.git`);
    targetDir = join(WORKSPACE_ROOT, `clone-${suffix}`);

    initBareOrigin(originPath);
    seedOrigin(originPath);

    await gitService.clone(originPath, 'main', targetDir);
  });

  afterEach(() => {
    rmSync(originPath, { recursive: true, force: true });
    rmSync(targetDir, { recursive: true, force: true });
  });

  it('returns false from commitAll when there are no changes', async () => {
    const committed = await gitService.commitAll(targetDir, 'no-op');
    expect(committed).toBe(false);
  });

  it('commits and pushes local changes to the origin', async () => {
    writeFileSync(join(targetDir, 'file.txt'), 'updated content\n');

    const committed = await gitService.commitAll(targetDir, 'fix: update file');
    expect(committed).toBe(true);

    await gitService.push(targetDir, originPath, 'main');

    const log = execFileSync('git', ['log', '--oneline', 'main'], { cwd: originPath }).toString();
    expect(log).toContain('fix: update file');
  });

  it('rejects paths outside the workspace root', async () => {
    await expect(gitService.commitAll('/tmp/outside-workspace', 'msg')).rejects.toThrow();
    await expect(gitService.push('/tmp/outside-workspace', originPath, 'main')).rejects.toThrow();
  });

  it('rebases and retries when the remote branch has moved with a non-conflicting change', async () => {
    const otherDir = `${targetDir}-other`;
    await gitService.clone(originPath, 'main', otherDir);
    writeFileSync(join(otherDir, 'other.txt'), 'other change\n');
    await gitService.commitAll(otherDir, 'other: unrelated change');
    await gitService.push(otherDir, originPath, 'main');
    rmSync(otherDir, { recursive: true, force: true });

    writeFileSync(join(targetDir, 'file.txt'), 'my change\n');
    await gitService.commitAll(targetDir, 'fix: my change');

    await gitService.push(targetDir, originPath, 'main');

    const log = execFileSync('git', ['log', '--oneline', 'main'], { cwd: originPath }).toString();
    expect(log).toContain('fix: my change');
    expect(log).toContain('other: unrelated change');
  });

  it('throws a clear error when the rebase hits a real conflict', async () => {
    const otherDir = `${targetDir}-conflict`;
    await gitService.clone(originPath, 'main', otherDir);
    writeFileSync(join(otherDir, 'file.txt'), 'conflicting remote change\n');
    await gitService.commitAll(otherDir, 'other: conflicting change');
    await gitService.push(otherDir, originPath, 'main');
    rmSync(otherDir, { recursive: true, force: true });

    writeFileSync(join(targetDir, 'file.txt'), 'conflicting local change\n');
    await gitService.commitAll(targetDir, 'fix: conflicting change');

    await expect(gitService.push(targetDir, originPath, 'main')).rejects.toThrow(/conflict/i);
  });
});
