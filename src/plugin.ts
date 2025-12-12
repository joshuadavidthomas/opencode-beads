/**
 * OpenCode Beads Plugin
 *
 * Integrates the beads issue tracker with OpenCode.
 *
 * Features:
 * - Context injection via `bd prime` on session start and after compaction
 * - Commands parsed from beads command definitions
 * - Task agent for autonomous issue completion
 */

import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { CLI_GUIDANCE, loadAgent, loadCommands } from "./vendor";

type OpencodeClient = PluginInput["client"];

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

${CLI_GUIDANCE}`;

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
  } catch {
    // Silent skip if bd prime fails (not installed or not initialized)
  }
}


export const BeadsPlugin: Plugin = async ({ client, $ }) => {
  const [commands, agents] = await Promise.all([loadCommands(), loadAgent()]);

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
  };
};
