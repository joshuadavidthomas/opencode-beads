import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginInput } from "@opencode-ai/plugin";
import { BeadsPlugin } from "../src/plugin";
import { createMockPluginInput, createMockMessages } from "./mocks/plugin-input";

describe("BeadsPlugin", () => {
  describe("initialization", () => {
    it("should load successfully", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      expect(plugin).toBeDefined();
      expect(plugin.config).toBeDefined();
      expect(plugin["chat.message"]).toBeDefined();
      expect(plugin["tool.execute.after"]).toBeDefined();
      expect(plugin.event).toBeDefined();
    });

    it("should check beads health on load", async () => {
      const input = createMockPluginInput();
      await BeadsPlugin(input);

      // Should call bd version for health check
      expect(input.$).toHaveBeenCalled();
    });
  });

  describe("config", () => {
    it("should register commands and agents", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      const config = { command: {}, agent: {} };
      await plugin.config(config);

      // Should have registered commands
      expect(Object.keys(config.command).length).toBeGreaterThan(0);
      // Should have registered agents
      expect(Object.keys(config.agent).length).toBeGreaterThan(0);
    });

    it("should register known commands", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      const config = { command: {}, agent: {} };
      await plugin.config(config);

      // Check for expected commands
      expect(config.command).toHaveProperty("beads:ready");
      expect(config.command).toHaveProperty("beads:create");
      expect(config.command).toHaveProperty("beads:show");
      expect(config.command).toHaveProperty("beads:list");
      expect(config.command).toHaveProperty("beads:status");
      expect(config.command).toHaveProperty("beads:doctor");
      expect(config.command).toHaveProperty("beads:query");
      expect(config.command).toHaveProperty("beads:stale");
    });

    it("should register known agents", async () => {
      const input = createMockPluginInput();
      const plugin = await BeadsPlugin(input);

      const config = { command: {}, agent: {} };
      await plugin.config(config);

      // Check for expected agents
      expect(config.agent).toHaveProperty("beads:task-agent");
      expect(config.agent).toHaveProperty("beads:query-agent");
      expect(config.agent).toHaveProperty("beads:cleanup-agent");
      expect(config.agent).toHaveProperty("beads:description-validator-agent");
    });
  });

  describe("chat.message handler", () => {
    it("should inject context for new sessions", async () => {
      const mockMessages = createMockMessages([]);
      const client = {
        session: {
          messages: vi.fn().mockResolvedValue(mockMessages),
          prompt: vi.fn().mockResolvedValue(undefined),
        },
        app: { log: vi.fn() },
      };

      const shellResponses: Record<string, string> = {
        "bd version": "0.50.3",
        "bd prime": "Beads context loaded",
      };

      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        return {
          text: () => Promise.resolve(shellResponses[cmd] ?? ""),
          quiet: () => Promise.resolve({ text: () => Promise.resolve("") }),
        };
      }) as unknown as PluginInput["$"];

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      await plugin["chat.message"]({} as any, {
        message: { sessionID: "test-session", model: undefined, agent: undefined },
      });

      // Should have checked for existing context
      expect(client.session.messages).toHaveBeenCalled();
      // Should have injected context
      expect(client.session.prompt).toHaveBeenCalled();
    });

    it("should skip injection if context already exists", async () => {
      const mockMessages = createMockMessages([
        {
          role: "user",
          parts: [{ type: "text", text: "<beads-context>existing</beads-context>" }],
        },
      ]);

      const client = {
        session: {
          messages: vi.fn().mockResolvedValue(mockMessages),
          prompt: vi.fn().mockResolvedValue(undefined),
        },
        app: { log: vi.fn() },
      };

      const $ = vi.fn().mockResolvedValue({
        text: () => Promise.resolve(""),
      }) as unknown as PluginInput["$"];

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      await plugin["chat.message"]({} as any, {
        message: { sessionID: "test-session", model: undefined, agent: undefined },
      });

      // Should not inject context if already present
      expect(client.session.prompt).not.toHaveBeenCalled();
    });
  });

  describe("tool.execute.after handler", () => {
    it("should auto-flush after mutating commands", async () => {
      const flushCalls: string[] = [];
      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        if (cmd.includes("sync --flush-only")) {
          flushCalls.push(cmd);
        }
        return {
          text: () => Promise.resolve(""),
          quiet: () => Promise.resolve({ text: () => Promise.resolve("") }),
        };
      }) as unknown as PluginInput["$"];

      const client = {
        session: { messages: vi.fn(), prompt: vi.fn() },
        app: { log: vi.fn() },
      };

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      // Simulate mutating commands
      const mutatingCommands = [
        "bd create 'test issue' -t bug",
        "bd update bd-123 --status closed",
        "bd close bd-456 --reason 'done'",
        "bd delete bd-789",
        "bd dep add bd-123 bd-456",
        "bd label add bd-123 bug",
        "bd epic create 'test epic'",
      ];

      for (const command of mutatingCommands) {
        await plugin["tool.execute.after"](
          {
            tool: "bash",
            sessionID: "test-session",
            callID: "test-call",
          },
          {
            title: "",
            output: "",
            metadata: { command },
          }
        );
      }

      // Should have flushed for each mutating command
      expect(flushCalls.length).toBe(mutatingCommands.length);
    });

    it("should not flush after non-mutating commands", async () => {
      const flushCalls: string[] = [];
      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        if (cmd.includes("sync --flush-only")) {
          flushCalls.push(cmd);
        }
        return {
          text: () => Promise.resolve(""),
          quiet: () => Promise.resolve({ text: () => Promise.resolve("") }),
        };
      }) as unknown as PluginInput["$"];

      const client = {
        session: { messages: vi.fn(), prompt: vi.fn() },
        app: { log: vi.fn() },
      };

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      // Simulate non-mutating commands
      const nonMutatingCommands = [
        "bd show bd-123",
        "bd list --status open",
        "bd ready",
        "bd blocked",
        "bd stats",
      ];

      for (const command of nonMutatingCommands) {
        await plugin["tool.execute.after"](
          {
            invocation: { tool: "bash", params: { command } },
            output: {},
          } as any,
          {} as any
        );
      }

      // Should not have flushed for non-mutating commands
      expect(flushCalls.length).toBe(0);
    });

    it("should handle non-bash tools", async () => {
      const shellCalls: string[] = [];
      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        shellCalls.push(cmd);
        return {
          text: () => Promise.resolve(""),
          quiet: () => Promise.resolve({ text: () => Promise.resolve("") }),
        };
      }) as unknown as PluginInput["$"];

      const client = {
        session: { messages: vi.fn(), prompt: vi.fn() },
        app: { log: vi.fn() },
      };

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      // Clear the health check call
      shellCalls.length = 0;

      await plugin["tool.execute.after"](
        {
          invocation: { tool: "read", params: { file_path: "/test" } },
          output: {},
        } as any,
        {} as any
      );

      // Should not have any new shell calls for non-bash tools
      expect(shellCalls.length).toBe(0);
    });
  });

  describe("checkBeadsHealth", () => {
    it("should return true when beads CLI is available", async () => {
      const $ = vi.fn().mockImplementation(() => ({
        text: () => Promise.resolve("0.50.3"),
      })) as unknown as PluginInput["$"];

      const client = {
        session: { messages: vi.fn(), prompt: vi.fn() },
        app: { log: vi.fn() },
      };

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      // Health check should have logged success
      expect(client.app.log).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            message: expect.stringContaining("Beads CLI is available"),
          }),
        })
      );
    });

    it("should handle beads CLI not found error", async () => {
      const error = new Error("Command not found: bd");
      const $ = vi.fn().mockImplementation(() => {
        throw error;
      }) as unknown as PluginInput["$"];

      const client = {
        session: { messages: vi.fn(), prompt: vi.fn() },
        app: { log: vi.fn() },
      };

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      // Should log warning about CLI not found
      expect(client.app.log).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            level: "warn",
            message: expect.stringContaining("Beads CLI not found"),
          }),
        })
      );
    });
  });

  describe("injectBeadsContext", () => {
    it("should skip injection when prime output is empty", async () => {
      const mockMessages = createMockMessages([]);
      const client = {
        session: {
          messages: vi.fn().mockResolvedValue(mockMessages),
          prompt: vi.fn().mockResolvedValue(undefined),
        },
        app: { log: vi.fn() },
      };

      const shellResponses: Record<string, string> = {
        "bd version": "0.50.3",
        "bd prime": "", // Empty output
      };

      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        return {
          text: () => Promise.resolve(shellResponses[cmd] ?? ""),
          quiet: () => Promise.resolve({ text: () => Promise.resolve("") }),
        };
      }) as unknown as PluginInput["$"];

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      await plugin["chat.message"]({} as any, {
        message: { sessionID: "test-session", model: undefined, agent: undefined },
      });

      // Should log empty output message
      expect(client.app.log).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            message: expect.stringContaining("Empty beads prime output"),
          }),
        })
      );
      // Should not inject context
      expect(client.session.prompt).not.toHaveBeenCalled();
    });

    it("should handle 'not found' error in injectBeadsContext", async () => {
      const mockMessages = createMockMessages([]);
      const client = {
        session: {
          messages: vi.fn().mockResolvedValue(mockMessages),
          prompt: vi.fn().mockRejectedValue(new Error("Command not found: bd")),
        },
        app: { log: vi.fn() },
      };

      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        if (cmd === "bd version") {
          return { text: () => Promise.resolve("0.50.3") };
        }
        if (cmd === "bd prime") {
          return {
            text: () => Promise.reject(new Error("Command not found: bd")),
          };
        }
        return { text: () => Promise.resolve("") };
      }) as unknown as PluginInput["$"];

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      await plugin["chat.message"]({} as any, {
        message: { sessionID: "test-session", model: undefined, agent: undefined },
      });

      // Should log warning about CLI not installed
      const warnCalls = (client.app.log as any).mock.calls.filter(
        (call: any[]) => call[0]?.body?.level === "warn"
      );
      expect(warnCalls.length).toBeGreaterThan(0);
    });

    it("should handle 'not initialized' error in injectBeadsContext", async () => {
      const mockMessages = createMockMessages([]);
      const client = {
        session: {
          messages: vi.fn().mockResolvedValue(mockMessages),
          prompt: vi.fn().mockResolvedValue(undefined),
        },
        app: { log: vi.fn() },
      };

      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        if (cmd === "bd version") {
          return { text: () => Promise.resolve("0.50.3") };
        }
        if (cmd === "bd prime") {
          return {
            text: () =>
              Promise.reject(new Error("Beads not initialized: no .beads directory found")),
          };
        }
        return { text: () => Promise.resolve("") };
      }) as unknown as PluginInput["$"];

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      await plugin["chat.message"]({} as any, {
        message: { sessionID: "test-session", model: undefined, agent: undefined },
      });

      // Should log warning about not initialized
      expect(client.app.log).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            level: "warn",
            message: expect.stringContaining("not initialized"),
          }),
        })
      );
    });

    it("should handle generic error in injectBeadsContext", async () => {
      const mockMessages = createMockMessages([]);
      const client = {
        session: {
          messages: vi.fn().mockResolvedValue(mockMessages),
          prompt: vi.fn().mockResolvedValue(undefined),
        },
        app: { log: vi.fn() },
      };

      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        if (cmd === "bd version") {
          return { text: () => Promise.resolve("0.50.3") };
        }
        if (cmd === "bd prime") {
          return {
            text: () => Promise.reject(new Error("Some other error")),
          };
        }
        return { text: () => Promise.resolve("") };
      }) as unknown as PluginInput["$"];

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      await plugin["chat.message"]({} as any, {
        message: { sessionID: "test-session", model: undefined, agent: undefined },
      });

      // Should log info about generic failure
      expect(client.app.log).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            level: "info",
            message: expect.stringContaining("Failed to inject beads context"),
          }),
        })
      );
    });

    it("should handle error when checking existing context", async () => {
      const client = {
        session: {
          messages: vi.fn().mockRejectedValue(new Error("Session not found")),
          prompt: vi.fn().mockResolvedValue(undefined),
        },
        app: { log: vi.fn() },
      };

      const shellResponses: Record<string, string> = {
        "bd version": "0.50.3",
        "bd prime": "Beads context loaded",
      };

      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        return {
          text: () => Promise.resolve(shellResponses[cmd] ?? ""),
          quiet: () => Promise.resolve({ text: () => Promise.resolve("") }),
        };
      }) as unknown as PluginInput["$"];

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      await plugin["chat.message"]({} as any, {
        message: { sessionID: "test-session", model: undefined, agent: undefined },
      });

      // Should log debug message about error checking context
      expect(client.app.log).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            level: "debug",
            message: expect.stringContaining("Error checking existing context"),
          }),
        })
      );
      // Should still inject context after error
      expect(client.session.prompt).toHaveBeenCalled();
    });
  });

  describe("autoFlushAfterMutation", () => {
    it("should handle sync failure gracefully", async () => {
      const flushCalls: string[] = [];
      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        if (cmd === "bd version") {
          return { text: () => Promise.resolve("0.50.3") };
        }
        if (cmd.includes("sync --flush-only")) {
          flushCalls.push(cmd);
          return Promise.reject(new Error("Sync failed"));
        }
        return { text: () => Promise.resolve("") };
      }) as unknown as PluginInput["$"];

      const client = {
        session: { messages: vi.fn(), prompt: vi.fn() },
        app: { log: vi.fn() },
      };

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      await plugin["tool.execute.after"](
        {
          tool: "bash",
          sessionID: "test-session",
          callID: "test-call",
        },
        {
          title: "",
          output: "",
          metadata: { command: "bd create 'test issue' -t bug" },
        }
      );

      // Should have attempted to flush
      expect(flushCalls.length).toBe(1);
      // Should log debug message about failure (non-blocking)
      expect(client.app.log).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            level: "debug",
            message: expect.stringContaining("auto-flush failed"),
          }),
        })
      );
    });
  });

  describe("event handler", () => {
    it("should re-inject context after session compaction", async () => {
      const client = {
        session: {
          messages: vi.fn().mockResolvedValue({ data: [] }),
          prompt: vi.fn().mockResolvedValue(undefined),
        },
        app: { log: vi.fn() },
      };

      const shellResponses: Record<string, string> = {
        "bd version": "0.50.3",
        "bd prime": "Beads context",
      };

      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        return {
          text: () => Promise.resolve(shellResponses[cmd] ?? ""),
          quiet: () => Promise.resolve({ text: () => Promise.resolve("") }),
        };
      }) as unknown as PluginInput["$"];

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      await plugin.event(
        { event: { type: "session.compacted", properties: { sessionID: "test-session" } } },
        {} as any
      );

      // Should have prompted with beads context
      expect(client.session.prompt).toHaveBeenCalled();
    });

    it("should ignore non-compaction events", async () => {
      const client = {
        session: {
          messages: vi.fn(),
          prompt: vi.fn(),
        },
        app: { log: vi.fn() },
      };

      const $ = vi.fn() as unknown as PluginInput["$"];

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      await plugin.event({ event: { type: "other.event", properties: {} } }, {} as any);

      // Should not have prompted
      expect(client.session.prompt).not.toHaveBeenCalled();
    });

    it("should handle error when getting session context", async () => {
      const client = {
        session: {
          messages: vi.fn().mockRejectedValue(new Error("Session not found")),
          prompt: vi.fn().mockResolvedValue(undefined),
        },
        app: { log: vi.fn() },
      };

      const shellResponses: Record<string, string> = {
        "bd version": "0.50.3",
        "bd prime": "Beads context",
      };

      const $ = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
        const cmd = strings[0].trim();
        return {
          text: () => Promise.resolve(shellResponses[cmd] ?? ""),
          quiet: () => Promise.resolve({ text: () => Promise.resolve("") }),
        };
      }) as unknown as PluginInput["$"];

      const input = createMockPluginInput({
        client: client as unknown as PluginInput["client"],
        $,
      });
      const plugin = await BeadsPlugin(input);

      await plugin.event(
        { event: { type: "session.compacted", properties: { sessionID: "test-session" } } },
        {} as any
      );

      // Should log info about failed session context
      expect(client.app.log).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            level: "info",
            message: expect.stringContaining("Failed to get session context"),
          }),
        })
      );
      // Should still inject context even after error
      expect(client.session.prompt).toHaveBeenCalled();
    });
  });
});
