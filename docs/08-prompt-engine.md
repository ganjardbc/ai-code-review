# Prompt Engine Architecture

The Prompt Engine is responsible for building contextually rich, token-efficient system and user prompts to guide the AI model (OpenCode via 9Router) into generating highly accurate code review comments in a reliable structured JSON format.

---

## Context Building & Diff Formatting

A raw git diff contains header metadata, line additions/deletions indicators, and surrounding context lines. The prompt engine optimizes this raw output:
1. **File Path Filtering**: Ignores lockfiles (e.g. `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`), build outputs/bundles (e.g., `dist/`, `build/`, `*.min.js`, `*.map`), assets, and images to conserve token usage.
2. **Context Shrinking**: Limits surrounding lines of unchanged code to a maximum of 3 lines above and below the change.
3. **Chunking & Size Limits**: 
   * A hard limit of **40KB** (approximately 10,000 tokens) is enforced on the total diff size sent in a single query.
   * If the diff exceeds 40KB, the engine truncates the content, reviewing files in order of significance (excluding binary/assets) and appends a notice to the PR comment informing the developer that the review was truncated due to size constraints.
4. **Chunking**: Large diffs are split into multiple file-specific chunks or logical blocks.

Example of formatted diff output injected into the prompt:
```
--- a/src/services/userService.ts
+++ b/src/services/userService.ts
@@ -42,5 +42,5 @@
   async getUser(id: string) {
-    const user = await db.query(`SELECT * FROM users WHERE id = '${id}'`); // Vulnerable
+    const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
     return user;
   }
```

---

## Prompt Template Structure

The engine combines a static system prompt with dynamic branch/repository details:

### System Prompt (Instruction)
```
You are an expert, senior software developer and security auditor.
Analyze the following git diff, looking for security vulnerabilities, memory leaks, performance bottlenecks, race conditions, edge-case logical bugs, or readability smells.

Critique code objectively. Do not comment on stylistic preferences (e.g., tabs vs spaces) unless it violates major clean-code conventions.

Return your evaluation ONLY in the structured JSON format specified below. Do not include markdown wraps (like ```json), introduction text, or conclusion text. The response must be a valid, parseable JSON object.
```

### JSON Schema for AI Response

The target output structure is defined by the following schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "comments": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "filePath": {
            "type": "string",
            "description": "The relative path to the file containing the issue."
          },
          "lineNumber": {
            "type": "integer",
            "description": "The exact line number of the code where the issue resides."
          },
          "message": {
            "type": "string",
            "description": "Actionable, constructive feedback explaining the issue and recommending a fix."
          },
          "severity": {
            "type": "string",
            "enum": ["INFO", "WARNING", "CRITICAL"],
            "description": "The severity classification of the finding."
          }
        },
        "required": ["filePath", "lineNumber", "message", "severity"]
      }
    }
  },
  "required": ["comments"]
}
```

---

## Validation Strategy

To guarantee the reliability of the integration, a multi-phase validation pipeline runs on the AI output:

```
[OpenCode AI Response]
         │
         ▼
 ┌───────────────┐
 │ JSON Parsing  │ ──(Throws parse error)──> [Queue Retry / Fail Job]
 └───────┬───────┘
         │ Successfully parsed into memory
         ▼
 ┌───────────────┐
 │ Schema Check  │ ──(Fails validation)───> [Discard Invalid Comments]
 └───────┬───────┘ (Using Ajv validation library)
         │ Validated JSON
         ▼
 ┌───────────────┐
 │ Line Matcher  │ ──(Adjusts line or discards if out of bounds)
 └───────┬───────┘ (Verifies line exists in git diff modifications)
         │ Sanitized Comments
         ▼
 [Publish to VCS API]
```

1. **Strict JSON Parsing**: Attempts to parse the response string. If parse fails, checks for trailing characters or extracts JSON substring using regular expressions.
2. **Schema Guard**: Validates structure constraints using `Ajv` (TypeScript standard validator). Any comment missing a required attribute is dropped.
3. **Out-of-Bounds Diff Guard**: Cross-references the `lineNumber` and `filePath` against the generated git diff. If the AI suggests comments on unchanged lines or lines that do not exist, the comment is discarded to prevent spamming review channels.
