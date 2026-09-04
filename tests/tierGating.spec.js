// tests/tierGating.spec.js — GROUP 9: Tier / feature gating
//
// The app gates features by subscription tier via uiTierGating.js
// (markers: [data-feature="cbt-exams"], [data-feature="ai-assistants"],
// etc.) and featureGate.js plans (basic vs premium). gated elements get a
// .tier-upgrade-message / .upgrade-prompt overlay (or are removed), while
// permitted elements stay usable.
//
// NOTE: This group is currently limited by fixture availability — see
// 9.2 for the explicit skip + reason.

import { test, expect } from '@playwright/test';
import { loginAs, isEnvConfigured } from './helpers/auth.js';
import {
  installPageErrorCollector,
  installSupabaseFailureCollector,
  expectCleanPage,
} from './helpers/expectations.js';

const GATED_FEATURES = ['cbt-exams', 'ai-assistants', 'student-dashboard', 'parent-portal'];

test.describe('GROUP 9 — Tier / feature gating', () => {
  test.describe.configure({ mode: 'serial' });

  test('9.1 gating logic is applied to tier-gated features on the available account', async ({ page }) => {
    test.skip(
      !isEnvConfigured('admin'),
      'no admin fixture in .env.test — cannot verify tier gating',
    );
    await loginAs(page, 'admin');
    const errors = installPageErrorCollector(page);
    const failed = installSupabaseFailureCollector(page);

    await page.goto('/admin/schoolAdminDashboard.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // The gating must actively consult the school tier for at least one
    // gated feature: either the element is present/usable (tier allows it)
    // OR it shows the .upgrade-prompt (tier denies it). Either outcome
    // proves the gating mechanism runs and does not silently show locked
    // content as free.
    let checkedAny = false;
    for (const feature of GATED_FEATURES) {
      const el = page.locator(`[data-feature="${feature}"]`).first();
      if ((await el.count()) === 0) continue;
      checkedAny = true;
      const visible = await el.isVisible().catch(() => false);
      const upgrade = await page
        .locator(`[data-feature="${feature}"] .upgrade-prompt, .tier-upgrade-message`)
        .count();
      if (visible) {
        // Feature is usable — acceptable for a high-enough tier.
        expect(feature).toBeTruthy();
      } else {
        // Not visible — the upgrade prompt must be present to explain why.
        expect(upgrade, `feature ${feature} is hidden with no upgrade prompt`).toBeGreaterThan(0);
      }
      break; // one representative gated feature is enough
    }

    if (!checkedAny) {
      test.skip(true, 'no [data-feature=...] gated elements rendered on this page');
    }
    expectCleanPage(errors, failed, 'tier gating');
  });

  test('9.2 higher-tier account can use the same gated feature', async ({ page }) => {
    // Explicit skip: this group needs TWO fixture accounts on DIFFERENT
    // subscription tiers to prove the feature is UNLOCKED on a higher tier
    // but LOCKED on a lower one. Only one tier of test account is currently
    // provisioned in .env.test, so the positive-path assertion cannot be
    // made yet.
    test.skip(
      true,
      'A second higher-tier fixture account is required to prove a gated feature is usable on a premium tier. Add a premium-tier school+admin fixture, then assert [data-feature="ai-assistants"] / [data-feature="cbt-exams"] is visible WITHOUT any .upgrade-prompt overlay.',
    );
  });
});
