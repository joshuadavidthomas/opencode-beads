/**
 * OpenCode Beads Plugin
 *
 * Integrates the beads issue tracker with OpenCode.
 *
 * Features:
 * - Context injection via `bd prime` on session start and after compaction
 * - Commands parsed from beads command definitions
 * - Task agent for autonomous issue completion
 * - Auto-flush after mutating beads operations
 * - Structured logging and health checks
 */

import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { BEADS_GUIDANCE, loadAgent, loadCommands } from "./vendor";

type OpencodeClient = PluginInput["client"];

/**
 * Mutating bd commands that should trigger auto-flush
 */
const MUTATING_COMMANDS = [
  "bd create",
  "bd update",
  "bd close",
  "bd reopen",
  "bd dep add",
  "bd delete",
  "bd label add",
  "bd label remove",
  "bd comments add",
  "bd audit record",
  "bd audit label",
  "bd rename-prefix",
  "bd compact",
  "bd import",
];

/**
 * Check if a command is a mutating beads operation
 * Uses word boundary matching to avoid false positives (e.g., "bd create-report" shouldn't match)
 */
function isMutatingBeadsCommand(command: string): boolean {
  const trimmed = command.trim();
  return MUTATING_COMMANDS.some((cmd) => {
    // Check exact match or that command starts with cmd followed by space/end
    return trimmed === cmd || trimmed.startsWith(cmd + " ");
  });
}

/**
 * Check if beads CLI is available and working
 */
async function checkBeadsHealth($: PluginInput["$"]): Promise<boolean> {
  try {
    await $`bd --version`;
    return true;
  } catch {
    return false;
  }
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
  } catch {
    // On error, return undefined (let opencode use its default)
  }

  return undefined;
}

/**
 * Inject beads context into a session.
 *
 * Runs `bd prime` and injects the output along with CLI guidance.
 * Silently skips if bd is not installed or not initialized.
 */
async function injectBeadsContext(
  client: OpencodeClient,
  $: PluginInput["$"],
  sessionID: string,
  context?: { model?: { providerID: string; modelID: string }; agent?: string }
): Promise<void> {
  try {
    const primeOutput = await $`bd prime`.text();

    if (!primeOutput || primeOutput.trim() === "") {
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

    client.app.log?.({
      body: {
        service: "beads",
        level: "debug",
        message: `Injected beads context into session ${sessionID.slice(0, 8)}...`,
      },
    });
  } catch {
    // Silent skip if bd prime fails (not installed or not initialized)
  }
}


export const BeadsPlugin: Plugin = async ({ client, $ }) => {
  // Health check on plugin load
  const isHealthy = await checkBeadsHealth($);
  if (!isHealthy) {
    client.app.log?.({
      body: {
        service: "beads",
        level: "warn",
        message: "Beads CLI not available. Plugin will not inject context.",
      },
    });
  } else {
    client.app.log?.({
      body: {
        service: "beads",
        level: "info",
        message: "Beads plugin initialized successfully.",
      },
    });
  }

  const [commands, agents] = await Promise.all([loadCommands(), loadAgent()]);

  const injectedSessions = new Set<string>();

  return {
    "chat.message": async (_input, output) => {
      // Skip if beads is not healthy
      if (!isHealthy) return;

      const sessionID = output.message.sessionID;

      // Skip if already injected this session
      if (injectedSessions.has(sessionID)) return;

      // Check if beads-context was already injected (handles plugin reload/reconnection)
      try {
        const existing = await client.session.messages({
          path: { id: sessionID },
        });

        if (existing.data) {
          const hasBeadsContext = existing.data.some(msg => {
            const parts = (msg as any).parts || (msg.info as any).parts;
            if (!parts) return false;
            return parts.some((part: any) =>
              part.type === 'text' && part.text?.includes('<beads-context>')
            );
          });

          if (hasBeadsContext) {
            injectedSessions.add(sessionID);
            return;
          }
        }
      } catch {
        // On error, proceed with injection
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

    event: async ({ event }) => {
      if (event.type === "session.compacted") {
        const sessionID = event.properties.sessionID;
        const context = await getSessionContext(client, sessionID);
        await injectBeadsContext(client, $, sessionID, context);
      }
    },

    config: async (config) => {
      config.command = { ...config.command, ...commands };
      config.agent = { ...config.agent, ...agents };
    },

    "tool.execute.after": async (input, _output) => {
      // Only check bash tool executions
      if (input.tool !== "bash") return;

      const command = (input as any).arguments?.command;
      if (typeof command !== "string") return;

      // Check if this was a mutating beads command
      if (isMutatingBeadsCommand(command)) {
        // Verify the command succeeded before flushing
        if ((_output as any)?.error) {
          client.app.log?.({
            body: {
              service: "beads",
              level: "debug",
              message: `Skipping auto-flush - command failed: ${command}`,
            },
          });
          return;
        }

        try {
          // Auto-flush beads changes to sync with git
          await $`bd sync --flush-only`;
          client.app.log?.({
            body: {
              service: "beads",
              level: "info",
              message: `Auto-flushed beads changes after: ${command}`,
            },
          });
        } catch {
          // Silent fail - sync is best-effort
          client.app.log?.({
            body: {
              service: "beads",
              level: "debug",
              message: `Auto-flush failed after: ${command}`,
            },
          });
        }
      }
    },
  };
};
