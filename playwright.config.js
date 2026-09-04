// playwright.config.js
// End-to-end test configuration for Pulse Link SMS.
//
// Loads .env.test (gitignored) via dotenv. All secrets/credentials are
// read from that file — never committed.
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.test first. dotenv does NOT override already-set env vars,
// so an explicitly exported env takes precedence.
dotenv.config({ path: path.resolve(__dirname, '.env.test'), override: false });

export default defineConfig({
  testDir: './tests',
  // Tests run sequentially (1 worker) — auth state and Supabase writes
  // must not race each other across the four roles.
  workers: 1,
  fullyParallel: false,

  // Give CBT engine, uploads and AI calls room to breathe.
  timeout: 20000,
  expect: {
    timeout: 10000,
  },

  // baseURL is set from BASE_URL (Netlify) or local dev server.
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  globalSetup: './tests/global-setup.js',
  globalTeardown: './tests/global-teardown.js',

  reporter: [['html', { open: 'never' }], ['list']],
});
