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

[unreleased]: https://github.com/joshuadavidthomas/opencode-beads/compare/v0.1.2...HEAD
[0.1.0]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.1.0
[0.1.1]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.1.1
[0.1.2]: https://github.com/joshuadavidthomas/opencode-beads/releases/tag/v0.1.2
