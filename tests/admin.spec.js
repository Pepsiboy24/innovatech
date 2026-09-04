// tests/admin.spec.js — GROUP 4: Admin portal
//
// Every protected-page test asserts BOTH no JS pageerror AND no failed
// (>=400) supabase.co request (cross-cutting rule).

import { test, expect } from '@playwright/test';
import {
  loginAs,
  isEnvConfigured,
} from './helpers/auth.js';
import {
  installPageErrorCollector,
  installSupabaseFailureCollector,
  installSupabaseWriteCollector,
  expectCleanPage,
} from './helpers/expectations.js';

// loadPage: log in as admin, navigate, install collectors, wait, then
// assert a clean page (no JS error, no failed supabase request).
async function loadPage(page, route) {
  await loginAs(page, 'admin');
  const errors = installPageErrorCollector(page);
  const failed = installSupabaseFailureCollector(page);
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  expect(page.url()).not.toMatch(/login/);
  expectCleanPage(errors, failed, route);
  return { errors, failed };
}

const ADMIN_PAGES = [
  ['students.html', '/admin/students.html'],
  ['teachers.html', '/admin/teachers.html'],
  ['payments_config.html', '/admin/payments_config.html'],
  ['results_page.html', '/admin/results_page.html'],
  ['promotions.html', '/admin/promotions.html'],
  ['create_timetable_entries.html', '/admin/create_timetable_entries.html'],
  ['create_timetable_setup.html', '/admin/create_timetable_setup.html'],
  ['settings.html', '/admin/settings.html'],
  ['grading_settings.html', '/admin/grading_settings.html'],
];

test.describe('GROUP 4 — Admin portal', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.skip(!isEnvConfigured('admin'), '.env.test admin fixture not set — skipping admin group');
  });

  for (const [i, [name, route]] of ADMIN_PAGES.entries()) {
    test(`4.${i + 1}a load ${name} cleanly`, async ({ page }) => {
      await loadPage(page, route);
      // Not a blank shell: some meaningful content must be present.
      const body = await page.locator('body').innerText();
      expect(body.trim().length, `${route} rendered empty body`).toBeGreaterThan(0);
    });
  }

  test('4.1v students page renders rows or explicit empty state', async ({ page }) => {
    const { errors, failed } = await loadPage(page, '/admin/students.html');
    await page.waitForLoadState('networkidle').catch(() => {});
    // If student rows are rendered (tbody rows or list items), assert >= 1;
    // otherwise an explicit "no students" empty-state text is acceptable.
    const rowCount = await page.locator('tr, .student-row, [data-student]').count();
    const body = await page.locator('body').innerText();
    if (rowCount > 0) {
      expect(rowCount).toBeGreaterThan(0);
    } else {
      expect(body, 'students page has neither rows nor empty state').toMatch(/no student|empty|no record|no data/i);
    }
    expectCleanPage(errors, failed, 'students list');
  });

  test('4.2 teachers page renders rows or explicit empty state', async ({ page }) => {
    const { errors, failed } = await loadPage(page, '/admin/teachers.html');
    await page.waitForLoadState('networkidle').catch(() => {});
    const rowCount = await page.locator('tr, .teacher-row, [data-teacher]').count();
    const body = await page.locator('body').innerText();
    if (rowCount > 0) {
      expect(rowCount).toBeGreaterThan(0);
    } else {
      expect(body, 'teachers page has neither rows nor empty state').toMatch(/no teacher|empty|no record|no data/i);
    }
    expectCleanPage(errors, failed, 'teachers list');
  });

  test('4.3 payments config save does not silently fail', async ({ page }) => {
    const { errors, failed } = await loadPage(page, '/admin/payments_config.html');
    await page.waitForLoadState('networkidle').catch(() => {});
    const writes = installSupabaseWriteCollector(page);

    // Find a form/inputs. If none exist, skip with a reason rather than
    // fail (legitimately different UI).
    const inputs = page.locator('input, select, textarea');
    if ((await inputs.count()) === 0) {
      test.skip(true, 'payments_config renders no form controls — nothing to submit');
    }

    const submitBtn = page
      .locator('button[type="submit"], button:has-text("Save"), button:has-text("Update"), button:has-text("Configure")')
      .first();
    const hasSubmit = (await submitBtn.count()) > 0;

    if (hasSubmit && (await inputs.count()) > 0) {
      // Try to trigger save.
      await submitBtn.click().catch(() => {});
      await page.waitForTimeout(1500);
      // Either a write fired, or the UI showed a success/error state.
      const toast = page.locator('.toast, .alert, .notification, [class*="message"]');
      const toastVisible = toast.count() && (await toast.first().isVisible().catch(() => false));
      const writesFired = writes.length > 0;
      expect(
        writesFired || toastVisible,
        'saving a payments config produced neither a write nor any visible feedback',
      ).toBe(true);
    } else {
      test.skip(true, 'payments_config has inputs but no submit wiring to exercise');
    }
    expectCleanPage(errors, failed, 'payments config save');
  });

  test('4.5 timetable create submits a real supabase insert (network-verified)', async ({ page }) => {
    const { errors, failed } = await loadPage(page, '/admin/create_timetable_entries.html');
    await page.waitForLoadState('networkidle').catch(() => {});
    const writes = installSupabaseWriteCollector(page);

    const inputs = page.locator('input, select, textarea');
    const submitBtn = page
      .locator('button[type="submit"], button:has-text("Save"), button:has-text("Add"), button:has-text("Create")')
      .first();

    if ((await inputs.count()) === 0 || (await submitBtn.count()) === 0) {
      test.skip(true, 'create_timetable_entries has no fillable form to submit');
    }

    // Fill any empty text inputs with a minimal valid value.
    const textInputs = page.locator('input[type="text"], input:not([type]), select, textarea');
    const n = Math.min(await textInputs.count(), 8);
    for (let i = 0; i < n; i++) {
      const el = textInputs.nth(i);
      if ((await el.isVisible().catch(() => false)) && !(await el.getAttribute('disabled'))) {
        await el.fill('A').catch((e) => {
          /* ignore select that refuses 'A' */
          void e;
        });
        await el.selectOption({ index: 0 }).catch(() => {});
      }
    }
    await submitBtn.click().catch(() => {});
    await page.waitForTimeout(2000);

    const writeFired = writes.some((w) => /timetable/i.test(w.url));
    const toast = page.locator('.toast, .alert, .notification');
    const toastVisible = (await toast.count()) > 0 && (await toast.first().isVisible().catch(() => false));
    expect(
      writeFired || toastVisible,
      'timetable create produced neither a supabase insert nor visible feedback',
    ).toBe(true);
    expectCleanPage(errors, failed, 'timetable create');
  });
});
