#!/usr/bin/env bash

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

BEADS_REPO="https://github.com/steveyegge/beads.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"

VERSION=$(git ls-remote --tags --refs --sort=-v:refname "$BEADS_REPO" | head -1 | sed 's/.*\///')

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

git clone --depth 1 --branch "$VERSION" --quiet "$BEADS_REPO" "$TEMP_DIR/beads"

rm -rf "$PLUGIN_DIR/vendor/commands"
cp -r "$TEMP_DIR/beads/commands" "$PLUGIN_DIR/vendor/commands"

mkdir -p "$PLUGIN_DIR/vendor/agents"
cp "$TEMP_DIR/beads/.claude-plugin/agents/task-agent.md" "$PLUGIN_DIR/vendor/agents/"

if git -C "$PLUGIN_DIR" diff --quiet; then
  echo "Already synced to $VERSION"
  exit 0
fi

if command -v gh &> /dev/null; then
  EXISTING_PRS=$(gh pr list --search "sync: beads $VERSION in:title" --json number --jq 'length' 2>/dev/null || echo "0")
  if [ "$EXISTING_PRS" -gt 0 ]; then
    echo "PR already exists for $VERSION"
    exit 0
  fi
fi

CHANGELOG="$PLUGIN_DIR/CHANGELOG.md"

if sed -n '/^## \[Unreleased\]$/,/^## \[/p' "$CHANGELOG" | grep -q "^### Changed$"; then
  sed -i "/^## \[Unreleased\]$/,/^## \[/ {
    /^### Changed$/a\\
- Synced vendored beads files to $VERSION
  }" "$CHANGELOG"
else
  sed -i "/^## \[Unreleased\]$/a\\
\\
### Changed\\
\\
- Synced vendored beads files to $VERSION" "$CHANGELOG"
fi

if $DRY_RUN; then
  echo "[dry-run] Would create PR for $VERSION"
  git -C "$PLUGIN_DIR" diff
  exit 0
fi

BRANCH="sync-beads-$VERSION"

git -C "$PLUGIN_DIR" checkout -b "$BRANCH"
git -C "$PLUGIN_DIR" add -A
git -C "$PLUGIN_DIR" commit -m "sync: beads $VERSION"
git -C "$PLUGIN_DIR" push -u origin "$BRANCH"

gh pr create \
  --title "sync: beads $VERSION" \
  --body "Automated sync of vendored beads files to $VERSION"
