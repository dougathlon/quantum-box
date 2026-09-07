import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env["QUANTUM_BOX_E2E_PORT"] ?? "4390";
if (!/^[1-9]\d*$/.test(e2ePort) || Number(e2ePort) > 65_535) {
  throw new Error(
    `QUANTUM_BOX_E2E_PORT must be an integer port from 1 to 65535; received ${JSON.stringify(e2ePort)}.`,
  );
}
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: e2eBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "desktop-1280x720",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "desktop-1920x1080",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "narrow-434x720",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 434, height: 720 },
      },
    },
  ],
});
