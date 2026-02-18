import js from "@eslint/js";
import ts from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    rules: {
      // Allow any types in plugin input/output handling
      "@typescript-eslint/no-explicit-any": "off",
      // Allow non-null assertions for known-safe cases
      "@typescript-eslint/no-non-null-assertion": "off",
      // Allow underscore-prefixed unused variables (intentionally unused)
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    },
  },
  prettier
);
