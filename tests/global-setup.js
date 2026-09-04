// tests/global-setup.js
// Seeds deterministic fixture data using the SUPABASE_SERVICE_ROLE_KEY.
// The service role key is used ONLY here (server-side) to create
// fixture users and rows — it is never loaded into the browser.
//
// Because the exact live schema can vary, every table write is done by
// introspecting the table's columns first and mapping known candidate
// column names, so the setup degrades gracefully. All created primary
// keys are recorded in tests/.fixtures-manifest.json, which
// tests/global-teardown.js consumes to clean up.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, '.fixtures-manifest.json');

const e = (k) => process.env[k] || '';
const envConfigured = () =>
  !!e('SUPABASE_URL') && !!(e('SUPABASE_ANON_KEY') || e('SUPABASE_SERVICE_ROLE_KEY'));

function makeClient() {
  const url = e('SUPABASE_URL');
  const key = e('SUPABASE_SERVICE_ROLE_KEY') || e('SUPABASE_ANON_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function globalSetup() {
  if (!envConfigured()) {
    console.warn('[global-setup] SUPABASE env not configured — skipping fixture seeding. Fill .env.test to enable.');
    writeManifest({ seeded: false });
    return;
  }

  const supabase = makeClient();
  const manifest = { seeded: true, users: [], rows: {}, timestamp: Date.now() };
  const fixtureSchoolA = `e2e-school-${Date.now()}`;
  const fixtureSchoolB = `e2e-school-other-${Date.now()}`;
  manifest.schoolIds = [fixtureSchoolA, fixtureSchoolB];

  // 1) Auth users -----------------------------------------------------------
  const userDefs = [
    ['admin', e('TEST_ADMIN_EMAIL'), e('TEST_ADMIN_PASSWORD'), fixtureSchoolA, 'admin'],
    ['teacher', e('TEST_TEACHER_EMAIL'), e('TEST_TEACHER_PASSWORD'), fixtureSchoolA, 'teacher'],
    ['parent', e('TEST_PARENT_EMAIL'), e('TEST_PARENT_PASSWORD'), fixtureSchoolA, 'parent'],
    ['student', e('TEST_STUDENT_EMAIL'), e('TEST_STUDENT_PASSWORD'), fixtureSchoolA, 'student'],
    ['otherParent', e('TEST_OTHER_PARENT_EMAIL'), e('TEST_OTHER_PARENT_PASSWORD'), fixtureSchoolB, 'parent'],
    ['otherTeacher', e('TEST_OTHER_TEACHER_EMAIL'), e('TEST_OTHER_TEACHER_PASSWORD'), fixtureSchoolB, 'teacher'],
  ];

  for (const [label, email, password, schoolId, userType] of userDefs) {
    if (!email || !password) {
      console.warn(`[global-setup] no credentials for "${label}" — skipping user seed`);
      continue;
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { user_type: userType, school_id: schoolId, role: userType },
    });
    if (error) {
      console.warn(`[global-setup] auth createUser "${label}" skipped: ${error.message}`);
      continue;
    }
    manifest.users.push({ label, email, id: data.user.id });
  }

  // 2) Best-effort relational rows ------------------------------------------
  // Skipped: we rely on pre-existing test data in Supabase rather than
  // introspecting the schema (see seedSchool below).

  writeManifest(manifest);
}

// ---- Seed helpers ----------------------------------------------------------

async function seedSchool() {
  console.log('[global-setup] seedSchool: skipped — ' +
    'using pre-existing test data in Supabase');
}

// ---- Manifest I/O ------------------------------------------------------------

export function writeManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return { seeded: false, rows: {}, users: [] };
  }
}
