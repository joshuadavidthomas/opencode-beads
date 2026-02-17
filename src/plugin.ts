/**
 * OpenCode Beads Plugin
 *
 * Integrates the beads issue tracker with OpenCode.
 *
 * Features:
 * - Context injection via `bd prime` on session start and after compaction
 * - Commands parsed from beads command definitions
 * - Task agent for autonomous issue completion
 * - Auto-flush after mutations to ensure JSONL is immediately updated
 * - Structured logging for debugging and health monitoring
 */

import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { BEADS_GUIDANCE, loadAgent, loadCommands } from "./vendor";

type OpencodeClient = PluginInput["client"];

/**
 * Commands that mutate the issue database and require auto-flush.
 */
const MUTATING_COMMANDS = [
  "create",
  "update",
  "close",
  "reopen",
  "delete",
  "dep",
  "label",
  "epic",
];

/**
 * Regex to detect mutating bd commands in bash tool invocations.
 */
const MUTATING_COMMAND_REGEX = new RegExp(
  `bd\\s+(?:${MUTATING_COMMANDS.join("|")})\\b`
);

/**
 * Check if a bash command is a mutating beads command.
 *
 * @param command - The bash command string
 * @returns true if the command mutates the issue database
 */
function isMutatingCommand(command: string): boolean {
  return MUTATING_COMMAND_REGEX.test(command);
}

/**
 * Get the current model/agent context for a session by querying messages.
 *
 * Mirrors OpenCode's internal lastModel() logic to find the most recent
 * user message. Used during event handling when we don't have direct access
 * to the current user message's context.
 */
async function getSessionContext(
  client: OpencodeClient,
  sessionID: string
): Promise<
  { model?: { providerID: string; modelID: string }; agent?: string } | undefined
> {
  try {
    const response = await client.session.messages({
      path: { id: sessionID },
      query: { limit: 50 },
    });

    if (response.data) {
      for (const msg of response.data) {
        if (msg.info.role === "user" && "model" in msg.info && msg.info.model) {
          return { model: msg.info.model, agent: msg.info.agent };
        }
      }
    }
  } catch (err) {
    // On error, return undefined (let opencode use its default)
    await client.app.log({
      body: {
        service: "beads-plugin",
        level: "debug",
        message: "Failed to get session context",
        extra: {
          sessionID,
          error: err instanceof Error ? err.message : String(err),
        },
      },
    });
  }

  return undefined;
}

/**
 * Check if the beads CLI is installed and compatible.
 *
 * @param $ - Plugin shell function
 * @param client - OpenCode client for logging
 * @returns true if beads is available
 */
async function checkBeadsHealth(
  $: PluginInput["$"],
  client: OpencodeClient
): Promise<boolean> {
  try {
    const result = await $`bd version`.text();
    await client.app.log({
      body: {
        service: "beads-plugin",
        level: "debug",
        message: "Beads CLI is available",
        extra: { version: result.trim() },
      },
    });
    return true;
  } catch (err) {
    await client.app.log({
      body: {
        service: "beads-plugin",
        level: "warn",
        message: "Beads CLI not found or not working. Install with: pip install beads-cli",
        extra: {
          error: err instanceof Error ? err.message : String(err),
        },
      },
    });
    return false;
  }
}

/**
 * Inject beads context into a session.
 *
 * Runs `bd prime` and injects the output along with CLI guidance.
 * Provides specific error messages for different failure modes.
 */
