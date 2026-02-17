import { describe, it, expect, beforeAll } from "vitest";
import {
  loadCommands,
  loadAgent,
  BEADS_GUIDANCE,
  parseMarkdownWithFrontmatter,
} from "../src/vendor";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vendorDir = path.join(__dirname, "..", "vendor");

describe("vendor", () => {
  describe("parseMarkdownWithFrontmatter", () => {
    it("should parse markdown with valid frontmatter", () => {
      const content = `---
description: Test command
argument-hint: [test]
---

This is the body content.`;

      const result = parseMarkdownWithFrontmatter(content);

      expect(result).not.toBeNull();
      expect(result?.frontmatter.description).toBe("Test command");
      expect(result?.frontmatter["argument-hint"]).toBe("[test]");
      expect(result?.body).toBe("This is the body content.");
    });

    it("should return null for content without frontmatter", () => {
      const content = "Just plain markdown without frontmatter.";

      const result = parseMarkdownWithFrontmatter(content);

      expect(result).toBeNull();
    });

    it("should return null for frontmatter without trailing newline", () => {
      // The regex requires a newline after closing ---
      const content = `---
description: Test
---`;

      const result = parseMarkdownWithFrontmatter(content);

      // No trailing newline means no match
      expect(result).toBeNull();
    });

    it("should parse frontmatter with empty body but trailing newline", () => {
      // Frontmatter with trailing newline but no content
      const content = "---\ndescription: Test\n---\n";

      const result = parseMarkdownWithFrontmatter(content);

      expect(result).not.toBeNull();
      expect(result?.frontmatter.description).toBe("Test");
      expect(result?.body).toBe("");
    });

    it("should handle empty frontmatter values", () => {
      const content = `---
description:
---

Body content.`;

      const result = parseMarkdownWithFrontmatter(content);

      expect(result).not.toBeNull();
      expect(result?.frontmatter.description).toBe("");
    });

    it("should handle quoted values", () => {
      const content = `---
description: "Quoted description"
---

Body.`;

      const result = parseMarkdownWithFrontmatter(content);

      expect(result?.frontmatter.description).toBe("Quoted description");
    });

    it("should handle empty array syntax", () => {
      const content = `---
deps: []
---

Body.`;

      const result = parseMarkdownWithFrontmatter(content);

      expect(result?.frontmatter.deps).toBe("");
    });
  });

  describe("loadCommands", () => {
    it("should load all command markdown files", async () => {
      const commands = await loadCommands();

      // Should have multiple commands loaded
      expect(Object.keys(commands).length).toBeGreaterThan(0);

      // Each command should have required properties
      for (const [name, command] of Object.entries(commands)) {
        expect(name).toMatch(/^beads:/);
        expect(command.description).toBeDefined();
        expect(command.template).toBeDefined();
        expect(typeof command.description).toBe("string");
        expect(typeof command.template).toBe("string");
      }
    });

    it("should include specific commands", async () => {
      const commands = await loadCommands();

      expect(commands["beads:create"]).toBeDefined();
      expect(commands["beads:ready"]).toBeDefined();
      expect(commands["beads:show"]).toBeDefined();
      expect(commands["beads:close"]).toBeDefined();
    });

    it("should parse command with argument hint correctly", async () => {
      const commands = await loadCommands();
      const createCmd = commands["beads:create"];

      expect(createCmd).toBeDefined();
      expect(createCmd?.description).toContain("(");
      expect(createCmd?.description).toContain(")");
    });
  });

  describe("loadAgent", () => {
    it("should load all agent definitions", async () => {
      const agents = await loadAgent();

      // Should have agents loaded
      expect(Object.keys(agents).length).toBeGreaterThan(0);

      // Each agent should have required properties
      for (const [name, agent] of Object.entries(agents)) {
        expect(name).toMatch(/^beads:/);
        if (agent) {
          expect(agent.description).toBeDefined();
          expect(agent.prompt).toBeDefined();
          expect(agent.mode).toBe("subagent");
        }
      }
    });

    it("should include specific agents", async () => {
      const agents = await loadAgent();

      expect(agents["beads:task-agent"]).toBeDefined();
      expect(agents["beads:query-agent"]).toBeDefined();
      expect(agents["beads:cleanup-agent"]).toBeDefined();
      expect(agents["beads:description-validator"]).toBeDefined();
    });

    it("should include beads CLI usage in agent prompts", async () => {
      const agents = await loadAgent();
      const taskAgent = agents["beads:task-agent"];

      expect(taskAgent?.prompt).toContain("bd");
      expect(taskAgent?.prompt).toContain("beads");
    });
  });

  describe("BEADS_GUIDANCE", () => {
    it("should include CLI usage section", () => {
      expect(BEADS_GUIDANCE).toContain("CLI Usage");
      expect(BEADS_GUIDANCE).toContain("bd init");
      expect(BEADS_GUIDANCE).toContain("bd ready");
    });

    it("should include description standards section", () => {
      expect(BEADS_GUIDANCE).toContain("RFC 2119");
      expect(BEADS_GUIDANCE).toContain("MUST");
      expect(BEADS_GUIDANCE).toContain("SHOULD");
    });

    it("should include agent delegation section", () => {
      expect(BEADS_GUIDANCE).toContain("beads:task-agent");
      expect(BEADS_GUIDANCE).toContain("beads:query-agent");
    });

    it("should include auto-flush behavior section", () => {
      expect(BEADS_GUIDANCE).toContain("Auto-Flush Behavior");
      expect(BEADS_GUIDANCE).toContain("bd sync --flush-only");
    });
  });
});
