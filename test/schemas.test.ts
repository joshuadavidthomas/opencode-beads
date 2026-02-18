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
    it("should validate a valid issue", () => {
      const validIssue = {
        id: "bd-123",
        title: "Test issue",
        status: "open",
        type: "bug",
        priority: 1,
        description: "A test issue",
        assignee: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
        labels: ["bug", "test"],
        blockedBy: [],
        blocks: [],
      };

      const result = IssueSchema.safeParse(validIssue);
      expect(result.success).toBe(true);
    });

    it("should validate with minimal fields", () => {
      const minimalIssue = {
        id: "bd-123",
        title: "Test issue",
        status: "open",
        type: "task",
        priority: 2,
      };

      const result = IssueSchema.safeParse(minimalIssue);
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const invalidIssue = {
        id: "bd-123",
        title: "Test issue",
        status: "invalid_status",
        type: "bug",
        priority: 1,
      };

      const result = IssueSchema.safeParse(invalidIssue);
      expect(result.success).toBe(false);
    });

    it("should reject invalid type", () => {
      const invalidIssue = {
        id: "bd-123",
        title: "Test issue",
        status: "open",
        type: "invalid_type",
        priority: 1,
      };

      const result = IssueSchema.safeParse(invalidIssue);
      expect(result.success).toBe(false);
    });

    it("should reject priority out of range", () => {
      const invalidIssue = {
        id: "bd-123",
        title: "Test issue",
        status: "open",
        type: "bug",
        priority: 5,
      };

      const result = IssueSchema.safeParse(invalidIssue);
      expect(result.success).toBe(false);
    });
  });

  describe("IssueListSchema", () => {
    it("should validate a valid issue list", () => {
      const validList = {
        issues: [
          {
            id: "bd-123",
            title: "Issue 1",
            status: "open",
            type: "bug",
            priority: 1,
          },
          {
            id: "bd-456",
            title: "Issue 2",
            status: "in_progress",
            type: "feature",
            priority: 2,
          },
        ],
        total: 2,
      };

      const result = IssueListSchema.safeParse(validList);
      expect(result.success).toBe(true);
    });

    it("should validate empty list", () => {
      const emptyList = {
        issues: [],
        total: 0,
      };

      const result = IssueListSchema.safeParse(emptyList);
      expect(result.success).toBe(true);
    });
  });

  describe("StatsSchema", () => {
    it("should validate valid stats", () => {
      const validStats = {
        total: 10,
        byStatus: { open: 5, closed: 5 },
        byType: { bug: 3, feature: 7 },
        byPriority: { "0": 1, "1": 2, "2": 7 },
      };

      const result = StatsSchema.safeParse(validStats);
      expect(result.success).toBe(true);
    });
  });

  describe("validateOutput", () => {
    it("should validate valid JSON", () => {
      const json = JSON.stringify({
        id: "bd-123",
        title: "Test",
        status: "open",
        type: "bug",
        priority: 1,
      });

      const result = validateOutput("create", json, IssueSchema);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should reject invalid JSON", () => {
      const json = "not valid json";

      const result = validateOutput("create", json, IssueSchema);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid JSON");
    });

    it("should reject schema violations", () => {
      const json = JSON.stringify({
        id: "bd-123",
        title: "Test",
        status: "invalid_status",
        type: "bug",
        priority: 1,
      });

      const result = validateOutput("create", json, IssueSchema);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("getSchemaForCommand", () => {
    it("should return IssueSchema for create", () => {
      const schema = getSchemaForCommand("create");
      expect(schema).toBe(IssueSchema);
    });

    it("should return IssueSchema for show", () => {
      const schema = getSchemaForCommand("show");
      expect(schema).toBe(IssueSchema);
    });

    it("should return IssueListSchema for list", () => {
      const schema = getSchemaForCommand("list");
      expect(schema).toBe(IssueListSchema);
    });

    it("should return IssueListSchema for ready", () => {
      const schema = getSchemaForCommand("ready");
      expect(schema).toBe(IssueListSchema);
    });

    it("should return StatsSchema for stats", () => {
      const schema = getSchemaForCommand("stats");
      expect(schema).toBe(StatsSchema);
    });

    it("should return SyncResultSchema for sync", () => {
      const schema = getSchemaForCommand("sync");
      expect(schema).toBe(SyncResultSchema);
    });

    it("should return BlockedSchema for blocked", () => {
      const schema = getSchemaForCommand("blocked");
      expect(schema).toBe(BlockedSchema);
    });

    it("should return StaleSchema for stale", () => {
      const schema = getSchemaForCommand("stale");
      expect(schema).toBe(StaleSchema);
    });

    it("should return DuplicatesSchema for duplicates", () => {
      const schema = getSchemaForCommand("duplicates");
      expect(schema).toBe(DuplicatesSchema);
    });

    it("should return undefined for unknown commands", () => {
      const schema = getSchemaForCommand("unknown");
      expect(schema).toBeUndefined();
    });
  });
});
