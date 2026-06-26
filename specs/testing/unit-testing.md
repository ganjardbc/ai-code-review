# Unit Testing Specification

## Purpose
Expose unit testing mock structures.

## Specifications
* Use `jest` for mocking dependencies.
* Mock `axios` endpoints for AI responses returning matching schemas.
* Mock `execa` to return test diff files.
* Mock VCS providers:
  ```typescript
  jest.mock('@octokit/rest', () => ({
    Octokit: jest.fn().mockImplementation(() => ({
      rest: {
        pulls: {
          createReview: jest.fn().mockResolvedValue({ status: 200 })
        }
      }
    }))
  }));
  ```
