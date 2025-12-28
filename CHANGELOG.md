# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project attempts to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!--
## [${version}]
### Added - for new features
### Changed - for changes in existing functionality
### Deprecated - for soon-to-be removed features
### Removed - for now removed features
### Fixed - for any bug fixes
### Security - in case of vulnerabilities
[${version}]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v${version}
-->

## [Unreleased]

## [0.3.2]

### Changed

- Synced vendored beads files to v0.39.1

## [0.3.1]

### Changed

- Synced vendored beads files to v0.38.0

## [0.3.0]

### Added

- `/bd-audit` command synced from upstream beads project

### Changed

- Bumped beads version to 0.33.3

## [0.2.2]

### Changed

- Bumped beads version to 0.30.3

## [0.2.1]

### Changed

- Strengthened agent delegation guidance to default to using `beads-task-agent` for any multi-command or context-gathering work
- Added explicit guidance for status overview queries ("what's next", "what's blocked") to use the agent instead of running multiple `bd` commands
- Split guidance into session-specific (when to delegate) and subagent-specific (how to behave) contexts
- Added subagent awareness instructions explaining that final message is returned to calling agent
- Added output format guidance for subagent to return concise summaries instead of raw JSON dumps

## [0.2.0]

### Changed

- Enhanced beads guidance with agent delegation section to help models automatically use `beads-task-agent` for multi-step work
- Improved CLI command reference with inline descriptions

## [0.1.2]

### Fixed

- Fixed context injection being skipped when other plugins inject messages first by checking for actual `<beads-context>` tag instead of just message count

## [0.1.1]

### Fixed

- Fixed duplicate context injection caused by plugin being loaded twice due to having both named and default exports

## [0.1.0]

### Added

- Initial release of beads issue tracker integration for OpenCode
- Automatic context injection via `bd prime` on session start and after compaction
- CLI guidance for mapping beads MCP tools to `bd` CLI commands
- Dynamic command loading from vendor directory (available as `/bd-*` commands)
- `beads-task-agent` subagent for autonomous issue completion

### New Contributors

- Josh Thomas <josh@joshthomas.dev> (maintainer)

[unreleased]: https://github.com/joshuadavidthomas/opencode-beads/compare/v0.3.2...HEAD
[0.3.2]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.3.2
[0.1.0]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.1.0
[0.1.1]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.1.1
[0.1.2]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.1.2
[0.2.0]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.2.0
[0.2.1]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.2.1
[0.2.2]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.2.2
[0.3.0]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.3.0
[0.3.1]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.3.1
