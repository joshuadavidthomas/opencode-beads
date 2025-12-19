/**
 * Todo-Beads Synchronization Module
 *
 * Maps OpenCode todos to beads issues, enabling persistence across
 * session disconnects and context compaction.
 *
 * Architecture:
 * - Each OpenCode session gets a beads "session issue" (epic)
 * - Each todo becomes a child issue under the session issue
 * - Mapping stored in .beads/opencode-todo-mapping.json for fast lookups
 * - Todo IDs stored in beads issue notes for recovery
 */

import { tool, type PluginInput } from "@opencode-ai/plugin";
import * as fs from "node:fs/promises";
import * as path from "node:path";

type BunShell = PluginInput["$"];

// =============================================================================
// Types
// =============================================================================

/**
 * OpenCode todo item format (from native todowrite tool)
 */
export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "high" | "medium" | "low";
}

/**
 * Beads issue (simplified, from bd --json output)
 */
interface BeadsIssue {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "closed";
  priority: number;
  issue_type: string;
  notes?: string;
}

/**
 * Mapping between OpenCode todos and beads issues
 */
interface TodoBeadsMapping {
  /** Maps sessionID -> session beads issue ID */
  sessions: Record<string, string>;
  /** Maps sessionID -> { todoID -> beadsIssueID } */
  todos: Record<string, Record<string, string>>;
  /** Last sync timestamp */
  lastSync: number;
}

// =============================================================================
// Constants
// =============================================================================

const MAPPING_FILE = ".beads/opencode-todo-mapping.json";

/** Map OpenCode priority to beads priority */
const PRIORITY_TO_BEADS: Record<string, number> = {
  high: 1,
  medium: 2,
  low: 3,
};

/** Map beads priority to OpenCode priority */
const PRIORITY_FROM_BEADS: Record<number, TodoItem["priority"]> = {
  0: "high",
  1: "high",
  2: "medium",
  3: "low",
  4: "low",
};

/** Map OpenCode status to beads status */
const STATUS_TO_BEADS: Record<TodoItem["status"], BeadsIssue["status"]> = {
  pending: "open",
  in_progress: "in_progress",
  completed: "closed",
  cancelled: "closed",
};

// =============================================================================
// Mapping File Management
// =============================================================================

/**
 * Load the todo-beads mapping from disk
 */
