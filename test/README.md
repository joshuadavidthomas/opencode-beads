# Testing Documentation

This directory contains the test suite for the opencode-beads plugin.

## Running Tests

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test --watch

# Run tests with coverage
bun run test:coverage

# Run specific test file
bun run test test/plugin.test.ts
```

## Test Structure

### `mocks/plugin-input.ts`

Mock utilities for creating `PluginInput` objects:

- `createMockClient()` - Mock OpenCode client with session methods
- `createMockShell()` - Mock shell function (`$`)
- `createMockPluginInput()` - Complete PluginInput factory
- `mockBdPrime()` - Setup mock for bd prime output
- `createMockMessages()` - Create mock session messages

### `plugin.test.ts`

Tests for the main plugin:

- Plugin initialization
- Config registration (commands and agents)
- Context injection (`chat.message` handler)
- Auto-flush mutation detection (`tool.execute.after` handler)
- Session compaction handling (`event` handler)

### `vendor.test.ts`

Tests for vendor file loading:

- `loadCommands()` - Load all command markdown files
- `loadAgent()` - Load all agent markdown files
- `BEADS_GUIDANCE` - Content verification

### `schemas.test.ts`

Tests for Zod schemas:

- Schema validation for valid/invalid data
- `validateOutput()` function
- `getSchemaForCommand()` function

## Writing New Tests

When adding new functionality:

1. Add mocks to `mocks/` if needed
2. Create/update test file in `test/`
3. Use `vi.fn()` for mocking
4. Use `createMockPluginInput()` as base for plugin tests
5. Run `bun run typecheck` to ensure types are correct

## Coverage Goals

- Core functionality: 90%+
- Utility functions: 80%+
- Edge cases: Document in tests
