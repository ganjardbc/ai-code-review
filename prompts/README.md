# AI Code Reviewer Prompt Library

This directory contains a collection of reusable, highly-structured prompt templates designed to guide AI coding assistants throughout the development lifecycle of the AI Code Reviewer project.

## Prompt Design Principles
* **Single Responsibility**: Each prompt focuses on one specific development task (e.g. implementation, refactoring, testing, security checks).
* **Deterministic Mappings**: Instructs the model to follow the project `/docs`, `/planning`, and `/specs` exactly, ensuring architectural consistency.
* **Production Quality**: Forces the AI coding assistant to write complete, clean, type-safe, and secure code without placeholder assumptions.

## Library Index
1. **[01-implement-module.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/01-implement-module.md)**: Implement a module based on its specification.
2. **[02-review-module.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/02-review-module.md)**: Review code structures, architecture, and principles.
3. **[03-refactor-module.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/03-refactor-module.md)**: Code readability improvements and duplicate removal.
4. **[04-write-unit-tests.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/04-write-unit-tests.md)**: Standard unit tests templates.
5. **[05-write-integration-tests.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/05-write-integration-tests.md)**: Cross-module integration tests.
6. **[06-fix-bug.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/06-fix-bug.md)**: Isolate root causes and apply minimum fixes.
7. **[07-security-review.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/07-security-review.md)**: Check for command injection, path traversal, and leaks.
8. **[08-performance-review.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/08-performance-review.md)**: CPU, memory allocations, and payload thresholds check.
9. **[09-generate-documentation.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/09-generate-documentation.md)**: Document generation and update patterns.
10. **[10-update-specification.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/10-update-specification.md)**: Update specifications based on implementation needs.
11. **[11-code-cleanup.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/11-code-cleanup.md)**: Dead code and import removal checks.
12. **[12-release-checklist.md](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/prompts/12-release-checklist.md)**: Validation tasks checklist before shipping releases.
