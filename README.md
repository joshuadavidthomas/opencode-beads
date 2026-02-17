# opencode-beads

[Beads](https://github.com/steveyegge/beads) issue tracker integration for [OpenCode](https://opencode.ai).

## Installation

Install the beads CLI:

```bash
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
```

See the [beads installation guide](https://github.com/steveyegge/beads/blob/main/docs/INSTALLING.md) for alternative methods (Homebrew, Windows, AUR, etc.).

Add to your OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": ["opencode-beads"]
}
```

Restart OpenCode and you're ready to go.

Optionally, pin to a specific version for stability:

```json
{
  "plugin": ["opencode-beads@0.4.0"]
}
```

OpenCode fetches unpinned plugins from npm on each startup; pinned versions are cached and require a manual version bump to update.

## Features

- **Context Injection** - Automatically runs `bd prime` on session start and after compaction, keeping your agent aware of current issues
- **Auto-Flush After Mutations** - Immediately syncs changes to `.beads/issues.jsonl` after create, update, close, and other mutating commands
- **33+ Commands** - All beads operations available as `beads:*` commands
- **RFC 2119 Description Standards** - Enforces comprehensive issue descriptions with required sections (Context, Requirements, Guardrails, Dos and Don'ts, Acceptance Criteria, Validation)
- **Structured Logging** - Debug and health monitoring via OpenCode's logging system
- **Health Checks** - Validates beads CLI installation on plugin load

## Agents

This plugin provides specialized subagents for different beads workflows:

### beads:task-agent

The default agent for complex multi-issue workflows. Use for:
- Status overviews ("what's next", "what's blocked")
- Exploring the issue graph
- Finding and completing ready work
- Working through multiple issues in sequence
- Any request requiring 2+ bd commands

### beads:query-agent

Read-only agent for exploration and reporting. Use for:
- Searching and filtering issues
- Generating reports
- Answering questions about the issue database
- Never modifies issues

### beads:cleanup-agent

Maintenance agent for database health. Use for:
- Finding stale issues
- Detecting duplicates
- Running compaction
- Database health checks

### beads:description-validator

Quality control agent for RFC 2119 compliance. Use for:
- Validating descriptions before creation
- Checking RFC 2119 keyword usage (MUST, SHOULD, MAY, etc.)
- Rejecting non-compliant descriptions

## Usage

This plugin brings beads into OpenCode. For learning how to use beads itself - workflows, commands, best practices - see the [beads documentation](https://github.com/steveyegge/beads).

The plugin automatically injects beads context on session start and after compaction, so your agent stays oriented.

## Commands

Commands are available as `beads:*` (e.g., `beads:ready`, `beads:create`, `beads:status`).

### Common Commands

| Command | Description |
|---------|-------------|
| `beads:ready` | Find ready-to-work tasks with no blockers |
| `beads:create` | Create a new issue with RFC 2119-compliant description |
| `beads:update` | Update issue status, priority, or other fields |
| `beads:close` | Close a completed issue |
| `beads:show` | Show detailed information about an issue |
| `beads:list` | List issues with optional filters |
| `beads:blocked` | Show blocked issues and their dependencies |
| `beads:status` | Show project overview and statistics |
| `beads:doctor` | Check beads installation health |
| `beads:query` | Query issues using filter language |
| `beads:stale` | Find issues not updated recently |
| `beads:sync` | Synchronize issues with git remote |

See the [beads documentation](https://github.com/steveyegge/beads) for the full command reference.

## Example Workflows

### Finding Ready Work

```
User: "What should I work on?"
→ Agent runs beads:ready (or bd ready --json)
→ Returns summary: "You have 3 ready tasks (2 P0, 1 P1), 5 in-progress, 8 blocked"
```

### Creating an Issue

```
User: "Create a bug for the login issue"
→ Agent validates description meets RFC 2119 standards
→ Runs bd create "Login crashes on special chars" -t bug -p 1
→ Auto-syncs to JSONL via bd sync --flush-only
```

### Complex Workflows with Agents

```
User: "Show me what's blocked and why"
→ Delegate to beads:query-agent
→ Agent runs bd blocked --json, bd show for each
→ Returns human-readable summary with blocker analysis
```

## Development

### Local Development

Clone the repository:

```bash
git clone https://github.com/joshuadavidthomas/opencode-beads.git
cd opencode-beads
bun install
```

### Installing Locally in OpenCode

To use your local copy of the plugin instead of the npm version:

1. Build the plugin:

```bash
bun run build
```

2. Link the plugin globally (optional but recommended):

```bash
bun link
```

3. Add to your OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": ["/path/to/your/opencode-beads"]
}
```

Or use the absolute path without linking:

```json
{
  "plugin": ["/home/username/projects/opencode-beads"]
}
```

4. Restart OpenCode to load the local plugin.

**Note:** When using a local path, OpenCode loads the plugin directly from the source directory on every startup (no caching). This is ideal for development as changes are reflected immediately after restarting OpenCode.

### Running Tests

```bash
bun run test              # Run unit tests
bun run test:coverage     # Run with coverage report
```

### Validation

```bash
bun run validate          # Validate plugin structure
```

### Type Checking

```bash
bun run typecheck         # Run TypeScript type checker
```

## License

opencode-beads is licensed under the MIT license. See the [`LICENSE`](LICENSE) file for more information.

---

opencode-beads is not built by, or affiliated with, the OpenCode team.

OpenCode is ©2025 Anomaly.
