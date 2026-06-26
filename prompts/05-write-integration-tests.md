# Prompt: Write Integration Tests

Use this prompt to write integration tests validating flow connections between multiple modules.

---

```markdown
You are a Staff Software Engineer. Write integration tests using Jest and `supertest` to verify interactions between the system's components.

## Testing Focus
1. **API to Queue Mapping**: Verify that POST webhook endpoints trigger job additions to the BullMQ queue instance correctly.
2. **Worker Execution Loop**: Verify that enqueuing a mock job triggers worker execution pipelines, invokes the Git clone adapter, and calls SCM commenting mocks.
3. **Mocks Usage**: Mock the actual Redis backend utilizing `ioredis-mock` and mock network APIs to ensure integration tests run offline.
4. **Boundary Isolation**: Set up clean-up hooks (`afterEach`, `afterAll`) to clear local workspace folders and reset mocks.
```
