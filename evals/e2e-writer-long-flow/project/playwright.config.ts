import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const required = ['BASE_URL'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0 && !process.argv.includes('--list')) {
  throw new Error(`Missing in .env: ${missing.join(', ')}. See .env.example.`);
}

const apiDir = path.join(__dirname, 'tests/api');
const apiDomains = fs
  .readdirSync(apiDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
// Folders whose tests need no login: they must stay green when the setup fails.
// A domain whose tests use only `api` (no token) goes here too, so a failed login does not stop it.
const noLogin = new Set(['health', 'auth']);
const utilsDir = path.join(__dirname, 'src/utils');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // `results.json` is what `pw-failure-triage` reads when a run goes red.
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    // The trailing slash keeps a path in BASE_URL (https://host/api/v1) when requests are resolved.
    baseURL: process.env.BASE_URL?.replace(/\/*$/, '/'),
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testDir: './tests/_setup', testMatch: /.*\.setup\.ts/ },
    ...apiDomains.map((domain) => ({
      name: `api-${domain}`,
      testDir: `./tests/api/${domain}`,
      dependencies: noLogin.has(domain) ? [] : ['setup'],
    })),
    ...(fs.existsSync(path.join(__dirname, 'tests/e2e'))
      ? [
          {
            name: 'e2e',
            testDir: './tests/e2e',
            use: { ...devices['Desktop Chrome'] },
            // No test takes `shared<Role>App` yet, so nothing needs the setup project.
            dependencies: [],
          },
        ]
      : []),
    // Unit tests of the pure functions in src/utils/, next to the code (`*.test.ts`). No browser, no API.
    ...(fs.existsSync(utilsDir) ? [{ name: 'unit', testDir: './src/utils', testMatch: /.*\.test\.ts/ }] : []),
  ],
});
