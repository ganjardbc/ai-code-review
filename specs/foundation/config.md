# Config Module Specification

## Purpose
Expose a type-safe, validated configuration state for the application using Zod and dotenv.

## Responsibilities
* Load variables from environment variables or `.env` files.
* Validate variables using strict type constraints.
* Export a read-only, immutable configuration object.
* **Must Not**: Perform business operations or initialize network clients.

## Dependencies
* External: `zod`, `dotenv`.

## Public Interfaces
```typescript
export interface AppConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  REDIS_URL: string;
  NINE_ROUTER_API_KEY: string;
  NINE_ROUTER_BASE_URL: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_ACCESS_TOKEN: string;
  GITLAB_WEBHOOK_SECRET: string;
  GITLAB_ACCESS_TOKEN: string;
  WORKSPACE_DIR: string;
  QUEUE_JOB_TTL_SECONDS: number;
  QUEUE_MAX_JOBS_RETAINED: number;
}
```

## Folder Structure
```text
src/config/
├── index.ts        # Main loader and schema validation export
└── schema.ts       # Zod schema definitions
```

## Error Handling
* Validation Failure: Throws dynamic `ValidationError` stating exactly which field is missing or format-incorrect, immediately halting startup.

## Security
* Redact sensitive details (API keys/tokens) when logging configuration variables on startup.
