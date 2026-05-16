import { defineConfig, devices } from "@playwright/test";

const liveAudioFixturePath = process.env.LIVE_AUDIO_FIXTURE_PATH ?? "/tmp/alpine-fieldops-live-audio.wav";

export default defineConfig({
  testDir: "./tests/live-audio",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["microphone"]
  },
  projects: [
    {
      name: "chromium-live-audio",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-audio-capture=${liveAudioFixturePath}`
          ]
        }
      }
    }
  ],
  webServer: [
    {
      command: "npm run smoke:api",
      url: "http://127.0.0.1:8788/health",
      reuseExistingServer: false,
      timeout: 20_000
    },
    {
      command: "npm run smoke:web",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      timeout: 20_000
    }
  ]
});
