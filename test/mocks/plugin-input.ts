/**
 * Mock utilities for PluginInput testing
 *
 * Provides factories for creating mock OpenCode client, shell, and PluginInput
 * objects for testing the beads plugin.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { OpencodeClient } from "@opencode-ai/sdk";

/**
 * Create a mock OpenCode client
 */
export function createMockClient(): OpencodeClient {
  const logEntries: { level: string; message: string; extra?: Record<string, unknown> }[] = [];

  const mockClient = {
    global: {
      event: async () => ({ data: null }),
    },
    project: {
      list: async () => ({ data: [] }),
      current: async () => ({ data: { id: "test-project", name: "Test Project" } }),
    },
    session: {
      list: async () => ({ data: [] }),
      messages: async () => ({ data: [] }),
      prompt: async () => ({ data: null }),
      status: async () => ({ data: { id: "test-session", status: "active" } }),
    },
    app: {
      log: async (options: {
        body: { service: string; level: string; message: string; extra?: Record<string, unknown> };
      }) => {
        logEntries.push({
          level: options.body.level,
          message: options.body.message,
          extra: options.body.extra,
        });
        return { data: null };
      },
      agents: async () => ({ data: [] }),
    },
    config: {
      get: async () => ({ data: {} }),
      update: async () => ({ data: null }),
    },
    _logEntries: logEntries,
    _getLogs: () => logEntries,
    _clearLogs: () => {
      logEntries.length = 0;
    },
  } as unknown as OpencodeClient;

  return mockClient;
}

/**
 * Create a mock BunShell function
 */
export function createMockShell(): PluginInput["$"] {
  const executedCommands: { command: string; options?: Record<string, unknown> }[] = [];

  const mockShell = Object.assign(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const command = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
      executedCommands.push({ command });

      return {
        text: async () => "mock-output",
        json: async () => ({}),
        quiet: async () => ({ text: async () => "" }),
        _command: command,
      };
    },
    {
      _commands: executedCommands,
      _getCommands: () => executedCommands,
      _clearCommands: () => {
        executedCommands.length = 0;
      },
    }
  ) as unknown as PluginInput["$"];

  return mockShell;
}

/**
 * Create a complete mock PluginInput
 */
export function createMockPluginInput(
  options: {
    directory?: string;
    worktree?: string;
  } = {}
): PluginInput {
  const client = createMockClient();
  const $ = createMockShell();

  return {
    client,
    $,
    project: {
      id: "test-project",
      worktree: options.worktree ?? "/test",
      time: { created: Date.now() },
    },
    directory: options.directory ?? "/test",
    worktree: options.worktree ?? "/test",
  };
}

/**
 * Helper to create a mock user message
 */
export function createMockUserMessage(
  overrides: {
    sessionID?: string;
    agent?: string;
    model?: { providerID: string; modelID: string };
  } = {}
) {
  return {
    id: "msg-1",
    sessionID: overrides.sessionID ?? "session-1",
    role: "user" as const,
    time: { created: Date.now() },
    agent: overrides.agent ?? "test-agent",
    model: overrides.model ?? { providerID: "test", modelID: "test-model" },
    parts: [
      {
        type: "text" as const,
        text: "test message",
        id: "part-1",
        sessionID: "session-1",
        messageID: "msg-1",
      },
    ],
  };
}

/**
 * Helper to create mock chat.message output
 */
export function createMockChatOutput(
  overrides: {
    sessionID?: string;
    agent?: string;
    model?: { providerID: string; modelID: string };
  } = {}
) {
  const message = createMockUserMessage(overrides);
  return {
    message,
    parts: message.parts,
  };
}
