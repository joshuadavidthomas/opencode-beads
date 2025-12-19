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

import { tool, type Plugin, type PluginInput } from "@opencode-ai/plugin";
import { BEADS_GUIDANCE, loadAgent, loadCommands } from "./vendor";
import { createTodoWriteTool, createTodoReadTool } from "./todo-sync";

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

    // Fix up metadata for todowrite/todoread so TUI sidebar renders correctly.
    // Plugin tools return { title: "", output: string, metadata: {} } via fromPlugin wrapper.
    // The TUI checks metadata.todos to render the todo list. We populate it here.
    "tool.execute.after": async (input, output) => {
      if (input.tool === "todowrite" || input.tool === "todoread") {
        try {
          const todos = JSON.parse(output.output);
          if (Array.isArray(todos)) {
            // Mutate the output object to populate metadata and title
            // This works because the object is passed by reference and returned after this hook
            output.metadata = { todos };
            output.title = `${todos.filter((t: any) => t.status !== "completed").length} todos`;
          }
        } catch {
          // If parsing fails, leave as-is (might be an error message)
        }
      }
    },

    config: async (config) => {
      config.command = { ...config.command, ...commands };
      config.agent = { ...config.agent, ...agents };
    },

    // Override todowrite/todoread to sync with beads
    tool: {
      todowrite: createTodoWriteTool($),
      todoread: createTodoReadTool($),
      
      // Keep test tool for debugging
      test_opencode_imports: tool({
        description: "Test what OpenCode internals we can import at runtime",
        args: {},
        async execute() {
          const results: string[] = [];

          // Test 1: Try importing Todo from opencode (the actual package name)
          try {
            // @ts-expect-error - runtime import, not available at compile time
            const todo = await import("opencode/session/todo");
            results.push(`✓ opencode/session/todo: ${Object.keys(todo).join(", ")}`);
            
            // If we got here, try to check if Todo.update exists
            if (todo.Todo && typeof todo.Todo.update === "function") {
              results.push(`  ✓ Todo.update is a function!`);
            }
          } catch (e: any) {
            results.push(`✗ opencode/session/todo: ${e.message}`);
          }

          // Test 2: Try the scoped package name as fallback
          try {
            // @ts-expect-error - runtime import, not available at compile time
            const todo = await import("@opencode-ai/opencode/session/todo");
            results.push(`✓ @opencode-ai/opencode/session/todo: ${Object.keys(todo).join(", ")}`);
          } catch (e: any) {
            results.push(`✗ @opencode-ai/opencode/session/todo: ${e.message}`);
          }

          // Test 3: Try importing the main package
          try {
            // @ts-expect-error - runtime import, not available at compile time
            const opencode = await import("opencode");
            results.push(`✓ opencode: ${Object.keys(opencode).slice(0, 10).join(", ")}...`);
          } catch (e: any) {
            results.push(`✗ opencode: ${e.message}`);
          }

          // Test 4: Check if we can find the module in require.cache or similar
          try {
            // @ts-ignore - checking runtime environment
            const modules = Object.keys(require.cache || {}).filter(k => k.includes("todo"));
            results.push(`Cached modules with 'todo': ${modules.length > 0 ? modules.slice(0, 3).join(", ") : "none"}`);
          } catch (e: any) {
            results.push(`Cache check: ${e.message}`);
          }

          return results.join("\n");
        },
      }),
    },
  };
};
