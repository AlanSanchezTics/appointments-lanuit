import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: ["node_modules/**", ".next/**", "coverage/**", "playwright-report/**", "next-env.d.ts"],
  },
  {
    files: [
      "app/admin/**/*.tsx",
      "components/admin/**/*.tsx",
      "hooks/admin/**/*.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXText[value=/[A-Za-zÀ-ÿ]/]",
          message:
            "Admin UI text must come from react-i18next translation keys (no inline literal text).",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(label|placeholder|title|aria-label|alt)$/] > Literal[value=/[A-Za-zÀ-ÿ]/]",
          message:
            "Admin UI attribute text must use translation keys (allowlist only for technical attributes).",
        },
      ],
    },
  },
];

export default config;
