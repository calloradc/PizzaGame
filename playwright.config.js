import { defineConfig } from "@playwright/test";
import fs from "node:fs";

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  webServer: {
    command: "npm run build && python3 scripts/serve-test-build.py",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
