// tests/auth.spec.js — GROUP 1: Auth & Routing
//
// Covers unauthenticated redirects, per-role home landing, cross-role
// access blocking, tampered/expired token handling, and logout.
//
// NOTE: these tests hit a real Supabase backend and real Netlify route
// rewrites. They SKIP cleanly until .env.test is populated with real
// fixture credentials.

import { test, expect } from '@playwright/test';
import { loginAs, getProjectRef, isEnvConfigured } from './helpers/auth.js';
import { installPageErrorCollector, expectCleanPage } from './helpers/expectations.js';

const REF = getProjectRef();
const TOKEN_KEY = REF ? `sb-${REF}-auth-token` : 'sb-auth-token';
const PORTALS = ['/admin', '/teacher', '/parent', '/student'];

// Each role -> the portal home route it should land on, and a substring
// expected in the rendered page once logged in.
const ROLE_HOME = [
  ['admin', '/admin', /Dashboard|Admin/i],
  ['teacher', '/teacher', /Dashboard|Teacher|teachersPortal/i],
  ['parent', '/parent', /Dashboard|Parent|parentsPortal/i],
  ['student', '/student', /Dashboard|Student|studentPortal/i],
];

test.beforeEach(async ({ page }) => {
  // Fresh page per test -> clean localStorage -> no cross-test auth bleed.
  await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
});

// 1.1 — Unauthenticated users hitting any protected portal are sent to login.
for (const route of PORTALS) {
  test(`1.1 unauthenticated ${route} redirects to login`, async ({ page }) => {
    test.skip(!isEnvConfigured(), '.env.test not populated — skipping unauth redirect check');
    await page.goto(route);
    await page.waitForURL(/login/, { timeout: 15000 });
    expect(page.url()).toMatch(/login/);
  });
}

// 1.2 — Each role lands on its own portal home without a JS error.
for (const [role, route, headingRe] of ROLE_HOME) {
  test(`1.2 ${role} lands on ${route}`, async ({ page }) => {
    test.skip(!isEnvConfigured(role), `no ${role} fixture in .env.test — skipping`);
    const errors = installPageErrorCollector(page);
    await loginAs(page, role);
    await page.goto(route, { waitUntil: 'networkidle' });
    // Must NOT bounce back to login.
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).not.toMatch(/login/);
    // Page actually rendered portal content, not a blank redirect stub.
    const body = await page.locator('body').innerText();
    expect(body).not.toHaveLength(0);
    expect(body).toMatch(headingRe);
    expectCleanPage(errors, [], `${role} home`);
  });
}

// 1.3 — Cross-role access is blocked (every non-matching role/portal pair).
const CROSS_ROLE_PAIRS = [
  ['teacher', '/admin'],
  ['parent', '/admin'],
  ['student', '/admin'],
  ['parent', '/teacher'],
  ['student', '/teacher'],
  ['admin', '/teacher'],
  ['student', '/parent'],
  ['teacher', '/parent'],
  ['admin', '/parent'],
  ['parent', '/student'],
  ['teacher', '/student'],
  ['admin', '/student'],
];

for (const [role, forbidden] of CROSS_ROLE_PAIRS) {
  test(`1.3 ${role} cannot access ${forbidden}`, async ({ page }) => {
    test.skip(!isEnvConfigured(role), `no ${role} fixture in .env.test — skipping`);
    const errors = installPageErrorCollector(page);
    await loginAs(page, role);
    await page.goto(forbidden, { waitUntil: 'domcontentloaded' });

    let denied = false;
    await Promise.race([
      // Path A: app shows the "Access Denied" modal (authGuard overlay).
      page
        .waitForSelector('text=Access Denied', { timeout: 8000 })
        .then(() => {
          denied = true;
        }),
      // Path B: app redirects to login.
      page.waitForURL(/login/, { timeout: 8000 }).then(() => {
        denied = true;
      }),
    ]).catch(() => {});

    await page.waitForTimeout(300);
    expect(denied, `expected access denial for ${role} on ${forbidden}`).toBe(true);
    expectNoPageErrors(errors, `${role} blocked from ${forbidden}`);
  });
}

// 1.4 — Tampered/expired token must not render protected content.
test('1.4 garbage token redirects to login (no stale content)', async ({ page }) => {
  test.skip(!isEnvConfigured(), '.env.test not populated — skipping token-tamper check');

  await page.goto('/');
  const garbage = JSON.stringify({
    access_token: 'not.a.real.jwt',
    refresh_token: 'garbage-refresh',
    expires_at: Math.floor(Date.now() / 1000) - 3600,
    token_type: 'bearer',
    user: {},
  });
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, v),
    [TOKEN_KEY, garbage],
  );

  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/login/, { timeout: 15000 });
  expect(page.url()).toMatch(/login/);
});

// 1.5 — Logout clears the session: back/direct navigation re-requires login.
test('1.5 logout clears session (no back-button access)', async ({ page }) => {
  test.skip(!isEnvConfigured('admin'), 'no admin fixture in .env.test — skipping');
  const errors = installPageErrorCollector(page);
  await loginAs(page, 'admin');
  await page.goto('/admin', { waitUntil: 'networkidle' });
  expect(page.url()).not.toMatch(/login/);

  // Trigger logout via the supabase client sign-out, same as the app's
  // logout button handler would (destroys the local session).
  await page.evaluate(async () => {
    await window.supabase.auth.signOut();
    localStorage.clear();
  });

  // Direct URL revisit must not restore the authenticated dashboard.
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/login/, { timeout: 15000 });
  expect(page.url()).toMatch(/login/);
  expectNoPageErrors(errors, 'logout navigation');
});

// Local helper used by 1.3.
function expectNoPageErrors(errors, context) {
  if (errors.length > 0) {
    throw new Error(`JS pageerror(s) (${context}): ${errors.map((e) => e.message).join(' | ')}`);
  }
}
