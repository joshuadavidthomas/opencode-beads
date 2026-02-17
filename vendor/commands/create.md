---
description: Create a new issue interactively with comprehensive description requirements
argument-hint: [title] [type] [priority]
---

Create a new beads issue with a MANDATORY comprehensive description following RFC 2119 standards.

## Description Requirements (MUST)

Every bead creation MUST include an extensive, well-articulated description containing:

### 1. Context Section (MUST)
- Why this issue exists
- What problem it solves
- Background information needed to understand the issue
- Links to related documentation, PRs, or discussions

### 2. Requirements Section (MUST)
- Specific, measurable requirements
- Use RFC 2119 keywords: MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, MAY, OPTIONAL
- Numbered requirements for traceability

### 3. Guardrails Section (MUST)
- Explicit constraints and boundaries
- What is out of scope
- Technical limitations
- Security considerations
- Performance constraints

### 4. Dos and Don'ts Section (MUST)
- Specific guidance on implementation approaches
- Anti-patterns to avoid
- Recommended patterns to follow
- Common pitfalls

### 5. Acceptance Criteria (MUST)
- Verifiable conditions for completion
- Test scenarios
- Definition of done
- Review checkpoints

### 6. Validation (MUST)
- How to verify the description is complete
- Self-review checklist before submission
- Peer review requirements if applicable

## Shell Safety Requirements (MUST)

When creating the description via command line:
- Escape special characters properly for bash/zsh
- Use single quotes for literal strings
- Avoid unescaped backticks, dollars signs, or backslashes
- Validate the description renders correctly before submission
- Test with: `echo '<description>'` to verify no shell expansion issues

### Technical Error Handling (MUST)

If ANY technical issue arises during `bd create` execution (shell escaping errors, JSON parsing failures, command execution errors):
- The agent MUST fix the TECHNICAL problem (e.g., fix escaping, adjust quoting, handle special characters)
- The agent MUST NOT degrade, simplify, or remove content from the description
- The agent MUST preserve ALL 6 required sections and ALL RFC 2119 keywords
- The agent MUST retry with the corrected command while keeping the full description intact
- The agent MUST NOT fall back to a minimal description due to technical errors
- If unable to execute after fixes, the agent MUST report the technical error and ask for help, NOT create a degraded issue

## RFC 2119 Compliance (MUST)

Use RFC 2119 keywords consistently throughout:
- **MUST/REQUIRED/SHALL**: Absolute requirements
- **MUST NOT/SHALL NOT**: Absolute prohibitions
- **SHOULD/RECOMMENDED**: Strong suggestions (can deviate with justification)
- **SHOULD NOT**: Discouraged but possible
- **MAY/OPTIONAL**: Truly optional elements

## Command Usage

```bash
# Basic usage (will prompt for description)
bd create "Issue title" -t bug|feature|task|epic|chore|decision -p 0-4

# With description via stdin (RECOMMENDED for complex descriptions)
cat << 'EOF' | bd create "Issue title" -t task -p 2 --description -
## Context
[Background and rationale]

## Requirements
1. MUST [requirement 1]
2. MUST [requirement 2]
3. SHOULD [recommendation]

## Guardrails
- MUST NOT [constraint]
- Scope limited to [boundary]

## Dos and Don'ts
- DO [recommended approach]
- DON'T [anti-pattern]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Validation
- [ ] Description reviewed for completeness
- [ ] RFC 2119 keywords used correctly
- [ ] Shell-safe formatting verified
EOF
```

## Validation Steps (MUST)

Before creating the issue:
1. Verify description contains all 6 required sections
2. Confirm RFC 2119 keywords are used appropriately
3. Test description in shell: `echo '<description>' | head`
4. Ensure no markdown rendering issues
5. Review for clarity and completeness

After creation:
- Run `bd show <id>` to verify description rendered correctly
- Run `bd sync` to export to JSONL
