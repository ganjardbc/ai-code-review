import { spawn } from 'child_process';
import type { IAiProvider, ReviewResult, FixResult } from '../../domain/interfaces/ai-provider.interface.js';
import type { IOutputParser, IFixOutputParser } from '../../application/services/parser.service.js';
import { AiProviderError } from '../../domain/errors/app-errors.js';
import { logger } from '../logging/logger.js';

function extractTextFromEvents(ndjson: string): string {
  const parts: string[] = [];

  for (const line of ndjson.trim().split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const part = event['part'] as Record<string, unknown> | undefined;
      if (event['type'] === 'text' && part?.['type'] === 'text' && typeof part['text'] === 'string') {
        parts.push(part['text']);
      }
    } catch { /* skip non-JSON or unknown event lines */ }
  }

  return parts.join('');
}

export class OpenCodeRunner implements IAiProvider {
  constructor(
    private readonly parser: IOutputParser & IFixOutputParser,
    private readonly timeoutMs: number = 120_000,
    private readonly command: string = 'opencode',
  ) {}

  async review(prompt: string): Promise<ReviewResult> {
    logger.info('Sending review request to opencode CLI');

    const raw = await this.execute(prompt);

    logger.debug('Received opencode response', undefined, { length: raw.length });

    return this.parser.parse(raw);
  }

  async fix(prompt: string): Promise<FixResult> {
    logger.info('Sending fix request to opencode CLI');

    const raw = await this.execute(prompt);

    logger.debug('Received opencode fix response', undefined, { length: raw.length });

    return this.parser.parseFix(raw);
  }

  private execute(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const child = spawn(this.command, ['run', '--format', 'json', prompt], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(new AiProviderError(`opencode timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.on('close', (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        if (code !== 0) {
          reject(new AiProviderError(`opencode exited with code ${code ?? 'null'}: ${stderr.slice(0, 500)}`));
          return;
        }

        resolve(extractTextFromEvents(stdout));
      });

      child.on('error', (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new AiProviderError(`opencode spawn error: ${err.message}`));
      });
    });
  }
}
