// tests/cdn.spec.js — GROUP 10: Static/CDN sanity checks
//
// 10.1 No LOCAL font-awesome.js may load on any portal — Font Awesome
// must come from the CDN (cdnjs.cloudflare.com), never a local/self-hosted
// copy that can go stale or 404.

import { test, expect } from '@playwright/test';
import { loginAs, isEnvConfigured } from './helpers/auth.js';
import { installCdnRequestCollector } from './helpers/expectations.js';

test('10.1 no local font-awesome.js loads; at least one cdnjs request is made', async ({ page }) => {
  test.skip(!isEnvConfigured('admin'), 'no admin fixture — skipping CDN sanity check');

  const requested = [];
  let localFontAwesome = [];
  page.on('request', (req) => {
    const url = req.url();
    requested.push(url);
    if (/font-awesome\.js|fontawesome\.js/i.test(url)) {
      localFontAwesome.push(url);
    }
  });

  await loginAs(page, 'admin');
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  // No self-hosted/local font-awesome.js anywhere.
  expect(
    localFontAwesome.length,
    `a local font-awesome.js/fontawesome.js was requested: ${localFontAwesome.join(', ')}`,
  ).toBe(0);

  // Font Awesome must come from the CDN.
  const cdnjs = requested.filter((u) => /cdnjs\.cloudflare\.com/.test(u));
  expect(
    cdnjs.length,
    'no request was made to cdnjs.cloudflare.com — Font Awesome (or another dep) may not be loading from CDN',
  ).toBeGreaterThan(0);

  // Sanity: at least one of those cdnjs assets is the FA css bundle.
  const faCdn = requested.filter(
    (u) => /cdnjs\.cloudflare\.com/.test(u) && /font-?awesome|fa-/.test(u),
  );
  expect(
    faCdn.length,
    'expected a Font Awesome asset via cdnjs.cloudflare.com; local copy may be in use',
  ).toBeGreaterThan(0);
});

test('10.1b no local font-awesome.js on teacher, parent, student portals', async ({ page }) => {
  test.skip(!isEnvConfigured('admin'), 'no fixture — skipping multi-portal CDN check');

  const PORTALS = [
    ['teacher', '/teacher'],
    ['parent', '/parent'],
    ['student', '/student'],
  ];
  for (const [role, route] of PORTALS) {
    const localFA = [];
    page.on('request', (req) => {
      if (/font-awesome\.js|fontawesome\.js/i.test(req.url())) localFA.push(req.url());
    });
    await loginAs(page, role);
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(
      localFA.length,
      `local font-awesome.js loaded on ${route}: ${localFA.join(', ')}`,
    ).toBe(0);
  }
});
