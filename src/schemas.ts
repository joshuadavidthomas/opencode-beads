/**
 * Zod schemas for validating beads command outputs.
 */

import { z } from "zod";

/**
 * Schema for an individual issue.
 */
export const IssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["open", "in_progress", "blocked", "closed"]),
  type: z.enum(["bug", "feature", "task", "epic", "chore", "decision"]),
  priority: z.number().int().min(0).max(4),
  description: z.string().optional(),
  assignee: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
  blockedBy: z.array(z.string()).optional(),
  blocks: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
});

/**
 * Schema for a list of issues (returned by list, search, query, ready, blocked commands).
 */
export const IssueListSchema = z.object({
  issues: z.array(IssueSchema),
  total: z.number().int(),
});

/**
 * Schema for the stats command output.
 */
export const StatsSchema = z.object({
  total: z.number().int(),
  byStatus: z.record(z.string(), z.number().int()),
  byType: z.record(z.string(), z.number().int()),
  byPriority: z.record(z.string(), z.number().int()),
});

/**
 * Schema for the ready command output.
 */
export const ReadySchema = z.object({
  ready: z.array(IssueSchema),
  count: z.number().int(),
});

/**
 * Schema for the sync command output.
 */
export const SyncResultSchema = z.object({
  synced: z.boolean(),
  exported: z.number().int().optional(),
  imported: z.number().int().optional(),
  message: z.string().optional(),
});

/**
 * Schema for the blocked command output.
 */
export const BlockedSchema = z.object({
  blocked: z.array(IssueSchema),
  count: z.number().int(),
});

/**
 * Schema for the stale command output.
 */
export const StaleSchema = z.object({
  stale: z.array(IssueSchema),
  days: z.number().int(),
  count: z.number().int(),
});

/**
 * Schema for the duplicates command output.
 */
export const DuplicatesSchema = z.object({
  duplicates: z.array(z.tuple([IssueSchema, IssueSchema])),
  count: z.number().int(),
});

/**
 * Type definitions derived from schemas.
 */
export type Issue = z.infer<typeof IssueSchema>;
export type IssueList = z.infer<typeof IssueListSchema>;
export type Stats = z.infer<typeof StatsSchema>;
export type Ready = z.infer<typeof ReadySchema>;
export type SyncResult = z.infer<typeof SyncResultSchema>;
export type Blocked = z.infer<typeof BlockedSchema>;
export type Stale = z.infer<typeof StaleSchema>;
export type Duplicates = z.infer<typeof DuplicatesSchema>;

/**
 * Validation result type.
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Validate JSON output from a beads command.
 *
 * @param command - The command name (e.g., "create", "list", "stats")
 * @param json - The JSON string to validate
 * @returns Validation result with data or error
 */
export function validateOutput<T>(
  command: string,
  json: string,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  try {
    const parsed = JSON.parse(json);
    const result = schema.safeParse(parsed);

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return {
        success: false,
        error: `Validation failed for ${command}: ${result.error.message}`,
      };
    }
  } catch (e) {
    return {
      success: false,
      error: `Invalid JSON for ${command}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Get the appropriate schema for a command.
 *
 * @param command - The command name
 * @returns The Zod schema or undefined if not available
 */
export function getSchemaForCommand(command: string): z.ZodSchema | undefined {
  switch (command) {
    case "create":
    case "show":
      return IssueSchema;
    case "list":
    case "search":
    case "query":
    case "ready":
      return IssueListSchema;
    case "stats":
      return StatsSchema;
    case "sync":
      return SyncResultSchema;
    case "blocked":
      return BlockedSchema;
    case "stale":
      return StaleSchema;
    case "duplicates":
      return DuplicatesSchema;
    default:
      return undefined;
  }
}
