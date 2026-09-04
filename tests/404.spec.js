// tests/404.spec.js — GROUP 3: Deleted/legacy files return 404
//
// These assets were removed from the repo (verified missing on disk) and
// have no netlify.toml rewrite, so they must return HTTP 404 on the live
// site rather than a SPA fallback or a stale copy.
//
// NOTE: scratch files (skeleton_test.html, layout_fix_test.html,
// minimal_test.html) are confirmed gone from the working tree; remaining
// candidates like fix_viewports.py are not web-served assets, so this
// list is final.

import { test, expect } from '@playwright/test';
import { isEnvConfigured } from './helpers/auth.js';

const LEGACY_PATHS = [
  // Files the task explicitly lists.
  '/portals/student/skeleton_test.html',
  '/portals/student/layout_fix_test.html',
  '/portals/parent/minimal_test.html',
  '/html/login.html',
  '/scripts/login.js',
  // Additional scratch/fix files found committed (now deleted) in the repo.
  '/portals/parent/exact_match_test.html',
  '/portals/parent/quick_test.html',
  '/portals/parent/skeleton_animation_test.html',
  '/portals/parent/skeleton_test.html',
  '/portals/parent/structure_test.html',
  '/portals/student/cbt_skeleton_test.html',
  '/portals/student/corrected_skeleton_test.html',
  '/portals/student/layout_test.html',
  '/portals/student/padding_test.html',
  '/portals/student/schedule_skeleton_test.html',
  '/portals/student/sidebar_test.html',
  '/portals/student/sidebar_toggle_test.html',
  '/portals/student/skeleton_styling_test.html',
  '/assets/js-shared/tierAccessTest.js',
  '/assets/js-shared/ui-engine-demo.html',
];

for (const path of LEGACY_PATHS) {
  test(`3 404 for deleted asset ${path}`, async ({ request }) => {
    test.skip(!isEnvConfigured(), '.env.test not populated (no BASE_URL) — skipping');
    const res = await request.get(path);
    expect(
      res.status(),
      `expected 404 for deleted asset ${path}, got ${res.status()}`,
    ).toBe(404);
  });
}
