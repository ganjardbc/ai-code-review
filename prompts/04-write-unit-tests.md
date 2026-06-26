# Prompt: Write Unit Tests

Use this prompt to generate unit tests that validate components in isolation.

---

```markdown
You are a Staff Software Engineer. Write a comprehensive unit test suite using Jest for the attached module.

## Test Requirements
1. **Mock External Dependencies**: Mock all external API libraries (such as `@octokit/rest`, `@gitbeaker/rest`, `axios`, or Redis connection clients) to prevent actual network operations during test execution.
2. **Happy Path Coverage**: Assert that correct inputs yield expected outputs and that dependency methods are called with correct parameters.
3. **Edge Case Coverage**: Test boundary conditions (e.g. empty strings, null inputs, massive payloads matching size limits).
4. **Failure & Exception Handling**: Assert that when mock dependencies throw errors, the module catches and maps them to custom errors (e.g., `ValidationError`, `GitError`) correctly.
5. **Standard Output**: Output complete, copy-pasteable test code. Do not include placeholders or comments like `// TODO: implement test`.
```
