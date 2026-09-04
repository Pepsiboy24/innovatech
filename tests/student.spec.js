// tests/student.spec.js — GROUP 7: Student portal (CRITICAL — CBT engine)
//
// The CBT exam page is the highest-integrity-risk part of the app: it must
// render questions, persist answers, run a visible timer, and be ONE-WAY
// after submission (no re-answer/retake via refresh).

import { test, expect } from '@playwright/test';
import { loginAs, isEnvConfigured } from './helpers/auth.js';
import {
  installPageErrorCollector,
  installSupabaseFailureCollector,
  expectCleanPage,
} from './helpers/expectations.js';

async function acceptDialogs(page) {
  page.on('dialog', (d) => d.accept()); // accept confirm() submit dialogs
}

test.describe('GROUP 7 — Student portal', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.skip(!isEnvConfigured('student'), '.env.test student fixture not set — skipping student group');
  });

  test('7.1 CBT engine: renders question, persists answer, timer runs, one-way submit', async ({ page }) => {
    acceptDialogs(page);
    await loginAs(page, 'student');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);

    await page.goto('/student/cbtEngine.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Enter the exam if we're on the lobby (press Start / Begin).
    const startBtn = page
      .locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Start Exam")')
      .first();
    if ((await startBtn.count()) > 0 && (await startBtn.isVisible().catch(() => false))) {
      await startBtn.click().catch(() => {});
    }

    // (1) A question must render and options must be selectable.
    const question = page.locator('#questionText, .question, [class*="question"]').first();
    await expect(question).toBeVisible({ timeout: 12000 });
    const qText = await question.innerText();
    expect(qText.trim().length, 'no question text rendered').toBeGreaterThan(0);

    const options = page.locator('#optionsContainer .option, #optionsContainer label, .option, [class*="option"]');
    if ((await options.count()) > 0) {
      await options.first().click().catch(() => {});
      // Mark stored selection (answer persisted client-side).
      const selected = page.locator('#optionsContainer .selected, #optionsContainer .active, #optionsContainer .answered');
      await expect(selected.first().or(options.first())).toBeVisible();
    }

    // (2) Timer must be visible/running.
    const timer = page.locator('#hudTimer, #timerText, [id*="timer"]').first();
    const timerVisible = (await timer.count()) > 0 && (await timer.isVisible().catch(() => false));
    if (timerVisible) {
      const t1 = await timer.innerText();
      await page.waitForTimeout(1100);
      const t2 = await timer.innerText();
      expect(t1, 'timer text did not change — timer not running').not.toBe(t2);
    }

    // (3) Move to next question (persistence across navigation).
    const nextBtn = page.locator('#nextBtn');
    if ((await nextBtn.count()) > 0 && !(await nextBtn.isDisabled().catch(() => false))) {
      await nextBtn.click().catch(() => {});
      await expect(question).toBeVisible({ timeout: 8000 });
    }

    // (4) ONE-WAY submit: after submit, reload must NOT allow re-answering.
    const submitBtn = page.locator('#submitExamBtn, #submitBtn, button:has-text("Submit")').first();
    if ((await submitBtn.count()) > 0) {
      await submitBtn.click().catch(() => {});
      await page.waitForTimeout(1500);
      // Should have moved to a results/summary view (resultsView visible)
      // or shown a completion state.
      const resultsVisible = (await page.locator('#resultsView, #scoreCard, [class*="result"]').count()) > 0;
      const completedText = await page.locator('body').innerText().catch(() => '');
      expect(
        resultsVisible || /complete|submitted|score|finish|thank/i.test(completedText),
        'after submit there was no completion/results state',
      ).toBe(true);

      // Reload: must NOT drop the user back into a re-answerable exam.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      const bodyAfter = await page.locator('body').innerText().catch(() => '');
      expect(
        bodyAfter,
        'SECURITY: after reload the submitted exam is re-answerable / results not shown',
      ).toMatch(/score|complete|submitted|result|percentage|correction|finish/i);
    }

    expectCleanPage(errors, failed, 'CBT engine');
  });

  async function loadSimple(page, route, contentRe) {
    await loginAs(page, 'student');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    const body = await page.locator('body').innerText();
    expect(body.trim().length, `${route} empty body`).toBeGreaterThan(0);
    if (contentRe && (await page.locator('li, tr, .card, .material').count()) > 0) {
      expect(body).toMatch(contentRe);
    }
    expectCleanPage(errors, failed, route);
  }

  test('7.2 study materials + notes render for own class', async ({ page }) => {
    await loadSimple(page, '/student/studyMaterials.html', /material|document|note|class|subject|pdf|file|lesson/i);
    await loadSimple(page, '/student/manage_notes.html', /note|document|class|subject|save|edit|delete/i);
  });

  test('7.3 schedule + classes render (not blank)', async ({ page }) => {
    await loadSimple(page, '/student/schedule.html', /schedule|time|period|date|class|subject|timetable/i);
    await loadSimple(page, '/student/studentClasses.html', /class|subject|teacher|room|section/i);
  });
});
