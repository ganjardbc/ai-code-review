import '../mocks/env.js';
import { describe, it, expect } from 'vitest';
import { DirectApiRunner } from '../../src/infrastructure/ai/direct-api.runner.js';
import { NineRouterService } from '../../src/infrastructure/ai/nine-router.service.js';

describe('DirectApiRunner', () => {
  it('is the NineRouterService implementation', () => {
    expect(DirectApiRunner).toBe(NineRouterService);
  });

  it('implements IAiProvider interface', () => {
    const parser = { parse: () => ({ comments: [] }) };
    const runner = new DirectApiRunner(parser);
    expect(typeof runner.review).toBe('function');
  });
});
