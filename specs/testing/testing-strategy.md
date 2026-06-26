# Testing Strategy Specification

## Purpose
Define testing boundaries, goals, and strategies.

## Specifications
* **Unit Tests**: Focus on validating pure components (Use Case logic, Prompt Builder, JSON Validators, Config loader) in isolation using mocks.
* **Integration Tests**: Focus on verifying connections between layers (Fastify server routes, BullMQ job processing loops, Git clone/diff execution adapters).
* **Mock Strategy**: Mock external API calls (9Router gateway requests, GitHub/GitLab endpoints) to guarantee offline-testable execution and prevent rate limits.
