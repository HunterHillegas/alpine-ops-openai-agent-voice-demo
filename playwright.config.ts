import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "npm run smoke:api",
      url: "http://127.0.0.1:8788/health",
      reuseExistingServer: true,
      timeout: 20_000
    },
    {
      command: "npm run smoke:web",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: true,
      timeout: 20_000
    }
  ]
});
