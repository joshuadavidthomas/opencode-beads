#!/usr/bin/env bash

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

BEADS_REPO="https://github.com/steveyegge/beads.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"

# 1. Fetch latest version
echo "Fetching latest beads version..."
VERSION=$(git ls-remote --tags --refs --sort=-v:refname "$BEADS_REPO" | head -1 | sed 's/.*\///')
echo "Latest beads version: $VERSION"

# 2. Clone and sync files
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

echo "Cloning beads $VERSION..."
git clone --depth 1 --branch "$VERSION" --quiet "$BEADS_REPO" "$TEMP_DIR/beads"

echo "Syncing vendor files..."
rm -rf "$PLUGIN_DIR/vendor/commands"
cp -r "$TEMP_DIR/beads/commands" "$PLUGIN_DIR/vendor/commands"

mkdir -p "$PLUGIN_DIR/vendor/agents"
cp "$TEMP_DIR/beads/.claude-plugin/agents/task-agent.md" "$PLUGIN_DIR/vendor/agents/"

# 3. Check for changes
if git -C "$PLUGIN_DIR" diff --quiet; then
  echo "✓ Already synced to $VERSION"
  exit 0
fi

echo "✓ Changes detected"

# 4. Check for existing PR (idempotent)
echo "Checking for existing PR..."
if command -v gh &> /dev/null; then
  EXISTING_PRS=$(gh pr list --search "sync: beads $VERSION in:title" --json number --jq 'length' 2>/dev/null || echo "0")
  if [ "$EXISTING_PRS" -gt 0 ]; then
    echo "✓ PR already exists for $VERSION"
    exit 0
  fi
fi

# 5. Update changelog
echo "Updating changelog..."
CHANGELOG="$PLUGIN_DIR/CHANGELOG.md"

# Check if ### Changed already exists under [Unreleased]
if sed -n '/^## \[Unreleased\]$/,/^## \[/p' "$CHANGELOG" | grep -q "^### Changed$"; then
  # Append to existing ### Changed section
  sed -i "/^## \[Unreleased\]$/,/^## \[/ {
    /^### Changed$/a\\
- Synced vendored beads files to $VERSION
  }" "$CHANGELOG"
else
  # Create new ### Changed section
  sed -i "/^## \[Unreleased\]$/a\\
\\
### Changed\\
\\
- Synced vendored beads files to $VERSION" "$CHANGELOG"
fi

if $DRY_RUN; then
  echo ""
  echo "[DRY RUN] Would create PR for $VERSION with the following changes:"
  echo ""
  git -C "$PLUGIN_DIR" diff
  exit 0
fi

# 6. Create branch, commit, push, PR
echo "Creating branch and PR..."
BRANCH="sync-beads-$VERSION"

git -C "$PLUGIN_DIR" checkout -b "$BRANCH"
git -C "$PLUGIN_DIR" add -A
git -C "$PLUGIN_DIR" commit -m "sync: beads $VERSION"
git -C "$PLUGIN_DIR" push -u origin "$BRANCH"

gh pr create \
  --title "sync: beads $VERSION" \
  --body "Automated sync of vendored beads files to $VERSION"

echo "✓ PR created successfully"
