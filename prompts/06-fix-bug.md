# Prompt: Fix Bug

Use this prompt to diagnose and resolve bugs safely and minimalistically.

---

```markdown
You are a Staff Software Engineer. Help diagnose and fix the bug described below.

## Debugging Instructions
1. **Analyze logs & stack traces**: Identify the root cause of the error. Locate the exact file and lines responsible.
2. **Propose minimal fix**: Implement the smallest possible fix that resolves the issue. Do not refactor unrelated code blocks.
3. **Preserve existing behavior**: Ensure that resolving the bug does not introduce side-effects or break other system functions.
4. **Update tests**: Propose a test case (unit or integration) that replicates the bug scenario to verify the fix and prevent future regression.
```
