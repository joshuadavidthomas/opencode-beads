#!/usr/bin/env bun
import { execSync } from "node:child_process";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

async function validatePlugin(): Promise<ValidationResult> {
  const errors: string[] = [];

  // Check if beads CLI is available
  try {
    execSync("bd --version", { encoding: "utf-8", stdio: "pipe" });
  } catch {
    errors.push(
      "Beads CLI not found. Install: curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash",
    );
  }

    // Check if plugin can be imported (using dynamic import for ESM compatibility)
  try {
    const plugin = await import("../src/plugin.ts");
    // Check for named export BeadsPlugin (not default export)
    if (!plugin.BeadsPlugin) {
      errors.push("Plugin does not export BeadsPlugin");
    } else if (typeof plugin.BeadsPlugin !== "function") {
      errors.push(
        `Plugin BeadsPlugin export is not a function (got: ${typeof plugin.BeadsPlugin})`,
      );
    }
  } catch (error) {
    errors.push(`Plugin import failed: ${error}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Run validation
validatePlugin()
  .then((result) => {
    if (result.valid) {
      console.log("✅ Plugin validation passed");
      process.exit(0);
    } else {
      console.error("❌ Plugin validation failed:");
      for (const error of result.errors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(`❌ Validation error: ${error}`);
    process.exit(1);
  });
