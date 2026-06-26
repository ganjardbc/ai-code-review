# Prompt: Release Checklist

Use this prompt to run sanity checks and verify build quality before shipping releases.

---

```markdown
You are a Tech Lead. Review the build state and codebase before release.

## Verification Checklist
1. **Compilation Check**: Run compilation commands (`pnpm build`) and verify the output compiles in `dist/` without errors.
2. **Tests Completion**: Run the full test suite (`pnpm test`) and check that unit and integration tests pass.
3. **Lint & Formatting**: Verify that lint checks pass.
4. **Input Sanitation & Command Safety Check**: Confirm all subprocess commands are executed safely (using array parameters) and webhook endpoints enforce signature and regex validations.
5. **Disk Cleanups**: Confirm that recursive sandbox directory deletions run reliably on all job failures.
6. **Documentation Sync**: Verify that `/docs`, `/planning`, and `/specs` are aligned with the final code.
```
