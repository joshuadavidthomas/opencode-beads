import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'vendor/',
        '*.config.ts',
      ],
    },
  },
  // No path aliases to avoid conflicts with scoped packages like @opencode-ai/sdk
});
