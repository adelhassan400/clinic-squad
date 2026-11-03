import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: "rm -f .data/clinicsquad-e2e.sqlite && DATABASE_PROVIDER=sqlite PORT=8080 SQLITE_DATABASE_PATH=$PWD/.data/clinicsquad-e2e.sqlite node artifacts/api-server/dist/index.mjs",
          url: "http://127.0.0.1:8080/api/healthz",
          reuseExistingServer: false,
          timeout: 30_000,
        },
        {
          command: "PORT=5000 BASE_PATH=/ pnpm --filter @workspace/clinic-squad run serve",
          url: "http://127.0.0.1:5000",
          reuseExistingServer: false,
          timeout: 30_000,
        },
      ],
});
