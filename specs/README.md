# AI Code Reviewer Technical Specifications

This directory contains the implementation-ready technical specifications for the AI Code Reviewer platform. These documents define exact interfaces, public APIs, directory layouts, and validation logic rules to align human developers and AI coding agents during implementation.

## Architectural Guidelines
* **Clean Architecture**: Follow the dependency rule strictly. Source code layers must only import from layers at the same level or layers closer to the core (Domain -> Application -> Infrastructure -> Presentation).
* **Interface Decoupling**: Business logic does NOT depend on specific AI models or SCM providers directly. All operations are defined by domain-level ports (`IAiProvider`, `IScmProvider`).
* **Input Validation & Safety**: Sanitize all parameters using Zod schemas and regex matches before execution. Subprocesses are strictly executed with argument arrays to prevent Command Injection.

## Coding Conventions
1. **Naming Conventions**:
   * Interfaces: Prefix with `I` (e.g. `IGitService`).
   * Classes: PascalCase (e.g. `GitService`).
   * Methods / Variables: camelCase (e.g. `generateDiff`).
   * Constants: UPPER_SNAKE_CASE (e.g. `MAX_DIFF_SIZE`).
2. **File Conventions**:
   * File names use kebab-case (e.g. `git-service.ts`, `github-webhook.controller.ts`).
   * Interfaces go in `domain/interfaces/`.
   * Implementations go in `infrastructure/` or `application/`.

## Directory Index
* **[Foundation](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/specs/foundation/)**: Configurations, Logging, Server, and Global Error structures.
* **[Core](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/specs/core/)**: Use cases orchestrating the review cycle.
* **[Git](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/specs/git/)**: Workspace isolation and diff generation.
* **[Queue](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/specs/queue/)**: Redis and BullMQ configurations.
* **[Webhook](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/specs/webhook/)**: Webhook controllers and cryptographic HMAC signature validation rules.
* **[AI](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/specs/ai/)**: Prompt structures, context optimizations, and parsing.
* **[Providers](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/specs/providers/)**: SCM client adapters.
* **[Shared](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/specs/shared/)**: Logging helper utilities, environment schemas, and filesystem managers.
* **[Deployment](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/specs/deployment/)**: Docker settings.
* **[Testing](file:///Users/ganjarhadiatna/Projects/ai-code-reviewer/specs/testing/)**: Mock configurations and automated execution.
