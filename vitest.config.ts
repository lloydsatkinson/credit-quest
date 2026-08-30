import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
