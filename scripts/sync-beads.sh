#!/usr/bin/env bash

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

BEADS_REPO="https://github.com/steveyegge/beads.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"

TAGS=$(git ls-remote --tags --refs --sort=-v:refname "$BEADS_REPO")
BEADS_VERSION=$(echo "$TAGS" | head -1 | sed 's/.*\///')

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

git clone --depth 1 --branch "$BEADS_VERSION" --quiet "$BEADS_REPO" "$TEMP_DIR/beads"

rm -rf "$PLUGIN_DIR/vendor/commands"
cp -r "$TEMP_DIR/beads/commands" "$PLUGIN_DIR/vendor/commands"

mkdir -p "$PLUGIN_DIR/vendor/agents"
cp "$TEMP_DIR/beads/.claude-plugin/agents/task-agent.md" "$PLUGIN_DIR/vendor/agents/"

if [ -z "$(git -C "$PLUGIN_DIR" status --porcelain)" ]; then
  echo "No changes detected"
  exit 0
fi

CHANGELOG="$PLUGIN_DIR/CHANGELOG.md"

if sed -n '/^## \[Unreleased\]$/,/^## \[/p' "$CHANGELOG" | grep -q "^### Changed$"; then
  sed -i "/^## \[Unreleased\]$/,/^## \[/ {
    /^### Changed$/a\\
- Synced vendored beads files to $BEADS_VERSION
  }" "$CHANGELOG"
else
  sed -i "/^## \[Unreleased\]$/a\\
\\
### Changed\\
\\
- Synced vendored beads files to $BEADS_VERSION" "$CHANGELOG"
fi

if $DRY_RUN; then
  echo "[dry-run] Would create PR for $BEADS_VERSION"
  git -C "$PLUGIN_DIR" status --short
  exit 0
fi

BRANCH="sync-beads"

git -C "$PLUGIN_DIR" checkout -B "$BRANCH"
git -C "$PLUGIN_DIR" add -A
git -C "$PLUGIN_DIR" commit -m "sync: beads $BEADS_VERSION"
git -C "$PLUGIN_DIR" push -f origin "$BRANCH"

if command -v gh &> /dev/null; then
  gh pr list --head "$BRANCH" --json number --jq 'length' | grep -q '^0$' && \
    gh pr create \
      --title "sync: beads $BEADS_VERSION" \
      --body "Automated sync of vendored beads files to $BEADS_VERSION" || true
fi
