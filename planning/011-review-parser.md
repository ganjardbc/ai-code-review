# Goal
Validate and parse structured JSON responses returned by the AI model.

# Scope
Create the schema validator engine to verify conformance to the review schemas.

# Prerequisites
* Node setup (`000-foundation`).

# Deliverables
* `src/application/services/parser.service.ts` validator utility.

# Tasks
- [ ] Install packages: `pnpm add ajv`
- [ ] Define the JSON schema structure in `src/application/services/parser.service.ts` matching the documentation:
  * Array of `comments` containing: `filePath` (string), `lineNumber` (number), `message` (string), `severity` (INFO/WARNING/CRITICAL).
- [ ] Initialize `Ajv` and compile the validator schema.
- [ ] Implement parsing logic with fallback string checks (stripping markdown tags like ` ```json ` if returned by the model).
- [ ] Discard invalid comments missing required values.

# Acceptance Criteria
* Model responses matching schema are successfully parsed.
* Responses with missing fields (e.g. missing `lineNumber` or invalid `severity` tags) are filtered out.

# Testing Checklist
* **Unit Test**: Test parser using valid/invalid JSON responses. Verify regex stripping markdown tag wrappers.
* **Integration Test**: None.
* **Manual Test**: None.
* **Failure Scenarios**: Check parser behaviour when receiving empty string payloads.

# Risks
* Parsing crashes from bad input JSON formats. Ensure try/catch safety.

# Notes
Uses standard JSON Schema Draft 7 specifications.
