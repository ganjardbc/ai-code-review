# AI Validation Specification

## Purpose
Expose validation schema rules ensuring parsed outputs match expectation contracts.

## Responsibilities
* Validate JSON payloads conform to Ajv schemas.
* Drop invalid comments.

## Dependencies
* External: `ajv`.

## Schema Definition
* Schema matches the standard definition:
  ```json
  {
    "type": "object",
    "properties": {
      "comments": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "filePath": { "type": "string" },
            "lineNumber": { "type": "integer" },
            "message": { "type": "string" },
            "severity": { "type": "string", "enum": ["INFO", "WARNING", "CRITICAL"] }
          },
          "required": ["filePath", "lineNumber", "message", "severity"]
        }
      }
    },
    "required": ["comments"]
  }
  ```
