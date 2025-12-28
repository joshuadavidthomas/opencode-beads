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
  "plugin": ["opencode-beads@0.3.1"]
}
```

Restart OpenCode and you're ready to go.

Pin to a specific version to ensure updates work correctly - OpenCode's lockfile won't re-resolve unpinned versions. To upgrade, change the version and restart.

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

## License

opencode-beads is licensed under the MIT license. See the [`LICENSE`](LICENSE) file for more information.

---

opencode-beads is not built by, or affiliated with, the OpenCode team.

OpenCode is ©2025 Anomaly.
