import Ajv from 'ajv';
import type { AiReviewComment, ReviewResult } from '../../domain/interfaces/ai-provider.interface.js';
import { logger } from '../../infrastructure/logging/logger.js';

// Loose top-level schema: only checks that `comments` is an array of objects.
// Per-comment required field validation is done individually below.
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    comments: {
      type: 'array',
      items: { type: 'object' },
    },
  },
  required: ['comments'],
  additionalProperties: true,
};

const COMMENT_SCHEMA = {
  type: 'object',
  properties: {
    filePath: { type: 'string' },
    lineNumber: { type: 'integer' },
    message: { type: 'string' },
    severity: { type: 'string', enum: ['INFO', 'WARNING', 'CRITICAL'] },
  },
  required: ['filePath', 'lineNumber', 'message', 'severity'],
  additionalProperties: true,
};

const ajv = new Ajv({ allErrors: true });
const validateReview = ajv.compile(REVIEW_SCHEMA);
const validateComment = ajv.compile(COMMENT_SCHEMA);

function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

function parseRaw(raw: string): unknown {
  const cleaned = stripMarkdown(raw);

  try {
    return JSON.parse(cleaned);
  } catch {
    // fallback: extract JSON boundaries
    const extracted = extractJson(cleaned);
    try {
      return JSON.parse(extracted);
    } catch {
      throw new Error(`Unable to parse AI response as JSON: ${cleaned.slice(0, 200)}`);
    }
  }
}

export interface IOutputParser {
  parse(rawText: string): ReviewResult;
}

export class ParserService implements IOutputParser {
  parse(rawText: string): ReviewResult {
    if (!rawText.trim()) {
      logger.warn('AI returned empty response');
      return { comments: [] };
    }

    let parsed: unknown;
    try {
      parsed = parseRaw(rawText);
    } catch (err) {
      logger.error('Failed to parse AI response', err instanceof Error ? err : new Error(String(err)));
      return { comments: [] };
    }

    if (!validateReview(parsed)) {
      logger.warn('AI response failed schema validation', undefined, {
        errors: validateReview.errors,
      });
      return { comments: [] };
    }

    const raw = parsed as { comments: unknown[] };
    const valid: AiReviewComment[] = [];
    let dropped = 0;

    for (const item of raw.comments) {
      if (validateComment(item)) {
        const comment = item as unknown as AiReviewComment;
        let normalizedPath = comment.filePath.trim();
        if (normalizedPath.startsWith('/')) {
          normalizedPath = normalizedPath.substring(1);
        } else if (normalizedPath.startsWith('./')) {
          normalizedPath = normalizedPath.substring(2);
        }
        comment.filePath = normalizedPath;
        valid.push(comment);
      } else {
        dropped++;
      }
    }

    if (dropped > 0) {
      logger.warn(`Dropped ${dropped} invalid comment(s) from AI response`);
    }

    logger.info('AI response parsed', undefined, { total: raw.comments.length, valid: valid.length, dropped });

    return { comments: valid };
  }
}

export const parserService = new ParserService();
