import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    // Permite apontar para um Chromium já instalado (ex.: sandbox com PLAYWRIGHT_CHROMIUM_PATH)
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "iphone-375", use: { ...devices["iPhone 13 Mini"], defaultBrowserType: "chromium", viewport: { width: 375, height: 812 } } },
    { name: "android-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "E2E_TEST_LOGIN=1 npm run start -- -p 3000",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