async function loadMapping(): Promise<TodoBeadsMapping> {
  try {
    const content = await fs.readFile(MAPPING_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid - return empty mapping
    return {
      sessions: {},
      todos: {},
      lastSync: 0,
    };
  }
}

/**
 * Ensure a file is in .gitignore of a directory
 */
async function ensureGitignoreEntry(dir: string, filename: string): Promise<void> {
  const gitignorePath = path.join(dir, ".gitignore");
  try {
    const content = await fs.readFile(gitignorePath, "utf-8");
    const lines = content.split("\n");
    if (lines.some(line => line.trim() === filename)) {
      return;
    }
    const newContent = content.endsWith("\n") ? content + filename + "\n" : content + "\n" + filename + "\n";
    await fs.writeFile(gitignorePath, newContent);
  } catch {
    await fs.writeFile(gitignorePath, filename + "\n");
  }
}

/**
 * Save the todo-beads mapping to disk
 */
async function saveMapping(mapping: TodoBeadsMapping): Promise<void> {
  mapping.lastSync = Date.now();
  const dir = path.dirname(MAPPING_FILE);
  await fs.mkdir(dir, { recursive: true });
  
  // Only ensure gitignore entry on initial file creation
  const fileExists = await fs.access(MAPPING_FILE).then(() => true).catch(() => false);
  if (!fileExists) {
    await ensureGitignoreEntry(dir, path.basename(MAPPING_FILE));
  }
  
  await fs.writeFile(MAPPING_FILE, JSON.stringify(mapping, null, 2));
}

// =============================================================================
// Session Issue Management
// =============================================================================

/**
 * Get or create a beads session issue for tracking this session's todos
 */
async function getOrCreateSessionIssue(
  $: BunShell,
  sessionID: string,
  mapping: TodoBeadsMapping
): Promise<string> {
  // Check if we already have a session issue
  if (mapping.sessions[sessionID]) {
    // Verify it still exists
    try {
      const result = await $`bd show ${mapping.sessions[sessionID]} --json`.json();
      if (Array.isArray(result) && result[0]?.id) {
        return mapping.sessions[sessionID];
      }
    } catch {
      // Issue was deleted, create a new one
    }
  }

  // Create new session issue
  const shortSessionID = sessionID.slice(0, 8);
  const timestamp = new Date().toISOString().split("T")[0];
  const title = `OpenCode Session ${shortSessionID} (${timestamp})`;

  try {
    const result = await $`bd create ${title} -t epic -p 2 -d "Tracks todos for OpenCode session ${sessionID}" --json`.json();
    const issueID = result.id;
    mapping.sessions[sessionID] = issueID;
    mapping.todos[sessionID] = {};
    await saveMapping(mapping);
    return issueID;
  } catch (error) {
    throw new Error(`Failed to create session issue: ${error}`);
  }
}

// =============================================================================
// Todo Synchronization
// =============================================================================

/**
 * Sync todos to beads issues
 *
 * Creates/updates/closes beads issues to match the current todo list.
 */
export async function syncTodosToBeads(
  $: BunShell,
  sessionID: string,
  todos: TodoItem[]
): Promise<void> {
  const mapping = await loadMapping();

  // Get or create session issue
  const sessionIssueID = await getOrCreateSessionIssue($, sessionID, mapping);

  // Ensure we have a todo map for this session
  if (!mapping.todos[sessionID]) {
    mapping.todos[sessionID] = {};
  }
  const todoMap = mapping.todos[sessionID];

  // Track which todos we've seen (to detect deletions)
  const seenTodoIDs = new Set<string>();

  for (const todo of todos) {
    seenTodoIDs.add(todo.id);
    const existingBeadsID = todoMap[todo.id];

    if (existingBeadsID) {
      // Update existing issue
      await updateBeadsIssue($, existingBeadsID, todo);
    } else {
      // Create new issue
      const newBeadsID = await createBeadsIssue($, sessionIssueID, todo);
      todoMap[todo.id] = newBeadsID;
    }
  }

  // Handle deleted todos (close their beads issues)
  for (const [todoID, beadsID] of Object.entries(todoMap)) {
    if (!seenTodoIDs.has(todoID)) {
      try {
        await $`bd close ${beadsID} --reason "Todo removed from OpenCode" --json`.quiet();
      } catch {
        // Issue might already be closed or deleted
      }
      delete todoMap[todoID];
    }
  }

  // Check if all todos are complete - auto-close session issue
  const allComplete = todos.every(
    (t) => t.status === "completed" || t.status === "cancelled"
  );
  if (allComplete && todos.length > 0) {
    await closeSessionIssue($, sessionIssueID, todos);
  }

  await saveMapping(mapping);
}

/**
 * Create a new beads issue for a todo
 */
async function createBeadsIssue(
  $: BunShell,
  sessionIssueID: string,
  todo: TodoItem
): Promise<string> {
  const priority = PRIORITY_TO_BEADS[todo.priority] ?? 2;
  const notes = `OpenCode todo ID: ${todo.id}`;

  try {
    const result = await $`bd create ${todo.content} -t task -p ${priority} --parent ${sessionIssueID} -d ${notes} --json`.json();

    // If todo is already in_progress, update status
    if (todo.status === "in_progress") {
      await $`bd update ${result.id} --status in_progress --json`.quiet();
    } else if (todo.status === "completed" || todo.status === "cancelled") {
      const reason =
        todo.status === "cancelled" ? "Cancelled in OpenCode" : "Completed";
      await $`bd close ${result.id} --reason ${reason} --json`.quiet();
    }

    return result.id;
  } catch (error) {
    throw new Error(`Failed to create beads issue for todo ${todo.id}: ${error}`);
  }
}

/**
 * Update an existing beads issue to match todo state
 */
async function updateBeadsIssue(
  $: BunShell,
  beadsID: string,
  todo: TodoItem
): Promise<void> {
  const beadsStatus = STATUS_TO_BEADS[todo.status];

  try {
    if (beadsStatus === "closed") {
      const reason =
        todo.status === "cancelled" ? "Cancelled in OpenCode" : "Completed";
      await $`bd close ${beadsID} --reason ${reason} --json`.quiet();
    } else {
      await $`bd update ${beadsID} --status ${beadsStatus} --json`.quiet();
    }
  } catch {
    // Issue might already be in the desired state
  }
}

/**
 * Close the session issue with a summary
 */
async function closeSessionIssue(
  $: BunShell,
  sessionIssueID: string,
  todos: TodoItem[]
): Promise<void> {
  const completed = todos.filter((t) => t.status === "completed").length;
  const cancelled = todos.filter((t) => t.status === "cancelled").length;
  const summary = `Session complete: ${completed} completed, ${cancelled} cancelled`;

  try {
    // Add summary to notes
    await $`bd update ${sessionIssueID} --notes ${summary} --json`.quiet();
    await $`bd close ${sessionIssueID} --reason ${summary} --json`.quiet();
  } catch {
    // Session might already be closed
  }
}

// =============================================================================
// Read Todos from Beads
// =============================================================================

/**
 * Read todos from beads for a session
 *
 * Used by todoread override to return beads state as source of truth.
 */
export async function readTodosFromBeads(
  $: BunShell,
  sessionID: string
): Promise<TodoItem[]> {
  const mapping = await loadMapping();
  const sessionIssueID = mapping.sessions[sessionID];

  if (!sessionIssueID) {
    // No session issue yet - return empty list
    return [];
  }

  const todoMap = mapping.todos[sessionID] || {};
  const todos: TodoItem[] = [];

  for (const [todoID, beadsID] of Object.entries(todoMap)) {
    try {
      const result = await $`bd show ${beadsID} --json`.json();
      if (result && result.id) {
        todos.push(beadsIssueToTodo(todoID, result));
      }
    } catch {
      // Issue might have been deleted
    }
  }

  return todos;
}

/**
 * Convert a beads issue back to a todo item
 */
function beadsIssueToTodo(todoID: string, issue: BeadsIssue): TodoItem {
  let status: TodoItem["status"] = "pending";
  if (issue.status === "in_progress") {
    status = "in_progress";
  } else if (issue.status === "closed") {
    // Check notes for cancelled vs completed
    status = issue.notes?.includes("Cancelled") ? "cancelled" : "completed";
  }

  return {
    id: todoID,
    content: issue.title,
    status,
    priority: PRIORITY_FROM_BEADS[issue.priority] ?? "medium",
  };
}


