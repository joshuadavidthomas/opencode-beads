---
description: Find ready-to-work tasks with no blockers
---

Use `bd ready --json` to find tasks that are ready to work on (no blocking dependencies).

Parse the JSON output and present them to the user in a clear format showing:

- Issue ID
- Title
- Priority
- Issue type

If there are ready tasks, ask the user which one they'd like to work on. If they choose one, use `bd update <id> --status in_progress` to set its status to `in_progress`.

If there are no ready tasks, suggest checking `bd blocked --json` to see blocked issues or creating a new issue with `bd create`.
