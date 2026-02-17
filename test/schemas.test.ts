import { describe, it, expect } from "vitest";
import {
  IssueSchema,
  IssueListSchema,
  StatsSchema,
  ReadySchema,
  SyncResultSchema,
  BlockedSchema,
  StaleSchema,
  DuplicatesSchema,
  validateOutput,
  getSchemaForCommand,
} from "../src/schemas";

describe("schemas", () => {
  describe("IssueSchema", () => {
    const validIssue = {
      id: "beads-1",
      title: "Test issue",
      status: "open",
      type: "task",
      priority: 2,
    };

    it("should validate a minimal valid issue", () => {
      const result = IssueSchema.safeParse(validIssue);
      expect(result.success).toBe(true);
    });

    it("should validate a full issue with all fields", () => {
      const fullIssue = {
        ...validIssue,
        description: "Test description",
        assignee: "user@example.com",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        blockedBy: ["beads-2"],
        blocks: ["beads-3"],
        labels: ["bug", "urgent"],
      };

      const result = IssueSchema.safeParse(fullIssue);
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const invalid = { ...validIssue, status: "invalid" };
      const result = IssueSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid type", () => {
      const invalid = { ...validIssue, type: "invalid" };
      const result = IssueSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject priority below 0", () => {
      const invalid = { ...validIssue, priority: -1 };
      const result = IssueSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject priority above 4", () => {
      const invalid = { ...validIssue, priority: 5 };
      const result = IssueSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject missing required fields", () => {
      const invalid = { priority: 2 };
      const result = IssueSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("IssueListSchema", () => {
    it("should validate a list of issues", () => {
      const list = {
        issues: [
          { id: "beads-1", title: "Issue 1", status: "open", type: "task", priority: 2 },
          { id: "beads-2", title: "Issue 2", status: "in_progress", type: "feature", priority: 1 },
        ],
        total: 2,
      };

      const result = IssueListSchema.safeParse(list);
      expect(result.success).toBe(true);
    });

    it("should validate empty list", () => {
      const list = { issues: [], total: 0 };
      const result = IssueListSchema.safeParse(list);
      expect(result.success).toBe(true);
    });
  });

  describe("StatsSchema", () => {
    it("should validate stats output", () => {
      const stats = {
        total: 10,
        byStatus: { open: 5, in_progress: 3, closed: 2 },
        byType: { task: 6, feature: 3, bug: 1 },
        byPriority: { "0": 1, "1": 2, "2": 7 },
      };

      const result = StatsSchema.safeParse(stats);
      expect(result.success).toBe(true);
    });
  });

  describe("ReadySchema", () => {
    it("should validate ready command output", () => {
      const ready = {
        ready: [
          { id: "beads-1", title: "Ready issue", status: "open", type: "task", priority: 2 },
        ],
        count: 1,
      };

      const result = ReadySchema.safeParse(ready);
      expect(result.success).toBe(true);
    });
  });

  describe("SyncResultSchema", () => {
    it("should validate successful sync", () => {
      const sync = { synced: true, exported: 10, imported: 0 };
      const result = SyncResultSchema.safeParse(sync);
      expect(result.success).toBe(true);
    });

    it("should validate minimal sync result", () => {
      const sync = { synced: true };
      const result = SyncResultSchema.safeParse(sync);
      expect(result.success).toBe(true);
    });
  });

  describe("BlockedSchema", () => {
    it("should validate blocked command output", () => {
      const blocked = {
        blocked: [
          { id: "beads-1", title: "Blocked issue", status: "blocked", type: "task", priority: 1 },
        ],
        count: 1,
      };

      const result = BlockedSchema.safeParse(blocked);
      expect(result.success).toBe(true);
    });
  });

  describe("StaleSchema", () => {
    it("should validate stale command output", () => {
      const stale = {
        stale: [
          { id: "beads-1", title: "Stale issue", status: "open", type: "task", priority: 3 },
        ],
        days: 30,
        count: 1,
      };

      const result = StaleSchema.safeParse(stale);
      expect(result.success).toBe(true);
    });
  });

  describe("DuplicatesSchema", () => {
    it("should validate duplicates command output", () => {
      const issue1 = { id: "beads-1", title: "Issue 1", status: "open", type: "task", priority: 2 };
      const issue2 = { id: "beads-2", title: "Issue 2", status: "open", type: "task", priority: 2 };

      const duplicates = {
        duplicates: [[issue1, issue2]],
        count: 1,
      };

      const result = DuplicatesSchema.safeParse(duplicates);
      expect(result.success).toBe(true);
    });
  });

  describe("validateOutput", () => {
    it("should validate valid JSON", () => {
      const json = JSON.stringify({ id: "beads-1", title: "Test", status: "open", type: "task", priority: 2 });
      const result = validateOutput("create", json, IssueSchema);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should return error for invalid JSON", () => {
      const result = validateOutput("create", "invalid json", IssueSchema);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid JSON");
    });

    it("should return error for invalid data", () => {
      const json = JSON.stringify({ id: "beads-1" }); // Missing required fields
      const result = validateOutput("create", json, IssueSchema);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation failed");
    });

    it("should include command name in error", () => {
      const json = JSON.stringify({ invalid: true });
      const result = validateOutput("custom-command", json, IssueSchema);

      expect(result.success).toBe(false);
      expect(result.error).toContain("custom-command");
    });
  });

  describe("getSchemaForCommand", () => {
    it("should return IssueSchema for create command", () => {
      expect(getSchemaForCommand("create")).toBe(IssueSchema);
    });

    it("should return IssueSchema for show command", () => {
      expect(getSchemaForCommand("show")).toBe(IssueSchema);
    });

    it("should return IssueListSchema for list command", () => {
      expect(getSchemaForCommand("list")).toBe(IssueListSchema);
    });

    it("should return IssueListSchema for ready command", () => {
      expect(getSchemaForCommand("ready")).toBe(IssueListSchema);
    });

    it("should return StatsSchema for stats command", () => {
      expect(getSchemaForCommand("stats")).toBe(StatsSchema);
    });

    it("should return SyncResultSchema for sync command", () => {
      expect(getSchemaForCommand("sync")).toBe(SyncResultSchema);
    });

    it("should return BlockedSchema for blocked command", () => {
      expect(getSchemaForCommand("blocked")).toBe(BlockedSchema);
    });

    it("should return StaleSchema for stale command", () => {
      expect(getSchemaForCommand("stale")).toBe(StaleSchema);
    });

    it("should return DuplicatesSchema for duplicates command", () => {
      expect(getSchemaForCommand("duplicates")).toBe(DuplicatesSchema);
    });

    it("should return undefined for unknown command", () => {
      expect(getSchemaForCommand("unknown")).toBeUndefined();
    });
  });
});