async function injectBeadsContext(
  client: OpencodeClient,
  $: PluginInput["$"],
  sessionID: string,
  context?: { model?: { providerID: string; modelID: string }; agent?: string }
): Promise<void> {
  try {
    await client.app.log({
      body: {
        service: "beads-plugin",
        level: "debug",
        message: "Injecting beads context",
        extra: { sessionID },
      },
    });

    const primeOutput = await $`bd prime`.text();

    if (!primeOutput || primeOutput.trim() === "") {
      await client.app.log({
        body: {
          service: "beads-plugin",
          level: "debug",
          message: "Empty beads prime output, skipping injection",
          extra: { sessionID },
        },
      });
      return;
    }

    const beadsContext = `<beads-context>
${primeOutput.trim()}
</beads-context>

${BEADS_GUIDANCE}`;

    // Inject content via noReply + synthetic
    // Must pass model and agent to prevent mode/model switching
    await client.session.prompt({
      path: { id: sessionID },
      body: {
        noReply: true,
        model: context?.model,
        agent: context?.agent,
        parts: [{ type: "text", text: beadsContext, synthetic: true }],
      },
    });

    await client.app.log({
      body: {
        service: "beads-plugin",
        level: "debug",
        message: "Beads context injected successfully",
        extra: { sessionID },
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Provide specific guidance based on error type
    if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      await client.app.log({
        body: {
          service: "beads-plugin",
          level: "warn",
          message: "Beads CLI not installed. Context injection skipped. Install with: pip install beads-cli",
          extra: { sessionID, error: errorMessage },
        },
      });
    } else if (
      errorMessage.includes("not initialized") ||
      errorMessage.includes("no .beads")
    ) {
      await client.app.log({
        body: {
          service: "beads-plugin",
          level: "warn",
          message: "Beads not initialized in this project. Run `bd init` to set up.",
          extra: { sessionID, error: errorMessage },
        },
      });
    } else {
      await client.app.log({
        body: {
          service: "beads-plugin",
          level: "warn",
          message: "Failed to inject beads context",
          extra: { sessionID, error: errorMessage },
        },
      });
    }
  }
}

/**
 * Auto-flush the beads database after a mutating command.
 *
 * Runs `bd sync --flush-only` to ensure the JSONL file is immediately updated.
 *
 * @param $ - Plugin shell function
 * @param client - OpenCode client for logging
 */
async function autoFlushAfterMutation(
  $: PluginInput["$"],
  client: OpencodeClient
): Promise<void> {
  try {
    await client.app.log({
      body: {
        service: "beads-plugin",
        level: "debug",
        message: "Auto-flushing beads database after mutation",
      },
    });
    await $`bd sync --flush-only`.quiet();
    await client.app.log({
      body: {
        service: "beads-plugin",
        level: "debug",
        message: "Beads database auto-flushed successfully",
      },
    });
  } catch (err) {
    // Silent fail - sync errors are non-blocking
    await client.app.log({
      body: {
        service: "beads-plugin",
        level: "debug",
        message: "Beads auto-flush failed (non-blocking)",
        extra: { error: err instanceof Error ? err.message : String(err) },
      },
    });
  }
}

export const BeadsPlugin: Plugin = async ({ client, $ }) => {
  // Health check on plugin load
  await checkBeadsHealth($, client);

  const [commands, agents] = await Promise.all([loadCommands(), loadAgent()]);

  await client.app.log({
    body: {
      service: "beads-plugin",
      level: "debug",
      message: "Beads plugin loaded",
      extra: {
        commands: Object.keys(commands).length,
        agents: Object.keys(agents).length,
      },
    },
  });

  const injectedSessions = new Set<string>();

  return {
    "chat.message": async (_input, output) => {
      const sessionID = output.message.sessionID;

      // Skip if already injected this session
      if (injectedSessions.has(sessionID)) return;

      // Check if beads-context was already injected (handles plugin reload/reconnection)
      try {
        const existing = await client.session.messages({
          path: { id: sessionID },
        });

        if (existing.data) {
          const hasBeadsContext = existing.data.some((msg) => {
            const parts = (msg as any).parts || (msg.info as any).parts;
            if (!parts) return false;
            return parts.some(
              (part: any) =>
                part.type === "text" && part.text?.includes("<beads-context>")
            );
          });

          if (hasBeadsContext) {
            injectedSessions.add(sessionID);
            await client.app.log({
              body: {
                service: "beads-plugin",
                level: "debug",
                message: "Beads context already present, skipping",
                extra: { sessionID },
              },
            });
            return;
          }
        }
      } catch (err) {
        // On error, proceed with injection
        await client.app.log({
          body: {
            service: "beads-plugin",
            level: "debug",
            message: "Error checking existing context, proceeding",
            extra: {
              sessionID,
              error: err instanceof Error ? err.message : String(err),
            },
          },
        });
      }

      injectedSessions.add(sessionID);

      // Use output.message which has the resolved model/agent values
      // This ensures our injected noReply message has identical model/agent
      // to the real user message, preventing mode/model switching
      await injectBeadsContext(client, $, sessionID, {
        model: output.message.model,
        agent: output.message.agent,
      });
    },

    "tool.execute.after": async (input, output) => {
      // Check if this is a bash invocation
      if (input.tool !== "bash") return;

      // Check if the command mutates the issue database
      // The output.output contains the result, we need to check the original args
      // The tool args are passed to the tool and the output contains the result
      const commandOutput = String(output.output ?? "");
      if (isMutatingCommand(commandOutput)) {
        await client.app.log({
          body: {
            service: "beads-plugin",
            level: "debug",
            message: "Detected mutating beads command, auto-flushing",
            extra: { command: commandOutput.split("\n")[0] },
          },
        });
        await autoFlushAfterMutation($, client);
      }
    },

    event: async ({ event }) => {
      if (event.type === "session.compacted") {
        const sessionID = event.properties.sessionID;
        await client.app.log({
          body: {
            service: "beads-plugin",
            level: "debug",
            message: "Session compacted, re-injecting beads context",
            extra: { sessionID },
          },
        });
        const context = await getSessionContext(client, sessionID);
        await injectBeadsContext(client, $, sessionID, context);
      }
    },

    config: async (config) => {
      config.command = { ...config.command, ...commands };
      config.agent = { ...config.agent, ...agents };
    },
  };
};
