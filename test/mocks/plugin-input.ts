/**
 * Mock utilities for PluginInput testing.
 */

import type { PluginInput } from "@opencode-ai/plugin";

/**
 * Create a mock OpenCode client.
 */
export function createMockClient() {
  return {
    session: {
      messages: vi.fn().mockResolvedValue({ data: [] }),
      prompt: vi.fn().mockResolvedValue(undefined),
    },
    app: {
      log: vi.fn(),
    },
  };
}

/**
 * Create a mock shell function.
 */
export function createMockShell() {
  const mockShell = vi.fn();

  // Support template literal usage
  const shellProxy = new Proxy(mockShell, {
    get(target, prop) {
      if (prop === "quiet") {
        return () => ({ text: () => Promise.resolve("") });
      }
      return target[prop];
    },
  }) as unknown as PluginInput["$"];

  return shellProxy;
}

/**
 * Create a complete mock PluginInput.
 */
export function createMockPluginInput(
  overrides: Partial<PluginInput> = {}
): PluginInput {
  const client = createMockClient();
  const $ = createMockShell();

  return {
    client: client as unknown as PluginInput["client"],
    $,
    ...overrides,
  };
}

/**
 * Setup mock for bd prime output.
 */
export function mockBdPrime(
  client: ReturnType<typeof createMockClient>,
  output: string
) {
  const shellFn = vi.fn().mockResolvedValue({ text: () => Promise.resolve(output) });
  return shellFn;
}

/**
 * Create mock session messages for context injection testing.
 */
export function createMockMessages(messages: Array<{
  role: string;
  model?: { providerID: string; modelID: string };
  agent?: string;
  parts?: Array<{ type: string; text?: string }>;
}> = []) {
  return {
    data: messages.map((msg) => ({
      info: {
        role: msg.role,
        ...(msg.model && { model: msg.model }),
        ...(msg.agent && { agent: msg.agent }),
      },
      ...(msg.parts && { parts: msg.parts }),
    })),
  };
}
