/**
 * OpenCode Beads Plugin
 *
 * Integrates the beads issue tracker with OpenCode.
 *
 * Features:
 * - Context injection via `bd prime` in the system prompt, once per session
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
 * Run `bd prime` and wrap its output with CLI guidance.
 *
 * Returns undefined if bd is not installed or the project is not initialized.
 */
async function primeContext(directory: string): Promise<string | undefined> {
  try {
    const { stdout } = await run("bd", ["prime"], { cwd: directory, timeout: 10_000 });
    const prime = stdout.trim();
    if (!prime) return undefined;
    return `<beads-context>\n${prime}\n</beads-context>\n\n${BEADS_GUIDANCE}`;
  } catch {
    return undefined;
  }
}

const argsRegex = /(?:\[Image\s+\d+\]|"[^"]*"|'[^']*'|[^\s"']+)/gi;
const placeholderRegex = /\$(\d+)/g;
const quoteTrimRegex = /^["']|["']$/g;

/**
 * Expand a command template with the user's arguments.
 *
 * Mirrors how OpenCode expands config-defined commands: `$1`, `$2`, ... take
 * positional arguments (the highest one takes the rest), `$ARGUMENTS` takes
 * the raw input, and input is appended when the template has no placeholders.
 */
export function expandTemplate(template: string, input: string): string {
  const args = (input.match(argsRegex) ?? []).map((arg) => arg.replace(quoteTrimRegex, ""));
  const placeholders = template.match(placeholderRegex) ?? [];
  const last = Math.max(0, ...placeholders.map((item) => Number(item.slice(1))));
  const expanded = template
    .replaceAll(placeholderRegex, (_, index) => {
      const position = Number(index);
      const argIndex = position - 1;
      if (argIndex >= args.length) return "";
      if (position === last) return args.slice(argIndex).join(" ");
      return args[argIndex] ?? "";
    })
    .replaceAll("$ARGUMENTS", () => input);
  return placeholders.length === 0 && !template.includes("$ARGUMENTS") && input.trim()
    ? `${expanded}\n\n${input}`.trim()
    : expanded.trim();
}

export default Plugin.define({
  id: "opencode-beads",
  async setup(ctx) {
    const [commands, agent] = await Promise.all([loadCommands(), loadAgent()]);

    if (agent) {
      await ctx.agent.transform((editor) => {
        editor.update(BEADS_TASK_AGENT, (info) => {
          info.description = agent.description;
          info.system = agent.system;
          info.mode = "subagent";
        });
      });
    }

    await ctx.command.transform((editor) => {
      for (const command of commands) {
        editor.add({
          name: command.name,
          description: command.description,
          async execute({ sessionID, prompt, delivery }) {
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              delivery,
              text: expandTemplate(command.template, prompt.text),
            });
          },
        });
      }
    });

    /**
     * Primary agents (`build`, `plan`) are user-facing and benefit from issue
     * awareness. Subagents (like `explore` and `general`) are invoked for
     * specific tasks and shouldn't be polluted with beads context — it wastes
     * tokens and can cause them to attempt pointless bd/git operations. The
     * plugin's own `beads-task-agent` is an explicit exception.
     */
    async function shouldInject(agentID: string): Promise<boolean> {
      if (agentID === BEADS_TASK_AGENT) return true;
      try {
        const { data } = await ctx.agent.get({ agentID });
        return data.mode === "primary" || data.mode === "all";
      } catch {
        // Agent lookup failed — inject as safe fallback
        return true;
      }
    }

    // `bd prime` output is static apart from config and persisted memories,
    // and system parts survive compaction, so run it once per session.
    const primed = new Map<string, Promise<string | undefined>>();

    await ctx.session.hook("context", async (event) => {
      if (!(await shouldInject(event.agent))) return;

      let context = primed.get(event.sessionID);
      if (!context) {
        context = primeContext(ctx.location.directory);
        primed.set(event.sessionID, context);
      }

      const text = await context;
      if (text) event.system.push({ type: "text", text });
    });
  },
});
