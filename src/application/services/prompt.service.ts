const DIFF_MAX_BYTES = 40 * 1024; // 40KB

const IGNORED_FILE_PATTERNS: RegExp[] = [
  /^package-lock\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^composer\.lock$/,
  /^Gemfile\.lock$/,
  /^Cargo\.lock$/,
  /\.min\.js$/,
  /\.min\.css$/,
  /\.map$/,
  /^dist\//,
  /^build\//,
  /^\.next\//,
  /^out\//,
  /\.(png|jpg|jpeg|gif|svg|ico|webp|bmp|tiff|ttf|woff|woff2|eot|otf|pdf|zip|gz|tar)$/i,
];

const SYSTEM_PROMPT = `You are an expert senior software developer and security auditor.

Analyze the following git diff, looking for:
- Security vulnerabilities (injection, XSS, SSRF, insecure deserialization, etc.)
- Memory leaks and resource management issues
- Performance bottlenecks and inefficiencies
- Race conditions and concurrency bugs
- Edge-case logical bugs and incorrect error handling
- Readability and maintainability issues that violate clean-code conventions

Do NOT comment on stylistic preferences such as tabs vs spaces, quote styles, or formatting unless they violate a major convention.

Return your evaluation ONLY as a valid, parseable JSON object. Do NOT include markdown wraps (like \`\`\`json), introduction text, or conclusion text.

Required output format:
{
  "comments": [
    {
      "filePath": "relative/path/to/file.ts",
      "lineNumber": 42,
      "message": "Actionable feedback explaining the issue and how to fix it.",
      "severity": "INFO | WARNING | CRITICAL"
    }
  ]
}

If there are no issues, return: { "comments": [] }`;

function isIgnoredFile(filePath: string, extraPatterns: RegExp[] = []): boolean {
  const normalized = filePath.replace(/^[ab]\//, '');
  return IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    extraPatterns.some((pattern) => pattern.test(normalized));
}

// Converts a simple glob (supporting `*`, `**`, `?`) into an anchored RegExp.
function globToRegex(glob: string): RegExp {
  let result = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*') {
      if (glob[i + 1] === '*') {
        result += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        result += '[^/]*';
      }
    } else if (c === '?') {
      result += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      result += '\\' + c;
    } else {
      result += c;
    }
  }
  return new RegExp(`^${result}$`);
}

function trimContext(hunk: string, maxContext = 3): string {
  const lines = hunk.split('\n');
  const result: string[] = [];
  let contextBuffer: string[] = [];

  for (const line of lines) {
    const isChange = line.startsWith('+') || line.startsWith('-');
    const isHeader = line.startsWith('@') || line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++');

    if (isHeader) {
      result.push(...contextBuffer.slice(-maxContext));
      contextBuffer = [];
      result.push(line);
    } else if (isChange) {
      result.push(...contextBuffer.slice(-maxContext));
      contextBuffer = [];
      result.push(line);
    } else {
      contextBuffer.push(line);
    }
  }

  // trailing context
  result.push(...contextBuffer.slice(0, maxContext));
  return result.join('\n');
}

function splitByFile(diff: string): Array<{ header: string; content: string; path: string }> {
  const blocks: Array<{ header: string; content: string; path: string }> = [];
  const fileChunks = diff.split(/(?=^diff --git )/m);

  for (const chunk of fileChunks) {
    if (!chunk.trim()) continue;

    const pathMatch = chunk.match(/^diff --git a\/(.*?) b\//m);
    const path = pathMatch?.[1] ?? '';
    const firstLine = chunk.split('\n')[0] ?? '';

    blocks.push({ header: firstLine, content: chunk, path });
  }

  return blocks;
}

export interface PromptBuildOptions {
  extraIgnoreGlobs?: string[];
  promptExtra?: string;
}

export interface IPromptBuilder {
  build(diffText: string, options?: PromptBuildOptions): string;
}

export class PromptService implements IPromptBuilder {
  build(diffText: string, options: PromptBuildOptions = {}): string {
    const extraPatterns = (options.extraIgnoreGlobs ?? []).map(globToRegex);
    const files = splitByFile(diffText);

    const filtered = files.filter((f) => !isIgnoredFile(f.path, extraPatterns));

    const trimmed = filtered.map((f) => ({
      ...f,
      content: trimContext(f.content),
    }));

    let assembled = trimmed.map((f) => f.content).join('\n');

    let truncated = false;
    if (Buffer.byteLength(assembled, 'utf-8') > DIFF_MAX_BYTES) {
      let size = 0;
      const kept: string[] = [];

      for (const f of trimmed) {
        const bytes = Buffer.byteLength(f.content, 'utf-8');
        if (size + bytes > DIFF_MAX_BYTES) {
          truncated = true;
          break;
        }
        kept.push(f.content);
        size += bytes;
      }

      assembled = kept.join('\n');
    }

    const notice = truncated
      ? '\n\n[TRUNCATED: diff exceeded 40KB limit. Some files were omitted from this review.]'
      : '';

    const extraContext = options.promptExtra
      ? `\n\nAdditional project context:\n${options.promptExtra.trim()}`
      : '';

    return `${SYSTEM_PROMPT}${extraContext}\n\n--- GIT DIFF ---\n${assembled}${notice}`;
  }
}

export const promptService = new PromptService();
