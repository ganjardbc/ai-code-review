# Progress Tracking Checklist

## Phase 1: Foundation
- [ ] **000-foundation**: Scaffolding, `tsconfig.json`, `package.json`
- [ ] **001-configuration**: Environment validation schemas with Zod
- [ ] **002-logging**: Pino logger configurations

## Phase 2: API
- [ ] **003-http-server**: Fastify server setup
- [ ] **004-health**: Health check endpoints
- [ ] **005-webhook**: GitHub & GitLab webhook endpoints + Signature validation checks

## Phase 3: Queue
- [ ] **006-queue**: BullMQ Redis queue setups
- [ ] **007-worker**: Task workers listening to queues

## Phase 4: Git
- [ ] **008-git**: Safe Git Operations adapter (array params, UUID sandbox directories)

## Phase 5: AI
- [ ] **009-prompt-engine**: Context structure formatting & 40KB limits
- [ ] **010-ai-runner**: 9Router client integration
- [ ] **011-review-parser**: JSON validators (Ajv schema matching)

## Phase 6: Providers
- [ ] **012-github-provider**: Octokit integration
- [ ] **013-gitlab-provider**: Gitbeaker integration
- [ ] **014-review-orchestrator**: Use Cases orchestrator
- [ ] **015-cleanup**: Directory cleanup managers

## Phase 7: Deployment
- [ ] **016-observability**: Pino logs monitoring metrics
- [ ] **017-testing**: Unit & Integration tests
- [ ] **018-deployment**: Dockerfiles & Compose environments
