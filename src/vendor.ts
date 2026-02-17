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

export function parseMarkdownWithFrontmatter(content: string): ParsedMarkdown | null {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = frontmatterRegex.exec(content);

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

const BEADS_CLI_USAGE = `## CLI Usage

**IMPORTANT:** There is no \`bd\` tool in this environment. You must use the \`bash\` tool to run the \`bd\` command.

**Do not try to call a tool named \`bd\` directly.** It does not exist.
**Do not try to call MCP tools (like \`ready\`, \`create\`) directly.** They do not exist.

Instead, use the \`bash\` tool for all beads operations:

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

Always use \`--json\` flag for structured output.`;

const BEADS_SUBAGENT_CONTEXT = `## Subagent Context

You are called as a subagent for **beads issue management ONLY**. Your **final message** is what gets returned to the calling agent - make it count.

**Your purpose:** Manage beads issues and the issue database. This is for issue tracking ONLY.

**DO NOT write or modify code files.** This agent is for beads issue management, not code implementation.

**For status/overview requests** ("what's next", "show me blocked work"):
- Run the necessary \`bd\` commands to gather data
- Process the JSON output internally
- Return a **concise, human-readable summary** with key information
- Use tables or lists to organize information clearly
- Example: "You have 3 ready tasks (2 P0, 1 P1), 5 in-progress, and 8 blocked by Epic X"

**For task completion requests** ("complete ready work", "work on issues"):
- Find ready work, update beads issue status to in_progress
- Execute the issue (code changes are done by the parent agent, NOT by this beads agent)
- Add dependencies when related issues are discovered
- Close the issue when complete
- Report progress as you work
- End with a summary of what was accomplished

**Critical:** Do NOT dump raw JSON in your final response. Parse it, summarize it, make it useful.`;

const BEADS_DESCRIPTION_STANDARDS = `## Description Standards (RFC 2119)

Every bead creation MUST include a comprehensive description following RFC 2119:

**Required Sections:**
1. **Context** - background and rationale (explains WHY)
2. **Requirements** - using RFC 2119 keywords (MUST, MUST NOT, SHOULD, MAY, etc.)
3. **Guardrails** - constraints, boundaries, security considerations
4. **Dos and Don'ts** - implementation guidance, anti-patterns to avoid
5. **Acceptance Criteria** - verifiable completion conditions
6. **Validation** - self-review checklist

**RFC 2119 Keywords:**
- **MUST/REQUIRED/SHALL**: Absolute requirements
- **MUST NOT/SHALL NOT**: Absolute prohibitions
- **SHOULD/RECOMMENDED**: Strong suggestions (can deviate with justification)
- **SHOULD NOT**: Discouraged but possible
- **MAY/OPTIONAL**: Truly optional elements

**Shell Safety:**
- Escape special characters properly
- Use single quotes for literal strings
- Test with \`echo '<description>'\` before submission

**Non-compliant issues are INVALID and MUST be rejected. The agent MUST NOT proceed with issue creation until the description meets all RFC 2119 requirements.**`;

const BEADS_AGENT_DELEGATION = `## Agent Delegation

**Default to the agent.** For ANY beads work involving multiple commands or context gathering, use the \`task\` tool with the appropriate subagent:

### Available Agents

- \`beads:task-agent\` - Complex multi-issue workflows, autonomous task completion
- \`beads:query-agent\` - Read-only exploration, searching, reporting
- \`beads:cleanup-agent\` - Database maintenance, stale issue detection, compaction
- \`beads:description-validator\` - Validate descriptions against RFC 2119

### When to Use Each

**\`beads:task-agent\` (default for multi-step work):**
- Status overviews ("what's next", "what's blocked", "show me progress")
- Exploring the issue graph (ready + in-progress + blocked queries)
- Finding and completing ready work
- Working through multiple issues in sequence
- Any request that would require 2+ bd commands

**\`beads:query-agent\` (read-only):**
- Searching and filtering issues
- Generating reports
- Answering questions about the issue database
- Never modifies issues

**\`beads:cleanup-agent\` (maintenance):**
- Finding stale issues
- Detecting duplicates
- Running compaction
- Database health checks

**\`beads:description-validator\` (quality control):**
- Validate description before creation
- Check RFC 2119 compliance
- Reject non-compliant descriptions

**Use CLI directly ONLY for single, atomic operations:**
- Creating exactly one issue: \`bd create "title" ...\`
- Closing exactly one issue: \`bd close <id> ...\`
- Updating one specific field: \`bd update <id> --status ...\`
- When user explicitly requests a specific command

**Why delegate?** The agent processes multiple commands internally and returns only a concise summary. Running bd commands directly dumps hundreds of lines of raw JSON into context, wasting tokens and making the conversation harder to follow.

## Auto-Flush Behavior

After mutating commands (create, update, close, etc.), the plugin automatically runs \`bd sync --flush-only\` to ensure the JSONL file is immediately updated. No manual sync needed after mutations.`;

export const BEADS_GUIDANCE = `<beads-guidance>
${BEADS_CLI_USAGE}

${BEADS_DESCRIPTION_STANDARDS}

${BEADS_AGENT_DELEGATION}
</beads-guidance>`;

async function loadSingleAgent(
  agentName: string,
  defaultDescription: string
): Promise<NonNullable<Config["agent"]> | Record<string, never>> {
  const content = await readVendorFile(`agents/${agentName}.md`);
  if (!content) return {};

  const parsed = parseMarkdownWithFrontmatter(content);
  if (!parsed) return {};

  const description = parsed.frontmatter.description ?? defaultDescription;

  return {
    [`beads:${agentName}`]: {
      description,
      prompt: BEADS_CLI_USAGE + "\n\n" + BEADS_SUBAGENT_CONTEXT + "\n\n" + parsed.body,
      mode: "subagent",
    },
  };
}

export async function loadAgent(): Promise<NonNullable<Config["agent"]>> {
  const agents = await Promise.all([
    loadSingleAgent("task-agent", "Beads task completion agent"),
    loadSingleAgent("query-agent", "Read-only beads query agent"),
    loadSingleAgent("cleanup-agent", "Beads database cleanup agent"),
    loadSingleAgent("description-validator", "Validate bead descriptions against RFC 2119"),
  ]);

  return Object.assign({}, ...agents);
}

export async function loadCommands(): Promise<NonNullable<Config["command"]>> {
  const files = await listVendorFiles("commands");
  const commands: NonNullable<Config["command"]> = {};

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    const content = await readVendorFile(`commands/${file}`);
    if (!content) continue;

    const parsed = parseMarkdownWithFrontmatter(content);
    if (!parsed) continue;

    const name = `beads:${file.replace(".md", "")}`;

    const argHint = parsed.frontmatter["argument-hint"];
    const baseDescription = parsed.frontmatter.description ?? name;
    const description = argHint ? `${baseDescription} (${argHint})` : baseDescription;

    commands[name] = {
      description,
      template: parsed.body,
    };
  }

  return commands;
}
