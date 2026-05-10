import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  retries: 1,
  use: {
    baseURL: process.env.AUDIT_BASE_URL ?? "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  workers: 1,
});
