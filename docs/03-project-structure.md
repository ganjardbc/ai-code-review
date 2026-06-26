# Project Directory Structure

To support clean architecture boundaries and future extensibility, the project directory is organized as follows:

```
ai-code-reviewer/
├── docs/                      # Documentation files (this directory)
│   ├── adr/                   # Architecture Decision Records
│   └── ...
├── src/
│   ├── domain/                # Enterprise Business Rules & Abstractions
│   │   ├── entities/          # Business entities (e.g. Job, Comment, PullRequest)
│   │   └── interfaces/        # Contracts/Adapters ports (e.g. IVcsClient, IAiProvider)
│   │
│   ├── application/           # Application Business Rules & Use Cases
│   │   ├── use-cases/         # Application orchestrators (e.g. EnqueueJob, ProcessReview)
│   │   └── services/          # Pure application logic helper services
│   │
│   ├── infrastructure/        # Frameworks, Drivers, and Tools (Low-level details)
│   │   ├── queue/             # BullMQ queue client and worker definition
│   │   ├── git/               # simple-git wrapper and workspace managers
│   │   ├── vcs/               # VCS implementation adapters (GitHub, GitLab)
│   │   ├── ai/                # AI service implementation (9Router / OpenCode)
│   │   └── database/          # Database connection, schemas, and queries (design only/optional)
│   │
│   ├── presentation/          # User Interfaces & Input Handlers
│   │   ├── web/               # Fastify routes, controllers, and middlewares
│   │   ├── dto/               # Web request/response validation schemas
│   │   └── server.ts          # Main entrypoint initializing the fastify server
│   │
│   └── config/                # Environment variable resolution & global config loader
│
├── tests/                     # Automated testing suite
│   ├── unit/                  # Unit tests focusing on Use Cases and Domain logic
│   ├── integration/           # Integration tests verifying DB, API, or Git adapters
│   └── mocks/                 # Shared mocks for testing external dependencies
│
├── .env.example               # Template environment configuration file
├── docker-compose.yml         # Container definitions (App, Redis, Postgres)
├── Dockerfile                 # Multi-stage production docker build definition
├── package.json               # Package dependencies configuration
├── pnpm-lock.yaml             # Lockfile for dependency consistency
└── tsconfig.json              # TypeScript compilation setup
```

---

## Folder Responsibilities

### `src/domain/`
* **Purpose**: This folder represents the core, immutable business layer of the platform.
* **Rules**: 
  * It must have **no dependencies** on libraries outside of primitive language features.
  * It defines the domain entities that model real-world business items.
  * It defines abstract contracts (interfaces) for ports that are implemented by the infrastructure layer.

### `src/application/`
* **Purpose**: Houses the use cases that orchestrate domain entities and call external ports (interfaces) to perform application operations.
* **Rules**:
  * It must only depend on the Domain layer.
  * It must be unaware of the framework (Fastify), the queue mechanics (BullMQ), or the database (PostgreSql).
  * If a use case needs to fetch a git diff, it calls the `IGitService` interface without knowing how git executes.

### `src/infrastructure/`
* **Purpose**: Houses all concrete implementations of the system contracts, including network requests, disk management, and direct library wrappers.
* **Rules**:
  * It can depend on both Domain and Application layers.
  * Changes in external SDK updates (e.g. Octokit version upgrades or replacing simple-git with another library) should be contained entirely in this layer.

### `src/presentation/`
* **Purpose**: Handles entry points to the application, receiving requests from the outer world (webhook requests, health checks, CLI commands).
* **Rules**:
  * Translates raw incoming payloads (HTTP requests) into domain/application structures.
  * Handles JSON schema request validations, status codes, and error formatting.
  * Utilizes `Fastify` for routing and middleware.

### `src/config/`
* **Purpose**: Centralizes the parsing, validation, and type-safetying of environment variables (using libraries like `dotenv` and `zod` or `convict`).
* **Rules**:
  * No code should reference `process.env` directly outside of this folder.
