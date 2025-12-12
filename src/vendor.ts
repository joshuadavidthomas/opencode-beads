/**
 * Vendor file loaders for beads plugin.
 *
 * The vendor directory contains beads command definitions and agent prompts
 * synced from the upstream beads repository via scripts/sync-beads.sh.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "@opencode-ai/sdk";

function getVendorDir(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.join(__dirname, "..", "vendor");
}

interface ParsedMarkdown {
  frontmatter: Record<string, string | undefined>;
  body: string;
}

function parseMarkdownWithFrontmatter(content: string): ParsedMarkdown | null {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const frontmatterStr = match[1];
  const body = match[2];

  if (frontmatterStr === undefined || body === undefined) {
    return null;
  }

  const frontmatter: Record<string, string | undefined> = {};

  for (const line of frontmatterStr.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    // Handle quoted strings
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Handle empty array syntax like []
    if (value === "[]") {
      value = "";
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body: body.trim() };
}

async function readVendorFile(relativePath: string): Promise<string | null> {
  try {
    const fullPath = path.join(getVendorDir(), relativePath);
    return await fs.readFile(fullPath, "utf-8");
  } catch {
    return null;
  }
}

async function listVendorFiles(relativePath: string): Promise<string[]> {
  try {
    const fullPath = path.join(getVendorDir(), relativePath);
    return await fs.readdir(fullPath);
  } catch {
    return [];
  }
}

export const BEADS_GUIDANCE = `<beads-guidance>
## CLI Usage

**Note:** Beads MCP tools are not available in this environment. Use the \`bd\` CLI via bash instead. MCP tool names map directly to \`bd\` commands.

Use the \`bd\` CLI via bash for beads operations:

- \`bd init [prefix]\` - Initialize beads
- \`bd ready --json\` - List ready tasks
- \`bd show <id> --json\` - Show task details
- \`bd create "title" -t bug|feature|task -p 0-4 --json\` - Create issue
- \`bd update <id> --status in_progress --json\` - Update status
- \`bd close <id> --reason "message" --json\` - Close issue
- \`bd reopen <id> --json\` - Reopen issue
- \`bd dep add <from> <to> --type blocks|discovered-from --json\` - Add dependency
- \`bd list --status open --json\` - List issues
- \`bd blocked --json\` - Show blocked issues
- \`bd stats --json\` - Show statistics
- \`bd sync\` - Sync with git

If a tool is not listed above, try \`bd <tool> --help\`.

Always use \`--json\` flag for structured output.

## Agent Delegation

For multi-step beads work, use the \`task\` tool with \`subagent_type: "beads-task-agent"\`:
- Finding and completing ready work autonomously
- Working through multiple issues in sequence
- Tasks involving claiming, executing, and closing issues
- When asked to "work on beads issues", "complete tasks", or similar

For single, specific operations (check status, create one issue, query info), use \`bd\` CLI directly.
</beads-guidance>`;

export async function loadAgent(): Promise<Config["agent"]> {
  const content = await readVendorFile("agents/task-agent.md");
  if (!content) return {};

  const parsed = parseMarkdownWithFrontmatter(content);
  if (!parsed) return {};

  const description =
    parsed.frontmatter.description ?? "Beads task completion agent";

  return {
    "beads-task-agent": {
      description,
      prompt: BEADS_GUIDANCE + "\n" + parsed.body,
      mode: "subagent",
    },
  };
}

export async function loadCommands(): Promise<Config["command"]> {
  const files = await listVendorFiles("commands");
  const commands: Config["command"] = {};

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    const content = await readVendorFile(`commands/${file}`);
    if (!content) continue;

    const parsed = parseMarkdownWithFrontmatter(content);
    if (!parsed) continue;

    const name = `bd-${file.replace(".md", "")}`;

    const argHint = parsed.frontmatter["argument-hint"];
    const baseDescription = parsed.frontmatter.description ?? name;
    const description = argHint
      ? `${baseDescription} (${argHint})`
      : baseDescription;

    commands[name] = {
      description,
      template: parsed.body,
    };
  }

  return commands;
}
