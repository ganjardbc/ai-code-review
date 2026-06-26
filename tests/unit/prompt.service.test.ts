import '../mocks/env.js';
import { describe, it, expect } from 'vitest';
import { PromptService } from '../../src/application/services/prompt.service.js';

const ps = new PromptService();

const SIMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index 000..111 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,5 +1,5 @@
 context1
 context2
-old line
+new line
 after1
 after2`;

describe('PromptService.build', () => {
  it('includes system prompt and diff section', () => {
    const result = ps.build(SIMPLE_DIFF);
    expect(result).toContain('GIT DIFF');
    expect(result).toContain('src/auth.ts');
  });

  it('filters pnpm-lock.yaml', () => {
    const diff = `diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml\n+lockfile content\n${SIMPLE_DIFF}`;
    const result = ps.build(diff);
    expect(result).not.toContain('pnpm-lock.yaml');
    expect(result).toContain('src/auth.ts');
  });

  it('filters yarn.lock', () => {
    const diff = `diff --git a/yarn.lock b/yarn.lock\n+yarn content\n`;
    const result = ps.build(diff);
    expect(result).not.toContain('yarn.lock');
  });

  it('filters *.min.js files', () => {
    const diff = `diff --git a/bundle.min.js b/bundle.min.js\n+minified\n`;
    const result = ps.build(diff);
    expect(result).not.toContain('bundle.min.js');
  });

  it('filters dist/ output files', () => {
    const diff = `diff --git a/dist/index.js b/dist/index.js\n+built output\n`;
    const result = ps.build(diff);
    expect(result).not.toContain('dist/index.js');
  });

  it('filters .map files', () => {
    const diff = `diff --git a/app.js.map b/app.js.map\n+sourcemap\n`;
    const result = ps.build(diff);
    expect(result).not.toContain('app.js.map');
  });

  it('trims context to max 3 unchanged lines', () => {
    const manyCtxDiff = `diff --git a/foo.ts b/foo.ts
index 000..111
--- a/foo.ts
+++ b/foo.ts
@@ -1,10 +1,10 @@
 ctx1
 ctx2
 ctx3
 ctx4
 ctx5
-old
+new
 after1
 after2
 after3
 after4`;
    const result = ps.build(manyCtxDiff);
    const ctxLines = result.split('\n').filter(l => /^ ctx\d/.test(l));
    expect(ctxLines.length).toBeLessThanOrEqual(3);
  });

  it('truncates diff exceeding 40KB and adds notice', () => {
    const bigDiff = `diff --git a/big.ts b/big.ts\nindex 000..111\n--- a/big.ts\n+++ b/big.ts\n` +
      '+'.repeat(50 * 1024);
    const result = ps.build(bigDiff);
    expect(Buffer.byteLength(result, 'utf-8')).toBeLessThan(50 * 1024);
    expect(result).toContain('TRUNCATED');
  });

  it('returns prompt with system instructions for empty diff', () => {
    const result = ps.build('');
    expect(result).toContain('GIT DIFF');
  });
});
