# Prompt System

This document describes how the system prompt is structured, how diff content is preprocessed before injection, and how to customize prompts for your environment.

---

## System Prompt (Full Text)

The following prompt is sent verbatim to OpenCode on every review request:

```
You are an expert senior software developer and security auditor.

Analyze the following git diff, looking for:
- Security vulnerabilities (injection, XSS, SSRF, insecure deserialization, etc.)
- Memory leaks and resource management issues
- Performance bottlenecks and inefficiencies
- Race conditions and concurrency bugs
- Edge-case logical bugs and incorrect error handling
- Readability and maintainability issues that violate clean-code conventions

Do NOT comment on stylistic preferences such as tabs vs spaces, quote styles, or formatting
unless they violate a major convention.

Return your evaluation ONLY as a valid, parseable JSON object. Do NOT include markdown wraps
(like ```json), introduction text, or conclusion text.

Required output format:
{
  "comments": [
    {
      "filePath": "relative/path/to/file.ts",
      "lineNumber": 42,
      "message": "Actionable feedback explaining the issue and how to fix it.",
      "severity": "INFO | WARNING | CRITICAL"
    }
  ]
}

If there are no issues, return: { "comments": [] }
```

Source: `src/application/services/prompt.service.ts`, `SYSTEM_PROMPT` constant.

---

## Prompt Assembly

The final prompt sent to the AI is constructed as:

```
{SYSTEM_PROMPT}

--- GIT DIFF ---
{filtered and trimmed diff content}

[TRUNCATED: diff exceeded 40KB limit. Some files were omitted from this review.]   ← only if truncated
```

`PromptService.build(diffText)` performs the following steps in order:

### Step 1: Split by file

The raw diff string is split on `diff --git` boundaries, producing one block per file.

### Step 2: Filter ignored files

Files matching any of the following patterns are removed entirely:

| Pattern type | Examples |
|---|---|
| Lockfiles | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `composer.lock`, `Gemfile.lock`, `Cargo.lock` |
| Minified files | `*.min.js`, `*.min.css` |
| Source maps | `*.map` |
| Build output directories | `dist/`, `build/`, `.next/`, `out/` |
| Binary and media assets | `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.svg`, `*.ico`, `*.webp`, `*.bmp`, `*.tiff` |
| Font files | `*.ttf`, `*.woff`, `*.woff2`, `*.eot`, `*.otf` |
| Archives | `*.pdf`, `*.zip`, `*.gz`, `*.tar` |

Patterns are matched against the relative file path from the repo root.

### Step 3: Trim context lines

For each file block, unchanged context lines around hunks are reduced to a maximum of **3 lines** before and after each change. This shrinks the token count without losing the surrounding code context needed for accurate review.

### Step 4: Enforce 40 KB size limit

Files are assembled in diff order until the cumulative byte length would exceed **40,960 bytes** (40 KB). Files that would push the total over the limit are dropped, and a truncation notice is appended.

The 40 KB limit was chosen to stay within approximately 10,000 tokens, keeping costs and latency predictable while covering the majority of focused PRs.

---

## Dynamic Context: What Gets Injected

For each included file block, the diff looks like:

```
diff --git a/src/utils/auth.ts b/src/utils/auth.ts
index abc1234..def5678 100644
--- a/src/utils/auth.ts
+++ b/src/utils/auth.ts
@@ -45,7 +45,9 @@
 function validateToken(token: string) {
-  return token === process.env.SECRET;
+  const expected = process.env.SECRET ?? '';
+  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
 }
```

The AI infers the programming language from the file extension in the diff header. No explicit language annotation is injected.

---

## Prompt Optimization

### Context shrinking

Context trimming (`trimContext`) is the primary token-reduction technique. By keeping only 3 unchanged lines around each hunk, a 200-line context block becomes ~30 lines per changed region.

### File filtering

Filtering lockfiles and assets is the highest-impact optimization. A single `pnpm-lock.yaml` change can produce thousands of diff lines that contain zero reviewable logic.

### Truncation strategy

When the 40 KB limit is hit, files are included greedily in order of their appearance in the diff (which is typically alphabetical). There is no prioritization by file type or change size. If you want changed application code to take precedence over test files, sort the diff before passing it to `PromptService`.

---

## Customizing Prompts

### Change the system prompt

Edit `SYSTEM_PROMPT` in `src/application/services/prompt.service.ts`. Keep the JSON format instruction and the `"comments"` schema — the parser depends on them.

### Add project-specific rules

Inject additional rules by subclassing `PromptService`:

```typescript
export class ProjectPromptService extends PromptService {
  build(diffText: string): string {
    const base = super.build(diffText);
    const rule = 'Project rule: Never use `any` as a TypeScript type. Flag all occurrences.\n\n';
    // Insert the rule before the diff separator
    return base.replace('--- GIT DIFF ---', rule + '--- GIT DIFF ---');
  }
}
```

### Adjust the diff size limit

Change `DIFF_MAX_BYTES` in `prompt.service.ts`. Be aware that increasing it raises both latency and cost per review.

### Change context line count

Pass a different `maxContext` value to `trimContext`. The default is `3`. A value of `0` shows only changed lines with no surrounding context (more compact but harder for the AI to interpret); `5–10` gives broader context for complex logic.

### Add language detection

To inject an explicit language hint, detect the language from the most common file extension in the diff and prepend it to the system prompt:

```typescript
const lang = detectLanguage(files);  // e.g. "TypeScript"
const hint = lang ? `Primary language: ${lang}.\n` : '';
return `${hint}${SYSTEM_PROMPT}\n\n--- GIT DIFF ---\n${assembled}`;
```
