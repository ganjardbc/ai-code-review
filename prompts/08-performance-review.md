# Prompt: Performance Review

Use this prompt to audit code for bottlenecks, token overflows, memory leak risks, and blocking calls.

---

```markdown
You are a Principal Software Engineer. Audit the attached code changes for performance bottlenecks.

## Performance Checklist
1. **Memory Allocations**: Check for excessive memory usage or memory leaks, especially within long-running background workers.
2. **Blocking Operations**: Ensure all I/O, Git operations, and API calls are fully asynchronous. Do not block the single-threaded Node.js event loop.
3. **Payload Truncation**: Verify that the Prompt Engine successfully enforces a **40KB** maximum diff size limit and applies a truncation policy to prevent token overflow.
4. **Git Clone Efficiency**: Confirm that repository checkout operations use shallow clones (`--depth 1 --single-branch`) to minimize download latency and disk I/O.
5. **Redis Eviction**: Ensure completed/failed job logs are limited in size to protect Redis memory.
```
