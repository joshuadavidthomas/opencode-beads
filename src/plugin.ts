/**
 * OpenCode Beads Plugin (OpenCode v2)
 *
 * Integrates the beads issue tracker with OpenCode.
 *
 * Features:
 * - Context injection via `bd prime` on every model call (not persisted)
 * - Commands parsed from beads command definitions
 * - Task agent for autonomous issue completion
 */

import { Plugin } from "@opencode/plugin";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BEADS_GUIDANCE, loadAgent, loadCommands } from "./vendor";

const run = promisify(execFile);

/** Name of the plugin's own task agent. Always receives beads context. */
const BEADS_TASK_AGENT = "beads-task-agent";

/**
 * Run `bd prime` and wrap the output with CLI guidance.
 * Returns undefined if bd is not installed or not initialized.
 */
async function buildBeadsContext(directory: string): Promise<string | undefined> {
  try {
    const { stdout } = await run("bd", ["prime"], { cwd: directory, timeout: 10000 });
    const prime = stdout.trim();
    if (!prime) return undefined;
    return `<beads-context>\n${prime}\n</beads-context>\n\n${BEADS_GUIDANCE}`;
  } catch {
    return undefined;
  }
}

export default Plugin.define({
  id: "opencode-beads",
  async setup(ctx) {
    const [commands, agent] = await Promise.all([loadCommands(), loadAgent()]);

    if (agent) {
      await ctx.agent.transform((editor) => {
        editor.update(agent.id, (a) => {
          a.name = agent.id as unknown as typeof a.name;
          a.description = agent.description;
          a.mode = "subagent";
          a.system = agent.system;
        });
      });
    }

    await ctx.command.transform((editor) => {
      for (const command of commands) {
        editor.add({
          name: command.name,
          description: command.description,
          execute: async ({ sessionID, prompt, delivery }) => {
            const args = prompt.text.trim();
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              delivery,
              text: command.template.replaceAll("$ARGUMENTS", args),
            });
          },
        });
      }
    });

    // Cache per session so `bd prime` runs once, not on every model call.
    const cache = new Map<string, Promise<string | undefined>>();

    /**
     * Primary agents benefit from issue awareness. Subagents are invoked for
     * specific tasks and shouldn't be polluted with beads context, except
     * the plugin's own task agent.
     */
    const shouldInject = async (agentID: string): Promise<boolean> => {
      if (agentID === BEADS_TASK_AGENT) return true;
      try {
        const { data: info } = await ctx.agent.get({ agentID: agentID as never });
        return info.mode === "primary" || info.mode === "all";
      } catch {
        return true;
      }
    };

    ctx.session.hook("context", async (event) => {
      if (!(await shouldInject(event.agent))) return;

      let pending = cache.get(event.sessionID);
      if (!pending) {
        pending = buildBeadsContext(ctx.location.directory);
        cache.set(event.sessionID, pending);
      }

      const text = await pending;
      if (text) event.system.push({ type: "text", text });
    });
  },
});
