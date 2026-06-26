# Goal
Implement the Prompt Engine to build contextually rich prompts for the AI model.

# Scope
Create the prompt generator module to build instructions, optimize diff structures, and enforce size threshold constraints.

# Prerequisites
* Node setup (`000-foundation`).

# Deliverables
* `src/application/services/prompt.service.ts` containing the prompt engine.

# Tasks
- [ ] Create system instruction templates asking for structured JSON review outputs.
- [ ] Implement file filter functions to ignore configuration, binary, and lockfiles (e.g. `pnpm-lock.yaml`, `yarn.lock`, `*.map`).
- [ ] Implement line limits logic trimming unchanged context around diff modifications to a maximum of 3 lines.
- [ ] Implement size threshold constraints in `PromptService`:
  * Maximum payload limit set to **40KB** (approx. 10,000 tokens).
  * If the diff exceeds 40KB, truncate the diff in order of file importance, and append a notice to inform the developer.

# Acceptance Criteria
* Generated prompt output is structured.
* Total prompt payload size does not exceed 40KB under any input size.
* Lockfiles and binaries are successfully ignored from the output.

# Testing Checklist
* **Unit Test**: Test path check exclusion logic. Verify truncation behaviour on huge dummy diffs.
* **Integration Test**: None.
* **Manual Test**: Run prompt builder with sample diff inputs.
* **Failure Scenarios**: Check that extremely large diff inputs (e.g., 5MB) are safely truncated without throwing out-of-memory errors.

# Risks
* Token limit overflow on the AI model. Emphasize truncation rules.

# Notes
The OpenCode model requires clean inputs to provide high-quality feedback.
