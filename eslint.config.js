// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.js", "**/*.ts"],
    rules: {
      // Allow explicit any in plugin code (interfacing with OpenCode SDK)
      "@typescript-eslint/no-explicit-any": "off",
      // Allow require in config files
      "@typescript-eslint/no-require-imports": "off",
      // Allow using Object.prototype methods
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Allow async functions without await (for mock functions)
      "@typescript-eslint/require-await": "off",
      // Allow catch with any type
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
      // Allow dot notation for bracket notation access
      "@typescript-eslint/dot-notation": "off",
      // Allow unbound methods (for test mocks)
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    files: ["test/**/*.{js,ts}"],
    rules: {
      // Tests can use non-null assertions
      "@typescript-eslint/no-non-null-assertion": "off",
      // Tests can have unused variables
      "@typescript-eslint/no-unused-vars": "off",
      // Allow unsafe assignments in tests
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  {
    files: ["scripts/**/*.{js,ts}"],
    rules: {
      // Scripts can have looser type checking
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  prettierConfig
);
