# Prompt Builder Specification

## Purpose
Expose functions structuring user and system prompts context payloads.

## Responsibilities
* Filter out compiled assets and lockfiles.
* Trim surrounding context lines.
* Enforce **40KB** maximum diff size thresholds.
* Truncate oversized diff payloads gracefully.

## Public Interfaces
```typescript
export interface IPromptBuilder {
  build(diffText: string): string;
}
```

## Prompt Truncation Rules
* If the generated diff string exceeds 40,960 characters, the builder trims files from the bottom, appends a truncation notice warning message, and retains only the leading segments within bounds.
