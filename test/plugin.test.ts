import { describe, it, expect } from 'vitest';
import { createMockPluginInput } from './mocks/plugin-input';

describe('plugin', () => {
  it('should create mock plugin input', () => {
    const input = createMockPluginInput();
    expect(input).toBeDefined();
    expect(input.client).toBeDefined();
  });
});
