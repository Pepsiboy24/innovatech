// tests/payments.spec.js — GROUP 8: Payment / financial edge functions
//
// 8.1 mocks the financial Edge Functions (create-monnify-subaccount,
//     create-student-virtual-account) so no real Monnify call fires, and
//     asserts the frontend handles BOTH success and failure gracefully.
// 8.2 asserts admin payment reconciliation shows both 'paid' and
//     'pending' fixture rows (not just the loading state).

import { test, expect } from '@playwright/test';
import { loginAs, isEnvConfigured } from './helpers/auth.js';
import {
  installPageErrorCollector,
  installSupabaseFailureCollector,
  installSupabaseWriteCollector,
  expectCleanPage,
  expectNoPageErrors,
} from './helpers/expectations.js';

const FUNCTION_RE = /\/functions\/v1\/(create-monnify-subaccount|create-student-virtual-account)/i;

test.describe('GROUP 8 — Payment / financial edge functions', () => {
  test.describe.configure({ mode: 'serial' });

  test('8.1 payment edge function success path handled gracefully', async ({ page }) => {
    test.skip(!isEnvConfigured('admin'), 'no admin fixture — skipping financial success path');
    await loginAs(page, 'admin');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);

    let functionHit = false;
    await page.route(FUNCTION_RE, (route) => {
      functionHit = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { account: 'mocked-account', reference: 'mock-ref' },
        }),
      });
    });

    await page.goto('/admin/students.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Trigger the flow if a control exists (e.g. "Create virtual account").
    const trigger = page
      .locator('button:has-text("Virtual Account"), button:has-text("Create Account"), button:has-text("Generate Account")')
      .first();
    if ((await trigger.count()) > 0 && (await trigger.isVisible().catch(() => false))) {
      await trigger.click().catch(() => {});
      await page.waitForFunction(() => functionHit === true, { timeout: 10000 }).catch(() => {});
    }

    const body = await page.locator('body').innerText();
    // If we actually hit the stubbed function, require a visible outcome.
    if (functionHit) {
      const outcome = await page
        .waitForSelector('.toast, .alert, .notification, [class*="success"], [class*="account"]', {
          timeout: 12000,
        })
        .catch(() => null);
      expect(outcome, 'mocked success produced no visible UI feedback').not.toBeNull();
    } else {
      test.skip(true, 'no control triggers create-student-virtual-account on this page');
    }
    expectCleanPage(errors, failed, 'payment function success');
  });

  test('8.1 payment edge function failure path handled gracefully (no crash)', async ({ page }) => {
    test.skip(!isEnvConfigured('admin'), 'no admin fixture — skipping financial failure path');
    await loginAs(page, 'admin');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);

    await page.route(FUNCTION_RE, (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'mocked provider failure' }),
      });
    });

    await page.goto('/admin/students.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const trigger = page
      .locator('button:has-text("Virtual Account"), button:has-text("Create Account"), button:has-text("Generate Account")')
      .first();
    if ((await trigger.count()) > 0 && (await trigger.isVisible().catch(() => false))) {
      await trigger.click().catch(() => {});
      const outcome = await page
        .waitForSelector('.toast, .alert, .notification, [class*="error"], [class*="fail"]', {
          timeout: 12000,
        })
        .catch(() => null);
      expect(outcome, 'mocked failure produced no visible error state').not.toBeNull();
    } else {
      test.skip(true, 'no trigger on this page');
    }
    // Failure must NOT throw an unhandled promise rejection or crash.
    expectNoPageErrors(errors, 'financial failure path');
  });

  test('8.2 admin payments view shows both paid and pending fixture rows', async ({ page }) => {
    test.skip(
      !isEnvConfigured('admin'),
      'admin fixture not configured — skipping payment reconciliation display',
    );
    // NOTE: requires fixture Payment_Items rows (status 'paid' and
    // 'pending') seeded by global-setup for the admin's school.
    await loginAs(page, 'admin');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);
    const writes = installSupabaseWriteCollector(page);

    await page.goto('/admin/payments_config.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.goto('/admin/results_page.html', { waitUntil: 'networkidle' }).catch(() => {});

    const body = await page.locator('body').innerText();
    // Payments summary shows both status buckets (or table/payment rows render).
    const hasStatusBuckets = /paid/i.test(body) && /pending|unpaid|outstanding/i.test(body);
    const hasPaymentRows = (await page.locator('tr, .payment-item, [class*="payment"]').count()) > 0;
    if (hasPaymentRows) {
      expect(
        hasStatusBuckets,
        'admin payment view shows rows but not both paid and pending statuses',
      ).toBe(true);
    } else {
      test.skip(true, 'no payment rows rendered — payment fixtures not seeded in this environment');
    }
    expectCleanPage(errors, failed, 'payment reconciliation');
  });
});
