# Prompt Template Specification

## Purpose
Define the exact instructions prompt sent to the AI model.

## Specifications
* **System Prompt**:
  * Directs the AI to act as a Senior Security Auditor and Tech Lead.
  * Directs the model to output reviews strictly in JSON formats.
  * Instructs the model to avoid general formatting reviews (tabs/spaces).
* **Expected JSON format output schema**:
  ```json
  {
    "comments": [
      {
        "filePath": "relative/path/to/file",
        "lineNumber": 12,
        "message": "Actionable feedback content",
        "severity": "INFO | WARNING | CRITICAL"
      }
    ]
  }
  ```
