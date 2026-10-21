import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import type { Plugin } from "@opencode/plugin";
import BeadsPlugin, { expandTemplate } from "../src/plugin";

describe("expandTemplate", () => {
  test("fills positional placeholders and gives the last one the rest", () => {
    expect(expandTemplate("Run bd dep $1 from=$2 to=$3", `add bd-1 "bd 2" extra`)).toBe(
      "Run bd dep add from=bd-1 to=bd 2 extra",
    );
  });

  test("blanks positional placeholders without arguments", () => {
    expect(expandTemplate("show [$1] [$2]", "bd-1")).toBe("show [bd-1] []");
  });

  test("inserts $ARGUMENTS literally", () => {
    expect(expandTemplate("Search for: $ARGUMENTS", "price $& $1")).toBe("Search for: price $& $1");
  });

  test("appends arguments when the template has no placeholders", () => {
    expect(expandTemplate("Search issues.", "auth bug")).toBe("Search issues.\n\nauth bug");
    expect(expandTemplate("Search issues.", "  ")).toBe("Search issues.");
  });
});

test("setup registers every vendor command, including ones without frontmatter", async () => {
  const commands = new Map<string, string | undefined>();
  const context = {
    location: { directory: "/nonexistent" },
    agent: { transform: async () => {} },
    command: {
      transform: async (fn: (editor: { add(c: { name: string; description?: string }): void }) => void) => {
        fn({ add: (c) => commands.set(c.name, c.description) });
      },
    },
    session: { hook: async () => {} },
  } as unknown as Plugin.Context;

  await BeadsPlugin.setup(context);

  const files = await readdir(new URL("../vendor/commands", import.meta.url));
  expect(commands.size).toBe(files.filter((file) => file.endsWith(".md")).length);
  expect(commands.get("beads:prime")).toBe("beads:prime");
  expect(commands.get("beads:search")).toBe(
    "Search issues by text query (<query> [--status] [--label] [--assignee])",
  );
});
