// tests/teacher.spec.js — GROUP 5: Teacher portal
//
// Emphasizes the "reject invalid + accept valid" pairing and verifies
// real Supabase writes via network interception (never trust the UI alone).

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

test.describe('GROUP 5 — Teacher portal', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.skip(!isEnvConfigured('teacher'), '.env.test teacher fixture not set — skipping teacher group');
  });

  test('5.1 invalid score is rejected AND no grade write fires', async ({ page }) => {
    await loginAs(page, 'teacher');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);
    const writes = installSupabaseWriteCollector(page);

    await page.goto('/teacher/upload_results.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const numberInput = page.locator('input[type="number"]').first();
    if ((await numberInput.count()) === 0) {
      test.skip(true, 'upload_results has no number input visible — different UI');
    }

    // INJECT out-of-range score.
    await numberInput.fill('999');
    const submit = page
      .locator('button[type="submit"], button:has-text("Submit"), button:has-text("Upload"), button:has-text("Save")')
      .first();
    await submit.click().catch(() => {});
    await page.waitForTimeout(1200);

    // (a) visible validation error must appear
    const body = await page.locator('body').innerText();
    expect(
      body,
      'out-of-range score did not surface any validation error text',
    ).toMatch(/invalid|out of range|must be|exceeds|above|too (high|large)|between|0.*100|max/i);

    // (b) no write hit a grade/score/result table
    const badWrites = writes.filter((w) => /grade|score|result/i.test(w.url));
    expect(
      badWrites.length,
      `SECURITY/CORRECTNESS: invalid score 999 still triggered ${badWrites.length} grade write(s)`,
    ).toBe(0);
    expectCleanPage(errors, failed, 'grade validation (reject path)');
  });

  test('5.1v valid score produces a real grade write + success state', async ({ page }) => {
    await loginAs(page, 'teacher');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);
    const writes = installSupabaseWriteCollector(page);

    await page.goto('/teacher/upload_results.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const numberInput = page.locator('input[type="number"]').first();
    if ((await numberInput.count()) === 0) {
      test.skip(true, 'upload_results has no number input visible — different UI');
    }
    const submit = page
      .locator('button[type="submit"], button:has-text("Submit"), button:has-text("Upload"), button:has-text("Save")')
      .first();
    if ((await submit.count()) === 0) {
      test.skip(true, 'upload_results has no submit control');
    }

    // A valid score must actually persist.
    await numberInput.fill('75');
    await submit.click().catch(() => {});
    await page.waitForTimeout(2000);

    const gradeWrites = writes.filter((w) => /grade|score|result/i.test(w.url));
    expect(
      gradeWrites.length,
      'valid score (75) did not trigger any grade/score/result write — happy path broken',
    ).toBeGreaterThan(0);
    expectCleanPage(errors, failed, 'grade validation (accept path)');
  });

  test('5.2 attendance mark + submit fires a real write', async ({ page }) => {
    await loginAs(page, 'teacher');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);
    const writes = installSupabaseWriteCollector(page);

    await page.goto('/teacher/attendance.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Mark the first present/absent toggle.
    const toggle = page
      .locator('input[type="checkbox"], input[type="radio"], select, button.present, button.absent, [class*="present"], [class*="absent"]')
      .first();
    if ((await toggle.count()) === 0) {
      test.skip(true, 'attendance has no markable control');
    }
    await toggle.click().catch((e) => {
      void e;
    });

    const submit = page
      .locator('button[type="submit"], button:has-text("Save"), button:has-text("Submit"), button:has-text("Mark")')
      .first();
    if ((await submit.count()) > 0) {
      await submit.click().catch(() => {});
    }
    await page.waitForTimeout(2000);

    const attWrites = writes.filter((w) => /attendance/i.test(w.url));
    expect(
      attWrites.length,
      'attendance mark did not fire a Supabase write to the attendance table',
    ).toBeGreaterThan(0);

    // Success state visible (toast/alert) OR network write is proof enough;
    // we already asserted the write, so only assert clean page here.
    expectCleanPage(errors, failed, 'attendance submit');
  });

  test('5.3 AI assistant accepts a message and shows a response/error state', async ({ page }) => {
    // EXERCISES supabase/functions/gemini-proxy end to end.
    // TODO(CI): if hitting the real model is undesirable in CI, stub
    // /functions/v1/gemini-proxy (and clever-responder) with page.route()
    // and assert the UI renders the stubbed reply instead.
    await loginAs(page, 'teacher');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);

    await page.goto('/teacher/ai_assistant.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const input = page
      .locator('textarea, input[type="text"], input[type="search"], [contenteditable="true"]')
      .first();
    if ((await input.count()) === 0) {
      test.skip(true, 'ai_assistant has no chat input visible');
    }
    await input.fill('Hello, summarize this term for my class.');
    const send = page
      .locator('button:has-text("Send"), button:has-text("Ask"), button[type="submit"], [aria-label*="Send"]')
      .first();
    if ((await send.count()) > 0) {
      await send.click().catch(() => {});
    } else {
      await input.press('Enter').catch(() => {});
    }
    // Wait for either a bot reply or a visible error bubble.
    const outcome = await page
      .waitForSelector(
        '.assistant-message, .bot-message, .ai-response, [class*="error"], .alert, .toast',
        { timeout: 12000 },
      )
      .catch(() => null);
    expect(outcome, 'AI assistant produced no visible reply or error state').not.toBeNull();
    expectCleanPage(errors, failed, 'AI assistant exchange');
  });

  test('5.4 curriculum tracker / upload_notes loads cleanly', async ({ page }) => {
    for (const route of ['/teacher/curriculum.html', '/teacher/upload_notes.html']) {
      await loginAs(page, 'teacher');
      const errors = installPageErrorCollector(page);
      const failed = installSupabaseFailureCollector(page);
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      const body = await page.locator('body').innerText();
      expect(body.trim().length, `${route} empty body`).toBeGreaterThan(0);
      expectCleanPage(errors, failed, route);
    }
  });
});
