import { defineConfig, devices } from "@playwright/test";

const PORT = 3123;

/** UI acceptance scenarios (ROADMAP §3.9) against the production build: `pnpm build && pnpm e2e`. */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}`, colorScheme: "dark", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/upstream`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
