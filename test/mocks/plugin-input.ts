import type { PluginInput } from '@opencode-ai/sdk';

export function createMockPluginInput(overrides?: Partial<PluginInput>): PluginInput {
  return {
    client: {
      app: {
        log: () => {},
      },
    },
    ...overrides,
  } as unknown as PluginInput;
}
