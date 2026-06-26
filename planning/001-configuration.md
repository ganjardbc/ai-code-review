# Goal
Create a type-safe environment configuration validation loader using `zod` and `dotenv`.

# Scope
* Parse env variables from `.env`.
* Enforce variable typing and presence constraints using Zod schemas.
* Expose a frozen immutable config object.

# Prerequisites
* Node setup (`000-foundation`).

# Deliverables
* `src/config/index.ts` containing schema validation and exports.
* `.env.example` file template.

# Tasks
- [ ] Install packages: `pnpm add zod dotenv`
- [ ] Create `.env.example` mapping all settings defined in docs.
- [ ] Create `src/config/schema.ts` defining the Zod configuration schema.
- [ ] Implement validation logic checking for variable presences and formats.
- [ ] Export validated, immutable configurations.

# Acceptance Criteria
* Starting the app fails with descriptive error logs when required variables (e.g. `NINE_ROUTER_API_KEY`) are missing.
* String port variables are correctly parsed as numbers.

# Testing Checklist
* **Unit Test**: Test schema parser returns parsed configs when valid.
* **Integration Test**: None.
* **Manual Test**: Try starting app with missing `.env` fields and check error output.
* **Failure Scenarios**: Check that providing invalid URL formats to `REDIS_URL` or `NINE_ROUTER_BASE_URL` throws validation errors.

# Risks
* Runtime crashes if dependencies rely on uninitialized configs. Ensure config loader runs first.

# Notes
Ensure configuration schema supports local development fallbacks where applicable.
