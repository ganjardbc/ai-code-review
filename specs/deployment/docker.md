# Docker Specification

## Purpose
Define the Docker container build specification.

## Multi-stage Build Spec
1. **Stage 1 (Builder)**:
   * Node.js v22 alpine base.
   * Copy `package.json`, `pnpm-lock.yaml`, and install dependencies.
   * Compile TypeScript.
2. **Stage 2 (Runner)**:
   * Node.js v22 alpine base.
   * Install **Git** package: `apk add --no-cache git`.
   * Copy production dependencies and compiled `/dist` directory.
   * Run as a non-root user (e.g. `node` user account).
