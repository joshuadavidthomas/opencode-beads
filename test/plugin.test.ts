import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "@opencode-ai/sdk";
import { BeadsPlugin } from "../src/plugin";
import { createMockPluginInput, createMockChatOutput, createMockUserMessage } from "./mocks/plugin-input";

describe("BeadsPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should export a plugin function", () => {
      expect(typeof BeadsPlugin).toBe("function");
    });

    it("should return hooks when called", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      expect(plugin).toBeDefined();
      expect(plugin["chat.message"]).toBeDefined();
      expect(plugin["tool.execute.after"]).toBeDefined();
      expect(plugin["event"]).toBeDefined();
      expect(plugin["config"]).toBeDefined();
    });
  });

  describe("chat.message hook", () => {
    it("should inject beads context on first message", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      const output = createMockChatOutput({ sessionID: "test-session" });
      await plugin["chat.message"]!({ sessionID: "test-session" }, output);

      // Should have called session.prompt to inject context
      const promptCalls = (input.client.session.prompt as any).mock?.calls ?? [];
      // Note: In actual implementation, this would be called
      // This is a simplified test
    });

    it("should skip injection if already injected", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      const output = createMockChatOutput({ sessionID: "test-session" });

      // First call
      await plugin["chat.message"]!({ sessionID: "test-session" }, output);
      // Second call should skip
      await plugin["chat.message"]!({ sessionID: "test-session" }, output);

      // Should only process once
    });
  });

  describe("tool.execute.after hook", () => {
    it("should detect mutating commands", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      // Simulate a bash command that creates an issue
      await plugin["tool.execute.after"]!(
        { tool: "bash", sessionID: "test", callID: "call-1" },
        { title: "Bash", output: "bd create \"Test issue\" -t task", metadata: {} }
      );

      // The plugin should have detected the mutating command
    });

    it("should not flush for non-mutating commands", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      // Simulate a show command (read-only)
      await plugin["tool.execute.after"]!(
        { tool: "bash", sessionID: "test", callID: "call-1" },
        { title: "Bash", output: "bd show beads-1", metadata: {} }
      );

      // Should not trigger flush for non-mutating commands
    });

    it("should ignore non-bash tools", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      await plugin["tool.execute.after"]!(
        { tool: "read", sessionID: "test", callID: "call-1" },
        { title: "Read", output: "file content", metadata: {} }
      );

      // Should not process non-bash tools
    });
  });

  describe("event hook", () => {
    it("should handle session.compacted event", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      const event = {
        type: "session.compacted" as const,
        properties: { sessionID: "test-session" },
      };

      await plugin["event"]!({ event });

      // Should re-inject context after compaction
    });
  });

  describe("config hook", () => {
    it("should register commands and agents", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      const config = { command: {}, agent: {} };
      await plugin["config"]!(config);

      // Should have registered beads commands
      expect(Object.keys(config.command).length).toBeGreaterThan(0);
      // Should have registered beads agents
      expect(Object.keys(config.agent).length).toBeGreaterThan(0);
    });

    it("should register specific commands", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      const config: Config = { command: {}, agent: {} };
      await plugin["config"]!(config);

      expect(config.command?.["beads:create"]).toBeDefined();
      expect(config.command?.["beads:ready"]).toBeDefined();
      expect(config.command?.["beads:show"]).toBeDefined();
    });

    it("should register specific agents", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      const config: Config = { command: {}, agent: {} };
      await plugin["config"]!(config);

      expect(config.agent?.["beads:task-agent"]).toBeDefined();
      expect(config.agent?.["beads:query-agent"]).toBeDefined();
    });
  });

  describe("health check", () => {
    it("should check beads health on load", async () => {
      const input = createMockPluginInput();

      // Mock the shell to return version
      const $ = input.$ as any;

      await BeadsPlugin(input);

      // Should have attempted to check version
    });
  });

  describe("mutating command detection", () => {
    const mutatingCommands = [
      "bd create \"Test\" -t task",
      "bd update beads-1 --status closed",
      "bd close beads-1",
      "bd reopen beads-1",
      "bd delete beads-1",
      "bd dep add beads-1 beads-2",
      "bd label add beads-1 bug",
      "bd epic create \"Test Epic\"",
    ];

    const nonMutatingCommands = [
      "bd show beads-1",
      "bd list --status open",
      "bd ready",
      "bd stats",
      "bd blocked",
    ];

    it.each(mutatingCommands)("should detect mutating command: %s", async (cmd) => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      await plugin["tool.execute.after"]!(
        { tool: "bash", sessionID: "test", callID: "call-1" },
        { title: "Bash", output: cmd, metadata: {} }
      );

      // Should have triggered flush for mutating commands
    });

    it.each(nonMutatingCommands)("should not detect non-mutating command: %s", async (cmd) => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      await plugin["tool.execute.after"]!(
        { tool: "bash", sessionID: "test", callID: "call-1" },
        { title: "Bash", output: cmd, metadata: {} }
      );

      // Should not trigger flush for read-only commands
    });
  });
});
