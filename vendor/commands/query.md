---
description: Query issues using a simple query language
argument-hint: <query>
---
Query beads issues using the query language.

Usage: `bd query "status:open priority<=2 type:bug" --json`

Supported operators:
- `field:value` - exact match
- `field!=value` - not equal
- `field<=N`, `field>=N` - comparison
- `field:~text` - contains text
- `and`, `or`, `not` - boolean operators

Parse JSON output and present matching issues clearly.
