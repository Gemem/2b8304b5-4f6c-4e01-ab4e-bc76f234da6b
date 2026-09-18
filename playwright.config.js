const { defineConfig } = require('@playwright/test');

/* One worker on a single shared page: the design package is 20 MB of PBR models and two HDRIs, and
   the reviewer's container renders them on software GL, so the scene is loaded once and every wait
   is on a condition rather than the clock. */
module.exports = defineConfig({
  testDir: './tests',
  outputDir: 'node_modules/.playwright-artifacts',
  fullyParallel: false,
  workers: 1,
  timeout: 600000,
  expect: { timeout: 600000 },
  retries: 1,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 600000,
    navigationTimeout: 600000,
    launchOptions: {
      args: [
        '--no-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--disable-dev-shm-usage',
      ],
    },
  },
});