# Project Roadmap

The development of the AI Code Reviewer platform is structured into iterative releases, starting with a lightweight, functional MVP and scaling to a fully featured enterprise platform.

---

## MVP (Completed Phase)

**Focus**: Basic automated review pipeline with no database persistence.

* **Integrations**: Support for GitHub Pull Requests and GitLab Merge Requests.
* **Worker Execution**: Single queue managed via BullMQ/Redis processing jobs sequentially.
* **Git Operations**: Shallow clone, branch checkout, diff generation.
* **AI Processing**: OpenCode model via 9Router with strict JSON responses.
* **Review Outputs**: Comments written back directly to the VCS pull request line.
* **Logging**: Structured logs with Fastify Pino.

---

## Version 1.1 (Short-Term Improvements)

**Focus**: Improving accuracy, resiliency, and review configuration.

* **Review Configurations**: Support checking for a `.ai-reviewer.yml` config file inside the target repository to customize:
  * Files to ignore (glob patterns).
  * System prompt overrides.
  * Ignored severity levels.
* **Retry Mechanisms**: Advanced exponential backoff policy for AI API rate limits.
* **Token Pruning**: Semantic diff pruning to fit larger changes inside the context window.
* **Duplicate Detection**: Prevent posting identical comments if the PR is updated without addressing the previous review comments.

---

## Version 2.0 (Mid-Term Releases)

**Focus**: Multi-tenancy, database persistence, and user interfaces.

* **Database Engine**: Integrate PostgreSQL to store project state, histories, configurations, and user accounts.
* **OAuth Authentication**: Secure GitHub App and GitLab OAuth system setups.
* **Admin Dashboard UI**: Web console to:
  * Monitor active and failed review jobs.
  * Toggle repositories on/off.
  * View review analytics (e.g. average review duration, common bug patterns).
* **Multi-Tenancy**: Tenant organization partitions across databases.
* **Slack / MS Teams Integration**: Alert teams when critical vulnerabilities are found during PR reviews.

---

## Version 3.0 (Long-Term Strategy)

**Focus**: Intelligent agents, custom tuning, and advanced security scanning.

* **Model Fine-Tuning**: Train or fine-tune models on the organization’s historical codebase to match coding style and custom framework patterns.
* **Multi-Agent Coding Execution**: AI agent not only leaves comments but opens "fix PRs" automatically proposing code corrections.
* **Full Context Mapping**: Feed the entire code repository structure (AST parser) into a vector database (RAG) to allow the AI to understand dependencies across files during reviews, rather than only viewing isolated file diffs.
* **Security & Compliance Auditing**: Advanced scanning certifications (OWASP Top 10, SOC 2, HIPAA check alerts).
