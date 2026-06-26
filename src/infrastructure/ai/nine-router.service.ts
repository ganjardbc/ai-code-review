import axios, { type AxiosInstance, isAxiosError } from 'axios';
import type { IAiProvider, ReviewResult } from '../../domain/interfaces/ai-provider.interface.js';
import type { IOutputParser } from '../../application/services/parser.service.js';
import { config } from '../../config/index.js';
import { AiProviderError } from '../../domain/errors/app-errors.js';
import { logger } from '../logging/logger.js';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  response_format: { type: 'json_object' };
  max_tokens: number;
}

interface ChatChoice {
  message: { content: string };
  finish_reason: string;
}

interface ChatResponse {
  choices: ChatChoice[];
}

export class NineRouterService implements IAiProvider {
  private readonly client: AxiosInstance;
  private readonly parser: IOutputParser;

  constructor(parser: IOutputParser) {
    this.parser = parser;
    this.client = axios.create({
      baseURL: config.NINE_ROUTER_BASE_URL,
      timeout: 120_000,
      headers: {
        'Authorization': `Bearer ${config.NINE_ROUTER_API_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async review(prompt: string): Promise<ReviewResult> {
    const payload: ChatRequest = {
      model: config.NINE_ROUTER_MODEL,
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    };

    logger.info('Sending review request to 9Router');

    try {
      const response = await this.client.post<ChatResponse>('/chat/completions', payload);
      const raw = response.data.choices[0]?.message.content ?? '';

      logger.debug('Received AI response', undefined, { length: raw.length });

      return this.parser.parse(raw);
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status ?? 0;
        const body = JSON.stringify(err.response?.data ?? {});

        if (status === 429) {
          throw new AiProviderError(`9Router rate limit exceeded: ${body}`);
        }
        if (status === 401 || status === 403) {
          throw new AiProviderError(`9Router authentication failed: ${body}`);
        }
        if (status >= 500 || status === 0) {
          throw new AiProviderError(`9Router gateway error (${status}): ${body}`);
        }

        throw new AiProviderError(`9Router request failed (${status}): ${body}`);
      }

      throw new AiProviderError(`AI provider unexpected error: ${String(err)}`);
    }
  }
}


