import '../mocks/env.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RepoConfigService, DEFAULT_REPO_CONFIG } from '../../src/infrastructure/repo-config/repo-config.service.js';

let tmpDir: string;
let service: RepoConfigService;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'ai-reviewer-test-'));
  service = new RepoConfigService();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('RepoConfigService.load', () => {
  it('returns defaults when .ai-reviewer.yml does not exist', async () => {
    const config = await service.load(tmpDir);
    expect(config).toEqual(DEFAULT_REPO_CONFIG);
  });

  it('parses a valid config file', async () => {
    await writeFile(join(tmpDir, '.ai-reviewer.yml'), [
      'ignore_files:',
      '  - "migrations/**"',
      '  - "**/__generated__/**"',
      'prompt_extra: "Use Go conventions"',
      'min_severity: WARNING',
    ].join('\n'));

    const config = await service.load(tmpDir);
    expect(config.ignore_files).toEqual(['migrations/**', '**/__generated__/**']);
    expect(config.prompt_extra).toBe('Use Go conventions');
    expect(config.min_severity).toBe('WARNING');
  });

  it('returns defaults for all keys when file is empty', async () => {
    await writeFile(join(tmpDir, '.ai-reviewer.yml'), '');
    const config = await service.load(tmpDir);
    expect(config).toEqual(DEFAULT_REPO_CONFIG);
  });

  it('returns defaults for missing optional keys', async () => {
    await writeFile(join(tmpDir, '.ai-reviewer.yml'), 'min_severity: CRITICAL\n');
    const config = await service.load(tmpDir);
    expect(config.min_severity).toBe('CRITICAL');
    expect(config.ignore_files).toEqual([]);
    expect(config.prompt_extra).toBeUndefined();
  });

  it('returns defaults for invalid YAML', async () => {
    await writeFile(join(tmpDir, '.ai-reviewer.yml'), ':: invalid: yaml: [\n');
    const config = await service.load(tmpDir);
    expect(config).toEqual(DEFAULT_REPO_CONFIG);
  });

  it('returns defaults for invalid schema (bad severity value)', async () => {
    await writeFile(join(tmpDir, '.ai-reviewer.yml'), 'min_severity: UNKNOWN\n');
    const config = await service.load(tmpDir);
    expect(config).toEqual(DEFAULT_REPO_CONFIG);
  });

  it('returns defaults when file exceeds 10KB limit', async () => {
    await writeFile(join(tmpDir, '.ai-reviewer.yml'), 'x: ' + 'a'.repeat(11 * 1024));
    const config = await service.load(tmpDir);
    expect(config).toEqual(DEFAULT_REPO_CONFIG);
  });

  it('returns defaults when ignore_files contains non-string items', async () => {
    await writeFile(join(tmpDir, '.ai-reviewer.yml'), 'ignore_files:\n  - 123\n');
    const config = await service.load(tmpDir);
    expect(config).toEqual(DEFAULT_REPO_CONFIG);
  });
});
