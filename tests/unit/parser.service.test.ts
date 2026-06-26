import '../mocks/env.js';
import { describe, it, expect } from 'vitest';
import { ParserService } from '../../src/application/services/parser.service.js';

const parser = new ParserService();

const VALID_COMMENT = {
  filePath: 'src/auth.ts',
  lineNumber: 10,
  message: 'Potential SQL injection',
  severity: 'CRITICAL',
};

describe('ParserService.parse', () => {
  it('parses valid JSON response', () => {
    const raw = JSON.stringify({ comments: [VALID_COMMENT] });
    const result = parser.parse(raw);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]).toMatchObject(VALID_COMMENT);
  });

  it('returns empty comments for empty string', () => {
    expect(parser.parse('').comments).toHaveLength(0);
  });

  it('returns empty comments for whitespace only', () => {
    expect(parser.parse('   ').comments).toHaveLength(0);
  });

  it('strips markdown code block wrapper', () => {
    const raw = '```json\n' + JSON.stringify({ comments: [VALID_COMMENT] }) + '\n```';
    const result = parser.parse(raw);
    expect(result.comments).toHaveLength(1);
  });

  it('strips markdown code block without json tag', () => {
    const raw = '```\n' + JSON.stringify({ comments: [VALID_COMMENT] }) + '\n```';
    const result = parser.parse(raw);
    expect(result.comments).toHaveLength(1);
  });

  it('extracts JSON embedded in prose', () => {
    const raw = `Here is my analysis: ${JSON.stringify({ comments: [VALID_COMMENT] })} End.`;
    const result = parser.parse(raw);
    expect(result.comments).toHaveLength(1);
  });

  it('returns empty for completely invalid input', () => {
    const result = parser.parse('not json at all !!!');
    expect(result.comments).toHaveLength(0);
  });

  it('drops comments missing required filePath', () => {
    const raw = JSON.stringify({ comments: [{ lineNumber: 1, message: 'x', severity: 'INFO' }] });
    const result = parser.parse(raw);
    expect(result.comments).toHaveLength(0);
  });

  it('drops comments missing lineNumber', () => {
    const raw = JSON.stringify({ comments: [{ filePath: 'x.ts', message: 'x', severity: 'INFO' }] });
    const result = parser.parse(raw);
    expect(result.comments).toHaveLength(0);
  });

  it('drops comments with invalid severity', () => {
    const raw = JSON.stringify({ comments: [{ ...VALID_COMMENT, severity: 'BLOCKER' }] });
    const result = parser.parse(raw);
    expect(result.comments).toHaveLength(0);
  });

  it('keeps valid comments and drops invalid ones from same array', () => {
    const raw = JSON.stringify({
      comments: [
        VALID_COMMENT,
        { filePath: 'x.ts' },
        { ...VALID_COMMENT, filePath: 'src/other.ts', lineNumber: 20, severity: 'WARNING' },
      ],
    });
    const result = parser.parse(raw);
    expect(result.comments).toHaveLength(2);
  });

  it('handles response with zero comments', () => {
    const raw = JSON.stringify({ comments: [] });
    const result = parser.parse(raw);
    expect(result.comments).toHaveLength(0);
  });

  it('accepts all valid severity levels', () => {
    for (const severity of ['INFO', 'WARNING', 'CRITICAL']) {
      const raw = JSON.stringify({ comments: [{ ...VALID_COMMENT, severity }] });
      const result = parser.parse(raw);
      expect(result.comments).toHaveLength(1);
    }
  });

  it('normalizes leading slashes and dot-slashes in filePath', () => {
    const raw = JSON.stringify({
      comments: [
        { ...VALID_COMMENT, filePath: '/src/auth.ts' },
        { ...VALID_COMMENT, filePath: './src/db.ts' },
      ],
    });
    const result = parser.parse(raw);
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0]?.filePath).toBe('src/auth.ts');
    expect(result.comments[1]?.filePath).toBe('src/db.ts');
  });
});
