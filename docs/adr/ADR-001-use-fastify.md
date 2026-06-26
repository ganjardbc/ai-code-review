# ADR-001: Use Fastify for API Server

## Context
The AI Code Reviewer platform requires a lightweight web server to listen for incoming webhook calls from GitHub and GitLab. Webhook payloads can arrive in bursts when multiple developers are active. The server must handle signature validation quickly and return a response immediately after queueing the task.

## Decision
We will use **Fastify** as the primary web application framework instead of Express or NestJS.

## Alternatives Considered
1. **Express**: The industry standard for Node.js servers, but has higher overhead, lacks built-in schema validation, and does not support modern async/await patterns natively.
2. **NestJS**: A feature-rich framework, but introduces significant boilerplate, dependency injection complexity, and slower startup times. For a lightweight MVP webhook listener, NestJS is over-engineered.

## Consequences
* **Performance**: Fastify is up to 2x faster than Express, minimizing system overhead.
* **Schema Validation**: Fastify's native schema compiler (using Ajv) allows us to validate incoming webhook payloads at the routing layer with high performance.
* **Logging**: Fastify integrates Pino out of the box, providing low-overhead structured logging.
* **Learning Curve**: Minimal, as the API resembles Express, making it easy for the development team to pick up.
