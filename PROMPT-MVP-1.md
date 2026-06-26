# AI Reviewer MVP - Documentation Generation Prompt

You are a Staff Software Architect and Technical Writer.

Your task is to design the documentation for a production-ready AI Code Reviewer platform.

## Project Overview

Build a self-hosted AI Code Reviewer that integrates with GitHub and GitLab.

The system receives Pull Request / Merge Request webhooks, clones the repository, generates the git diff, sends the diff to OpenCode (using 9Router as the AI provider), receives the review result, and posts review comments back to GitHub or GitLab.

This project is intended to become an extensible platform, but for now we are only designing the MVP.

---

## Tech Stack

* Runtime: Node.js 22
* Language: TypeScript
* Package Manager: pnpm
* Framework: Fastify
* Queue: BullMQ + Redis
* Git: simple-git
* Process Runner: execa
* AI Runner: OpenCode
* AI Gateway: 9Router
* Database: PostgreSQL (design only, optional in MVP)
* Deployment: Docker + Docker Compose

---

## MVP Features

The MVP must support:

* GitHub Webhook
* GitLab Webhook
* Clone repository
* Checkout PR/MR branch
* Generate git diff
* Execute AI review through OpenCode
* Parse AI output
* Post review comment back to GitHub/GitLab
* Logging
* Health Check endpoint

---

## Out of Scope

Do NOT include:

* Authentication
* User management
* Billing
* Dashboard UI
* Analytics
* Multi-tenancy
* Team management
* AI conversation history

---

## Expected Architecture

The architecture should follow Clean Architecture principles.

Suggested layers:

* Presentation
* Application
* Domain
* Infrastructure

The project should be modular and future-proof.

---

## Documentation to Generate

Generate each document as a separate Markdown file.

### 01-product-requirements.md

Include:

* Vision
* Goals
* MVP Features
* Non Goals
* Success Criteria

---

### 02-architecture.md

Include:

* High-level architecture diagram
* Component responsibilities
* Module interaction
* Request lifecycle
* Design principles

---

### 03-project-structure.md

Describe the recommended folder structure.

Explain the responsibility of every folder.

---

### 04-review-workflow.md

Explain the complete review lifecycle.

Include sequence diagrams using Mermaid.

Explain:

* webhook
* queue
* worker
* git
* prompt generation
* AI execution
* parser
* comment posting
* cleanup

---

### 05-api.md

Document every API endpoint.

Include:

* Request
* Response
* Status codes
* Error cases

---

### 06-database.md

Design the future database.

Include:

* ER Diagram
* Tables
* Relationships
* Reasoning

Although MVP may not use a database yet.

---

### 07-configuration.md

Document:

* Environment variables
* Docker configuration
* Workspace directory
* Secrets management
* Logging configuration

---

### 08-prompt-engine.md

Explain:

* Prompt template architecture
* Context building
* Diff formatting
* AI output format
* JSON schema for AI response
* Validation strategy

Prefer structured JSON output over Markdown.

---

### 09-deployment.md

Document:

* Local development
* Docker Compose
* Production deployment
* Scaling worker
* Redis
* Reverse proxy
* Environment setup

---

### 10-roadmap.md

Split roadmap into:

* MVP
* v1.1
* v2
* v3

Each version should clearly describe additional capabilities.

---

### Architecture Decision Records (ADR)

Generate:

* ADR-001-use-fastify.md
* ADR-002-use-bullmq.md
* ADR-003-use-opencode.md
* ADR-004-clean-architecture.md

Each ADR should contain:

* Context
* Decision
* Consequences
* Alternatives Considered

---

## Documentation Standards

* Use Markdown.
* Use Mermaid diagrams where appropriate.
* Be concise but complete.
* Write as production-quality documentation.
* Follow industry best practices.
* Avoid unnecessary verbosity.
* Use consistent terminology.
* Assume the audience is experienced TypeScript backend engineers.

The generated documentation should be immediately usable as the `/docs` directory of the project without requiring major edits.
