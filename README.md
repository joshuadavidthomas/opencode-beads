# opencode-beads

[Beads](https://github.com/gastownhall/beads) issue tracker integration for [OpenCode](https://opencode.ai).

> [!NOTE]
> This plugin is intentionally small in scope. The [beads](https://github.com/gastownhall/beads) project is moving quickly and is a moving target — any additional layers on top of it add churn.
>
> To minimize maintenance, this plugin defers to beads and limits its scope to bug fixes and syncing upstream vendor plugin content. Feature requests and additional customization are generally out of scope.
>
> If you want to customize behavior, the plugin surface area is small — forking or copying it locally is encouraged.

## Requirements

- [OpenCode](https://opencode.ai/) v2.1.2 or later (opencode-beads v0.8.0 is the last release for OpenCode v1)

## Installation

Install the beads CLI:

```bash
curl -fsSL https://raw.githubusercontent.com/gastownhall/beads/main/scripts/install.sh | bash
```

See the [beads installation guide](https://github.com/gastownhall/beads/blob/main/docs/getting-started/installation.md) for alternative methods (Homebrew, npm, Windows, etc.).

Add to your OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "plugins": ["opencode-beads"]
}
```

Restart OpenCode and you're ready to go.

Optionally, pin to a specific version for stability:

```json
{
  "plugins": ["opencode-beads@0.9.0"]
}
```

OpenCode fetches unpinned plugins from npm on each startup; pinned versions are cached and require a manual version bump to update.

## Features

- **Context injection** - Automatically runs `bd prime` once per session and adds its output to the system prompt, where it survives compaction
- **Commands** - All beads operations available as `/beads:*` commands
- **Task agent** - Autonomous issue completion via `beads-task-agent` subagent

## Usage

This plugin brings beads into OpenCode. For learning how to use beads itself - workflows, commands, best practices - see the [beads documentation](https://github.com/gastownhall/beads).

The plugin automatically adds beads context to the system prompt of primary agents (and `beads-task-agent`), so your agent stays oriented, including after compaction. Other subagents don't receive it.

## Commands

Commands are available as `/beads:*` (for example, `/beads:ready` or `/beads:create`) and mirror the `bd` CLI. See the [beads documentation](https://github.com/gastownhall/beads) for the full command reference.

## Agent

### beads-task-agent

A subagent for autonomous issue completion. Designed to work through issues independently, updating status and handling dependencies.

## License

opencode-beads is licensed under the MIT license. See the [`LICENSE`](LICENSE) file for more information.

---

opencode-beads is not built by, or affiliated with, the OpenCode team.

OpenCode is ©2025 Anomaly.
