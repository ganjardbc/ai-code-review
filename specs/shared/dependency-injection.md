# Dependency Injection Specification

## Purpose
Document how dependencies are wired together in the application.

## Specifications
* To support Clean Architecture decoupling, dependencies are injected manually in constructor configurations.
* **Factory Pattern**: Use a registry factory class to resolve VCS provider implementations dynamically based on payload context:
  ```typescript
  export class ScmProviderFactory {
    constructor(
      private readonly githubService: GithubService,
      private readonly gitlabService: GitlabService
    ) {}

    getProvider(type: 'github' | 'gitlab'): IScmProvider {
      if (type === 'github') return this.githubService;
      if (type === 'gitlab') return this.gitlabService;
      throw new Error(`Unsupported provider: ${type}`);
    }
  }
  ```
