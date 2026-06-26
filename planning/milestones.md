# Milestones

## Phase 1: Foundation
* **Objective**: Create typescript scaffolding, configure safe environment validation, and setup Pino logger.
* **Estimated Effort**: 4 hours
* **Dependencies**: None
* **Completion Criteria**: Build compiles without errors; running `npm run build` generates a dist folder; configuring invalid environment flags exits with clear messages.

## Phase 2: API
* **Objective**: Bootstrap Fastify HTTP Server, expose the health check endpoint, and setup secure GitHub/GitLab webhook endpoints with signature parsing.
* **Estimated Effort**: 8 hours
* **Dependencies**: Phase 1
* **Completion Criteria**: HTTP server runs; endpoints `/health`, `/webhooks/github`, `/webhooks/gitlab` respond correctly; unauthorized signature headers return `401`.

## Phase 3: Queue
* **Objective**: Establish BullMQ queues and worker processing framework backed by Redis, configuring job state TTL and eviction properties.
* **Estimated Effort**: 8 hours
* **Dependencies**: Phase 2
* **Completion Criteria**: Webhook routes enqueue jobs into Redis; asynchronous workers dequeue and log payloads; Redis does not accumulate completed job data beyond TTL limits.

## Phase 4: Git
* **Objective**: Create the Git operations adapter using command argument arrays, providing sandboxed checkouts and diff output creation.
* **Estimated Effort**: 10 hours
* **Dependencies**: Phase 1
* **Completion Criteria**: Shallow-branch clone downloads repositories to unique UUID folders; diff generation produces valid unified patch files; directories are fully deleted post-run.

## Phase 5: AI
* **Objective**: Implement 9Router OpenCode API wrapper, structured JSON schema parser (using Ajv), and prompt engineering logic with 40KB limits.
* **Estimated Effort**: 12 hours
* **Dependencies**: Phase 1
* **Completion Criteria**: Prompt builder handles context truncation at 40KB; 9Router client returns raw JSON; Ajv schemas check object conformance; invalid formats trigger retry alerts.

## Phase 6: Providers
* **Objective**: Develop GitHub and GitLab REST wrappers using client SDKs to post inline comments to exact lines.
* **Estimated Effort**: 8 hours
* **Dependencies**: Phase 5
* **Completion Criteria**: Octokit and Gitbeaker clients successfully post comments on PRs/MRs using metadata mapping.

## Phase 7: Deployment
* **Objective**: Configure multi-stage Docker build files and compose configurations linking Fastify, Worker, and Redis services.
* **Estimated Effort**: 6 hours
* **Dependencies**: Phase 3, Phase 4, Phase 6
* **Completion Criteria**: Running `docker compose up` starts API and Worker instances; webhook events trigger end-to-end local mock review cycle.
