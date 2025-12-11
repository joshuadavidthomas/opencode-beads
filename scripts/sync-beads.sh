#!/usr/bin/env bash

set -euo pipefail

BEADS_VERSION="v0.29.0"

BEADS_REPO="https://github.com/steveyegge/beads.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
TEMP_DIR=$(mktemp -d)

cleanup() {
    rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

git clone --depth 1 --branch "$BEADS_VERSION" --quiet "$BEADS_REPO" "$TEMP_DIR/beads"

rm -rf "$PLUGIN_DIR/vendor/commands"
cp -r "$TEMP_DIR/beads/commands" "$PLUGIN_DIR/vendor/commands"

mkdir -p "$PLUGIN_DIR/vendor/agents"
cp "$TEMP_DIR/beads/.claude-plugin/agents/task-agent.md" "$PLUGIN_DIR/vendor/agents/"
