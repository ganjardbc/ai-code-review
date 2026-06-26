# ADR-004: Apply Clean Architecture Principles

## Context
The AI Code Reviewer platform is intended to grow from a simple MVP into a feature-rich developer platform. During this growth, we expect to:
1. Support new VCS providers (e.g. Bitbucket, Azure DevOps).
2. Upgrade or change Git execution mechanisms (e.g. from local filesystem cloning to virtualized in-memory diffs).
3. Connect databases (e.g. Postgres, MongoDB) for data persistence.
4. Experiment with different AI models.

To accommodate these changes without rewriting the core business logic, the system's architecture must remain highly decoupled and modular.

## Decision
We will organize the codebase following **Clean Architecture** principles, dividing the project into Domain, Application, Infrastructure, and Presentation layers.

## Alternatives Considered
1. **Model-View-Controller (MVC) / Active Record**: Standard monolith architecture. While quick to build initially, business logic becomes tightly coupled with the framework (Fastify), database libraries, and external APIs, making future refactoring or testing extremely difficult.
2. **Transaction Script**: Quick and dirty script-based execution. Great for simple utilities, but becomes unmaintainable as more features (queues, retries, multi-tenant databases) are introduced.

## Consequences
* **Dependency Rule**: Dependencies always point inward. The core business rules (Domain and Application) have zero knowledge of database technologies, VCS APIs, web frameworks, or AI providers.
* **Testability**: Use cases can be tested in isolation by mocking the interface boundaries (ports) without requiring a running database, git repository, or active internet connection.
* **Flexibility**: We can swap out the database (e.g. SQLite to Postgres) or AI API libraries by writing a new adapter in the Infrastructure layer, leaving the Application logic unchanged.
* **Boilerplate**: Clean architecture requires writing more files, interfaces, and DTOs compared to a traditional MVC setup. We accept this overhead to guarantee long-term maintainability.
