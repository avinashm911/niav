// Minimal lint gate: recommended-rules only on implemented sources.
// Apps/mobile screens (*.tsx, native modules not installed) are excluded
// until the Expo toolchain lands; lib/ (pure TS) is linted.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "apps/mobile/app/**", "apps/mobile/App.tsx"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
);
