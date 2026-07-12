import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app/src"),
      "@engine": path.resolve(__dirname, "./engine/src"),
      "@database": path.resolve(__dirname, "./database"),
    },
  },
  test: {
    environment: "node",
    include: ["app/src/lib/__tests__/**/*.test.ts"],
  },
});
