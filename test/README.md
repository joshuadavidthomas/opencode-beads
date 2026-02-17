# Testing Documentation

This directory contains the test suite for the opencode-beads plugin.

## Test Structure

```
test/
├── README.md                 # This file
├── mocks/
│   └── plugin-input.ts      # Mock utilities for PluginInput
├── plugin.test.ts           # Tests for src/plugin.ts
├── vendor.test.ts           # Tests for src/vendor.ts
└── schemas.test.ts          # Tests for src/schemas.ts
```

## Running Tests

```bash
# Run all tests
bun run test

# Run tests with coverage
bun run test:coverage

# Run tests in watch mode (during development)
bun run test -- --watch

# Run specific test file
bun run test -- test/schemas.test.ts

# Run tests matching a pattern
bun run test -- --grep "IssueSchema"
```

## Writing Tests

### Using Mock Utilities

The `test/mocks/plugin-input.ts` file provides helpers for creating mock objects:

```typescript
import { createMockPluginInput, createMockChatOutput } from "./mocks/plugin-input";

// Create a complete mock PluginInput
const input = createMockPluginInput({
  directory: "/my/project",
  worktree: "/my/project"
});

// Access the mock client
const client = input.client;

// Check what was logged
const logs = (client as any)._getLogs();

// Create chat output for testing message hooks
const output = createMockChatOutput({ sessionID: "test-session" });
```

### Testing Plugin Hooks

```typescript
import { describe, it, expect } from "vitest";
import { BeadsPlugin } from "../src/plugin";
import { createMockPluginInput, createMockChatOutput } from "./mocks/plugin-input";

describe("my feature", () => {
  it("should do something", async () => {
    const input = createMockPluginInput();
    const plugin = await BeadsPlugin(input);

    // Test chat.message hook
    await plugin["chat.message"]!(
      { sessionID: "test" },
      createMockChatOutput()
    );

    // Assertions...
  });
});
```

### Testing Schemas

```typescript
import { describe, it, expect } from "vitest";
import { IssueSchema } from "../src/schemas";

describe("my schema", () => {
  it("should validate valid data", () => {
    const result = IssueSchema.safeParse({
      id: "beads-1",
      title: "Test",
      status: "open",
      type: "task",
      priority: 2
    });

    expect(result.success).toBe(true);
  });
});
```

## Validation Script

The `scripts/validate-plugin.ts` script performs additional checks:

- All required source files exist
- All vendor commands have valid frontmatter
- All vendor agents have valid frontmatter
- Command names follow naming convention
- Agent names follow naming convention
- No duplicate command/agent names
- TypeScript compilation succeeds

Run it with:

```bash
bun run validate
```

## Continuous Integration

Tests run automatically on:
- Push to `main` branch
- Pull requests to `main` branch
- Manual workflow dispatch

See `.github/workflows/ci.yml` for details.

## Troubleshooting

### Tests failing with import errors

Make sure you're using the correct import paths. Tests should import from `../src/...` not `../src/...`

### Coverage not generating

Coverage requires the `@vitest/coverage-v8` package. If it's missing:

```bash
bun add -d @vitest/coverage-v8
```

### Mock not working as expected

Check that you're using the mock utilities correctly. The mock client and shell have special `_getLogs()` and `_getCommands()` methods for inspecting calls.

## Adding New Tests

When adding new features:

1. Create test file in `test/` directory
2. Import from `../src/` for the code being tested
3. Use mock utilities from `./mocks/plugin-input`
4. Follow the existing test patterns
5. Run tests to ensure they pass
6. Update this README if needed
