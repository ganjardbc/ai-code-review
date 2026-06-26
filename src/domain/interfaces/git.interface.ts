export interface IGitService {
  clone(repoUrl: string, branch: string, targetDir: string): Promise<void>;
  checkout(targetDir: string, commitSha: string): Promise<void>;
  generateDiff(targetDir: string, baseBranch: string, headBranch: string): Promise<string>;
}

export interface IWorkspaceManager {
  createWorkspace(): Promise<string>;
  cleanupWorkspace(dirPath: string): Promise<void>;
  validatePath(dirPath: string): boolean;
}

export interface IDiffGenerator {
  getDiff(workspacePath: string, base: string, head: string): Promise<string>;
}
