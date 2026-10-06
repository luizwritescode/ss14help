import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["src/generated/**"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  { files: ["scripts/**"], languageOptions: { globals: globals.node } },
);
