import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs/promises";
import {
  loadCommands,
  loadAgent,
  BEADS_GUIDANCE,
  parseMarkdownWithFrontmatter,
  readVendorFile,
  listVendorFiles,
} from "../src/vendor";

describe("vendor", () => {
  describe("loadCommands", () => {
    it("should load all command files", async () => {
      const commands = await loadCommands();

      // Should have loaded multiple commands
      expect(Object.keys(commands).length).toBeGreaterThan(20);
    });

    it("should load specific known commands", async () => {
      const commands = await loadCommands();

      // Check for expected commands
      expect(commands).toHaveProperty("beads:ready");
      expect(commands).toHaveProperty("beads:create");
      expect(commands).toHaveProperty("beads:show");
      expect(commands).toHaveProperty("beads:list");
      expect(commands).toHaveProperty("beads:status");
      expect(commands).toHaveProperty("beads:doctor");
      expect(commands).toHaveProperty("beads:query");
      expect(commands).toHaveProperty("beads:stale");
    });

    it("should have proper command structure", async () => {
      const commands = await loadCommands();

      for (const [name, command] of Object.entries(commands)) {
        expect(name).toMatch(/^beads:/);
        expect(command).toHaveProperty("description");
        expect(command).toHaveProperty("template");
        expect(typeof command.description).toBe("string");
        expect(typeof command.template).toBe("string");
      }
    });

    it("should load new commands with frontmatter", async () => {
      const commands = await loadCommands();

      // These should have frontmatter
      expect(commands["beads:doctor"]).toBeDefined();
      expect(commands["beads:status"]).toBeDefined();
      expect(commands["beads:query"]).toBeDefined();
      expect(commands["beads:stale"]).toBeDefined();
    });
  });

  describe("loadAgent", () => {
    it("should load all agents", async () => {
      const agents = await loadAgent();

      // Should have loaded multiple agents
      expect(Object.keys(agents).length).toBeGreaterThanOrEqual(4);
    });

    it("should load specific agents", async () => {
      const agents = await loadAgent();

      expect(agents).toHaveProperty("beads:task-agent");
      expect(agents).toHaveProperty("beads:query-agent");
      expect(agents).toHaveProperty("beads:cleanup-agent");
      expect(agents).toHaveProperty("beads:description-validator-agent");
    });

    it("should have proper agent structure", async () => {
      const agents = await loadAgent();

      for (const [name, agent] of Object.entries(agents)) {
        expect(name).toMatch(/^beads:/);
        expect(agent).toHaveProperty("description");
        expect(agent).toHaveProperty("prompt");
        expect(agent).toHaveProperty("mode");
        expect(agent.mode).toBe("subagent");
      }
    });

    it("should include BEADS_CLI_USAGE in prompts", async () => {
      const agents = await loadAgent();

      for (const agent of Object.values(agents)) {
        expect(agent.prompt).toContain("bd ready");
        expect(agent.prompt).toContain("bd create");
      }
    });

    it("should include subagent context in task-agent", async () => {
      const agents = await loadAgent();
      const taskAgent = agents["beads:task-agent"];

      expect(taskAgent.prompt).toContain("Write, modify, or delete code files");
      expect(taskAgent.prompt).toContain("issue management ONLY");
    });
  });

  describe("BEADS_GUIDANCE", () => {
    it("should be defined", () => {
      expect(BEADS_GUIDANCE).toBeDefined();
      expect(typeof BEADS_GUIDANCE).toBe("string");
    });

    it("should contain CLI usage section", () => {
      expect(BEADS_GUIDANCE).toContain("CLI Usage");
      expect(BEADS_GUIDANCE).toContain("bd ready");
      expect(BEADS_GUIDANCE).toContain("bd create");
    });

    it("should contain description standards section", () => {
      expect(BEADS_GUIDANCE).toContain("Description Standards");
      expect(BEADS_GUIDANCE).toContain("RFC 2119");
    });

    it("should contain agent delegation section", () => {
      expect(BEADS_GUIDANCE).toContain("Agent Delegation");
      expect(BEADS_GUIDANCE).toContain("beads:task-agent");
      expect(BEADS_GUIDANCE).toContain("beads:query-agent");
    });

    it("should contain auto-flush documentation", () => {
      expect(BEADS_GUIDANCE).toContain("Auto-Flush Behavior");
    });
  });

  describe("parseMarkdownWithFrontmatter", () => {
    it("should return null when no frontmatter is present", () => {
      const content = "# Just a markdown file\n\nNo frontmatter here.";
      const result = parseMarkdownWithFrontmatter(content);
      expect(result).toBeNull();
    });

    it("should strip quotes from frontmatter values", () => {
      const content = `---
description: "Test description"
single: 'quoted value'
mixed: unquoted value
---

Body content`;
      const result = parseMarkdownWithFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result!.frontmatter.description).toBe("Test description");
      expect(result!.frontmatter.single).toBe("quoted value");
      expect(result!.frontmatter.mixed).toBe("unquoted value");
    });

    it("should handle empty array syntax in frontmatter", () => {
      const content = `---
tags: []
description: Test
---

Body content`;
      const result = parseMarkdownWithFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result!.frontmatter.tags).toBe("");
    });
  });

  describe("readVendorFile", () => {
    it("should return null when file does not exist", async () => {
      const result = await readVendorFile("nonexistent/file.md");
      expect(result).toBeNull();
    });
  });

  describe("listVendorFiles", () => {
    it("should return empty array when directory does not exist", async () => {
      const result = await listVendorFiles("nonexistent-dir");
      expect(result).toEqual([]);
    });
  });
});
