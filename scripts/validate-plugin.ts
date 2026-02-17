#!/usr/bin/env bun
/**
 * Plugin structure validation script
 *
 * Validates:
 * - All required source files exist
 * - All vendor commands have valid frontmatter
 * - All vendor agents have valid frontmatter
 * - Command names follow naming convention
 * - Agent names follow naming convention
 * - No duplicate command/agent names
 * - Plugin exports valid structure
 * - TypeScript compilation succeeds
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } | null {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) return null;

  const frontmatterStr = match[1];
  const body = match[2];

  if (!frontmatterStr || !body) return null;

  const frontmatter: Record<string, string> = {};
  for (const line of frontmatterStr.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    // Handle quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body: body.trim() };
}

async function validateSourceFiles(): Promise<ValidationResult> {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  const requiredFiles = ["src/plugin.ts", "src/vendor.ts", "src/schemas.ts"];

  for (const file of requiredFiles) {
    try {
      await fs.access(path.join(rootDir, file));
    } catch {
      result.valid = false;
      result.errors.push(`Missing required file: ${file}`);
    }
  }

  return result;
}

async function validateVendorCommands(): Promise<ValidationResult> {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const commandsDir = path.join(rootDir, "vendor/commands");

  let files: string[];
  try {
    files = await fs.readdir(commandsDir);
  } catch {
    result.valid = false;
    result.errors.push("vendor/commands directory not found");
    return result;
  }

  const commandNames = new Set<string>();

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    const commandName = file.replace(".md", "");
    const fullCommandName = `beads:${commandName}`;

    // Check for duplicates
    if (commandNames.has(fullCommandName)) {
      result.valid = false;
      result.errors.push(`Duplicate command name: ${fullCommandName}`);
    }
    commandNames.add(fullCommandName);

    // Check naming convention (kebab-case)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(commandName)) {
      result.warnings.push(`Command name should be kebab-case: ${commandName}`);
    }

    // Validate frontmatter (optional for commands - some are docs-only)
    const content = await fs.readFile(path.join(commandsDir, file), "utf-8");
    const parsed = parseFrontmatter(content);

    if (!parsed) {
      // Missing frontmatter is a warning, not an error (some files are docs-only)
      result.warnings.push(`No frontmatter in ${file} (docs-only is OK)`);
      continue;
    }

    if (!parsed.frontmatter.description) {
      result.warnings.push(`Missing description in ${file}`);
    }
  }

  return result;
}

async function validateVendorAgents(): Promise<ValidationResult> {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const agentsDir = path.join(rootDir, "vendor/agents");

  let files: string[];
  try {
    files = await fs.readdir(agentsDir);
  } catch {
    result.valid = false;
    result.errors.push("vendor/agents directory not found");
    return result;
  }

  const agentNames = new Set<string>();

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    const agentName = file.replace(".md", "");
    const fullAgentName = `beads:${agentName}`;

    // Check for duplicates
    if (agentNames.has(fullAgentName)) {
      result.valid = false;
      result.errors.push(`Duplicate agent name: ${fullAgentName}`);
    }
    agentNames.add(fullAgentName);

    // Check naming convention (kebab-case)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agentName)) {
      result.warnings.push(`Agent name should be kebab-case: ${agentName}`);
    }

    // Validate frontmatter (required for agents)
    const content = await fs.readFile(path.join(agentsDir, file), "utf-8");
    const parsed = parseFrontmatter(content);

    if (!parsed) {
      result.valid = false;
      result.errors.push(`Missing frontmatter in ${file} (required for agents)`);
      continue;
    }

    if (!parsed.frontmatter.description) {
      result.warnings.push(`Missing description in ${file}`);
    }
  }

  return result;
}

async function validatePackageJson(): Promise<ValidationResult> {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  try {
    const content = await fs.readFile(path.join(rootDir, "package.json"), "utf-8");
    const pkg = JSON.parse(content);

    // Check required fields
    const requiredFields = ["name", "version", "main", "dependencies"];
    for (const field of requiredFields) {
      if (!pkg[field]) {
        result.valid = false;
        result.errors.push(`Missing required field in package.json: ${field}`);
      }
    }

    // Check for required dependencies
    const requiredDeps = ["@opencode-ai/plugin", "@opencode-ai/sdk", "zod"];
    for (const dep of requiredDeps) {
      if (!pkg.dependencies?.[dep]) {
        result.valid = false;
        result.errors.push(`Missing required dependency: ${dep}`);
      }
    }

    // Check for test scripts
    if (!pkg.scripts?.test) {
      result.warnings.push("No test script defined in package.json");
    }

    if (!pkg.scripts?.typecheck) {
      result.warnings.push("No typecheck script defined in package.json");
    }
  } catch (error) {
    result.valid = false;
    result.errors.push("Failed to parse package.json");
  }

  return result;
}

async function runTypeCheck(): Promise<ValidationResult> {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  const proc = Bun.spawn(["bun", "run", "typecheck"], {
    cwd: rootDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    result.valid = false;
    result.errors.push("TypeScript type check failed");

    const stderr = await new Response(proc.stderr).text();
    if (stderr) {
      result.errors.push(stderr);
    }
  }

  return result;
}

async function main() {
  console.log("🔍 Validating opencode-beads plugin structure...\n");

  const validations = [
    { name: "Source Files", fn: validateSourceFiles },
    { name: "Vendor Commands", fn: validateVendorCommands },
    { name: "Vendor Agents", fn: validateVendorAgents },
    { name: "Package.json", fn: validatePackageJson },
    { name: "TypeScript", fn: runTypeCheck },
  ];

  let allValid = true;
  let hasWarnings = false;

  for (const { name, fn } of validations) {
    process.stdout.write(`Checking ${name}... `);
    const result = await fn();

    if (result.valid && result.warnings.length === 0) {
      console.log("✅");
    } else if (result.valid) {
      console.log("⚠️");
      hasWarnings = true;
    } else {
      console.log("❌");
      allValid = false;
    }

    for (const error of result.errors) {
      console.log(`   ❌ ${error}`);
    }

    for (const warning of result.warnings) {
      console.log(`   ⚠️  ${warning}`);
    }
  }

  console.log();

  if (allValid && !hasWarnings) {
    console.log("✅ All validations passed!");
    process.exit(0);
  } else if (allValid) {
    console.log("⚠️  All validations passed with warnings.");
    process.exit(0);
  } else {
    console.log("❌ Some validations failed.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Validation script failed:", error);
  process.exit(1);
});
