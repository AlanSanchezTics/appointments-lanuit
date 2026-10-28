import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Each jsdom worker costs hundreds of MB; cap them so the full suite cannot exhaust RAM.
    maxWorkers: 2,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
