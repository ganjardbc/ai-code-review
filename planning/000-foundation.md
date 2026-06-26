# Goal
Set up the codebase skeleton, project dependencies, development tools, directory scaffolding, and TypeScript configurations.

# Scope
Initialize the codebase layout using `pnpm`. Configure development tools including TypeScript compiling configurations (`tsconfig.json`), ESLint, and folder directories under `src/` to support Clean Architecture.

# Prerequisites
* Node.js v22.x installed.
* `pnpm` package manager available.

# Deliverables
* `package.json` with dependencies defined.
* `tsconfig.json` optimized for Node 22.
* Folders structure generated.

# Tasks
- [ ] Initialize repository package: `pnpm init`
- [ ] Install dev dependencies: `pnpm add -D typescript @types/node ts-node typescript-eslint eslint`
- [ ] Create `tsconfig.json` mapping output files to `dist/` and compiler options targeting Node 22.
- [ ] Scaffold folder boundaries:
  * `src/domain/entities`, `src/domain/interfaces`
  * `src/application/use-cases`, `src/application/services`
  * `src/infrastructure/git`, `src/infrastructure/queue`, `src/infrastructure/ai`, `src/infrastructure/vcs`
  * `src/presentation/web`, `src/presentation/dto`
  * `src/config`
- [ ] Add basic build scripts to `package.json`: `pnpm build`, `pnpm dev`.

# Acceptance Criteria
* Code compiles using `pnpm build` generating output in `dist/`.
* Directory path layouts are correct and follow Clean Architecture boundaries.

# Testing Checklist
* **Unit Test**: None.
* **Integration Test**: Verify running build generates Javascript files in `dist/`.
* **Manual Test**: Verify running `npx tsc --noEmit` returns zero errors.
* **Failure Scenarios**: Check that compiling fails if syntax errors are intentionally introduced.

# Risks
* Version conflicts in npm packages. Set versions explicitly.

# Notes
Ensure ESLint is configured to check boundary imports (e.g. Domain layer must not import from Presentation layer).
