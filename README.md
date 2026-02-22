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
  "plugin": ["opencode-beads@0.5.2"]
}
```

OpenCode fetches unpinned plugins from npm on each startup; pinned versions are cached and require a manual version bump to update.

## Features

- **Context injection** - Automatically runs `bd prime` on session start and after compaction, keeping your agent aware of current issues
- **Commands** - All beads operations available as `/bd-*` commands
- **Task agent** - Autonomous issue completion via `beads-task-agent` subagent

## Usage

This plugin brings beads into OpenCode. For learning how to use beads itself - workflows, commands, best practices - see the [beads documentation](https://github.com/steveyegge/beads).

The plugin automatically injects beads context on session start and after compaction, so your agent stays oriented.

## Commands

Commands are available as `/bd-*` and mirror the `bd` CLI. See the [beads documentation](https://github.com/steveyegge/beads) for the full command reference.

## Agent

### beads-task-agent

A subagent for autonomous issue completion. Designed to work through issues independently, updating status and handling dependencies.

## Project Philosophy

This plugin is **feature-complete**. Its job is to integrate beads with OpenCode, and that integration is built. The scope is intentionally narrow:

- **Vendor syncs** — When beads releases new content (commands, agents, prompts), this plugin syncs it via `scripts/sync-beads.sh`. The upstream beads project owns that content, not this plugin.
- **API adaptation** — If OpenCode's plugin API or SDK changes, this plugin adapts to stay compatible.
- **Bug fixes** — If something breaks, it gets fixed.

That's it. Feature requests, new configuration options, and scope expansion will generally be declined. If you want changes to agent behavior, command prompts, or beads workflows, those belong in the [beads project](https://github.com/steveyegge/beads) upstream.

This isn't a reflection on the quality of ideas — it's a deliberate choice to keep this plugin a thin, reliable bridge between two projects that are each evolving on their own.

## License

opencode-beads is licensed under the MIT license. See the [`LICENSE`](LICENSE) file for more information.

---

opencode-beads is not built by, or affiliated with, the OpenCode team.

OpenCode is ©2025 Anomaly.
