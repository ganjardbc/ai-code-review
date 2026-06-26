# Output Parser Specification

## Purpose
Clean and parse response strings returned by the AI provider.

## Responsibilities
* Strip codeblock tags (` ```json ... ``` `) if present in raw response strings.
* Deserialize JSON outputs.

## Public Interfaces
```typescript
export interface IOutputParser {
  parse(rawText: string): Record<string, any>;
}
```

## Malformed JSON Handling
* Try extracting substrings within `{` and `}` boundaries using regex if direct deserialization throws errors.
