---
description: Epic management commands
argument-hint: [command]
---

Manage epics (large features composed of multiple issues).

Epics MUST follow the same RFC 2119 description requirements as regular issues:

## Description Requirements (MUST)

### 1. Context Section (MUST)

- Why this epic exists
- The problem/opportunity it addresses
- Business justification and expected outcomes
- Links to product roadmap, strategy docs

### 2. Requirements Section (MUST)

- High-level epic objectives
- Use RFC 2119 keywords (MUST, SHOULD, MAY, etc.)
- Measurable success criteria
- Timeframe and milestones

### 3. Guardrails Section (MUST)

- Epic scope boundaries
- What is NOT included in this epic
- Dependencies on other epics or systems
- Resource constraints
- Risk factors

### 4. Dos and Don'ts Section (MUST)

- How to organize subtasks
- Linking patterns for child issues
- Anti-patterns to avoid in epic management

### 5. Acceptance Criteria (MUST)

- Epic completion conditions
- Definition of done for the entire epic
- Sign-off requirements

### 6. Validation (MUST)

- Self-review checklist
- Stakeholder review requirements

## Subtask Organization Requirements (MUST)

When creating subtasks for an epic:

- Each subtask MUST be a separate issue
- Subtasks MUST be linked using `bd dep add <child> <epic> --type parent-child`
- Subtasks SHOULD follow the same RFC 2119 description standards
- Subtasks MUST reference the epic in their Context section

## Epic Completion Criteria (MUST)

An epic is complete when:

1. MUST: All child issues are closed
2. MUST: Acceptance criteria are verified
3. SHOULD: Retrospective/lessons learned are documented
4. SHOULD: Stakeholder sign-off obtained

## Available Commands

- **status**: Show epic completion status
  - Shows progress for each epic
  - Lists child issues and their states
  - Calculates completion percentage

- **close-eligible**: Close epics where all children are complete
  - Automatically closes epics when all child issues are done
  - Useful for bulk epic cleanup

## Epic Workflow

1. Create epic: `bd create "Large Feature" -t epic -p 1`
2. Link subtasks: `bd dep add bd-10 bd-20 --type parent-child` (epic bd-10 is parent of task bd-20)
3. Track progress: `bd epic status`
4. Auto-close when done: `bd epic close-eligible`

Epics use parent-child dependencies to track subtasks.
