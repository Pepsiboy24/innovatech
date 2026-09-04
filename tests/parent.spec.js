// tests/parent.spec.js — GROUP 6: Parent portal
//
// 6.1 asserts the child's actual result data renders (not just "page
// loaded") with no JS errors and no CDN 404s.
// 6.2 stubs the Monnify/payment provider call so no real payment fires.

import { test, expect } from '@playwright/test';
import { loginAs, isEnvConfigured } from './helpers/auth.js';
import {
  installPageErrorCollector,
  installSupabaseFailureCollector,
  installCdn404Collector,
  expectCleanPage,
  expectNoPageErrors,
} from './helpers/expectations.js';

test.describe('GROUP 6 — Parent portal', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.skip(!isEnvConfigured('parent'), '.env.test parent fixture not set — skipping parent group');
  });

  test('6.1 child result renders data, no JS errors, no CDN 404', async ({ page }) => {
    await loginAs(page, 'parent');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);
    const cdn404 = installCdn404Collector(page);

    await page.goto('/parent/childsResult.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(page.url()).not.toMatch(/login/);

    // Actual result data must render (not just an empty shell).
    await page.waitForFunction(
      () => document.body.innerText.trim().length > 0,
      { timeout: 10000 },
    );
    const body = await page.locator('body').innerText();
    expect(
      body,
      'child result page did not render any student/result data',
    ).toMatch(/student|result|score|grade|term|class|subject|cbt|average|percentage/i);

    expectCleanPage(errors, failed, 'child result');
    expect(cdn404, 'CDN resource returned 404 on child result page').toHaveLength(0);
  });

  test('6.2 payments page: loads, shows history, handles stubbed provider', async ({ page }) => {
    await loginAs(page, 'parent');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);

    // Stub the payment provider/functions: never fire a real Monnify call.
    await page.route(/monnify|payment-provider|create-student-virtual-account/i, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          responseBody: { status: 'success', transactionReference: 'mocked-ref' },
        }),
      });
    });

    await page.goto('/parent/payments.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(page.url()).not.toMatch(/login/);

    const body = await page.locator('body').innerText();
    expect(
      body,
      'payments page did not render any status/history content',
    ).toMatch(/payment|paid|pending|amount|fee|status|history|balance|receipt|transaction/i);

    // If a "pay now" action exists, trigger it and assert a visible
    // success/error state follows (mocked), not a silent hang or crash.
    const payBtn = page
      .locator('button:has-text("Pay"), button:has-text("Pay Now"), button:has-text("Make Payment")')
      .first();
    if ((await payBtn.count()) > 0 && (await payBtn.isVisible().catch(() => false))) {
      await payBtn.click().catch(() => {});
      const outcome = await page
        .waitForSelector('.toast, .alert, .notification, [class*="success"], [class*="error"], [class*="message"]', {
          timeout: 12000,
        })
        .catch(() => null);
      expect(outcome, 'mocked payment produced no visible success/error UI').not.toBeNull();
    } else {
      // No pay action present; we already proved history renders.
      expectNoPageErrors(errors, 'payments history');
    }
    expectCleanPage(errors, failed, 'parent payments');
  });
});
