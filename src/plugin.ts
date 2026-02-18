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
 * Helper to log messages via the OpenCode client app.
 * Wraps messages in the correct Options<AppLogData> format.
 */
function log(
  client: OpencodeClient,
  level: "debug" | "info" | "error" | "warn",
  message: string
): void {
  client.app.log({
    body: { service: "beads", level, message },
  });
}

/**
 * Commands that mutate the issue database and require auto-flush.
 */
const MUTATING_COMMANDS = ["create", "update", "close", "reopen", "delete", "dep", "label", "epic"];

/**
 * Regex to detect mutating bd commands in bash tool invocations.
 */
const MUTATING_COMMAND_REGEX = new RegExp(`bd\\s+(?:${MUTATING_COMMANDS.join("|")})\\b`);

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
): Promise<{ model?: { providerID: string; modelID: string }; agent?: string } | undefined> {
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
    log(
      client,
      "info",
      `Failed to get session context: ${err instanceof Error ? err.message : String(err)}`
    );
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
async function checkBeadsHealth($: PluginInput["$"], client: OpencodeClient): Promise<boolean> {
  try {
    const result = await $`bd version`.text();
    log(client, "info", `Beads CLI is available: ${result.trim()}`);
    return true;
  } catch (err) {
    log(
      client,
      "warn",
      `Beads CLI not found or not working. Install with: pip install beads-cli. Error: ${err instanceof Error ? err.message : String(err)}`
    );
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
    log(client, "info", `Injecting beads context for session ${sessionID}`);

    const primeOutput = await $`bd prime`.text();

    if (!primeOutput || primeOutput.trim() === "") {
      log(client, "info", `Empty beads prime output, skipping injection for ${sessionID}`);
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

    log(client, "info", `Beads context injected successfully for ${sessionID}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Provide specific guidance based on error type
    if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      log(
        client,
        "warn",
        `Beads CLI not installed for ${sessionID}. Context injection skipped. Install with: pip install beads-cli. Error: ${errorMessage}`
      );
    } else if (errorMessage.includes("not initialized") || errorMessage.includes("no .beads")) {
      log(
        client,
        "warn",
        `Beads not initialized in this project (${sessionID}). Run \`bd init\` to set up. Error: ${errorMessage}`
      );
    } else {
      log(client, "info", `Failed to inject beads context for ${sessionID}: ${errorMessage}`);
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
async function autoFlushAfterMutation($: PluginInput["$"], client: OpencodeClient): Promise<void> {
  try {
    log(client, "debug", "Auto-flushing beads database after mutation");
    await $`bd sync --flush-only`.quiet();
    log(client, "debug", "Beads database auto-flushed successfully");
  } catch (err) {
    // Silent fail - sync errors are non-blocking
    log(
      client,
      "debug",
      `Beads auto-flush failed (non-blocking): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export const BeadsPlugin: Plugin = async ({ client, $ }) => {
  // Health check on plugin load
  await checkBeadsHealth($, client);

  const [commands, agents] = await Promise.all([loadCommands(), loadAgent()]);

  log(
    client,
    "debug",
    `Beads plugin loaded with ${Object.keys(commands).length} commands and ${Object.keys(agents).length} agents`
  );

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
              (part: any) => part.type === "text" && part.text?.includes("<beads-context>")
            );
          });

          if (hasBeadsContext) {
            injectedSessions.add(sessionID);
            log(client, "info", `Beads context already present in ${sessionID}, skipping`);
            return;
          }
        }
      } catch (err) {
        // On error, proceed with injection
        log(
          client,
          "debug",
          `Error checking existing context for ${sessionID}, proceeding: ${err instanceof Error ? err.message : String(err)}`
        );
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
      // Command is available in output.metadata for bash tool
      const command = String(output.metadata?.command ?? "");
      if (isMutatingCommand(command)) {
        log(
          client,
          "debug",
          `Detected mutating beads command, auto-flushing: ${command.split("\n")[0]}`
        );
        await autoFlushAfterMutation($, client);
      }
    },

    event: async ({ event }) => {
      if (event.type === "session.compacted") {
        const sessionID = event.properties.sessionID;
        log(client, "info", `Session ${sessionID} compacted, re-injecting beads context`);
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
