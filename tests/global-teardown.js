// tests/global-teardown.js
// Removes any fixture rows and auth users created by global-setup.js
// (recorded in tests/.fixtures-manifest.json). Runs after the suite
// regardless of pass/fail. Uses the service role key — server-side only.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readManifest } from './global-setup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, '.fixtures-manifest.json');

const e = (k) => process.env[k] || '';

export default async function globalTeardown() {
  const manifest = readManifest();
  if (!manifest.seeded) {
    // Nothing was seeded; make sure no stale manifest lingers.
    cleanupManifest();
    return;
  }

  const url = e('SUPABASE_URL');
  const key = e('SUPABASE_SERVICE_ROLE_KEY') || e('SUPABASE_ANON_KEY');
  if (!url || !key) {
    cleanupManifest();
    return;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 1) Delete fixture rows, deepest/last-written first.
  //    Rows are stored per table so we can delete by primary key.
  const tables = Object.keys(manifest.rows);
  // reverse so child rows (payments, links) are deleted before parents
  for (const table of tables.reverse()) {
    const rows = manifest.rows[table];
    for (const row of rows || []) {
      // Prefer 'id' (Postgres serial PK); fall back to full match.
      const idCol = row && typeof row.id !== 'undefined' ? 'id' : null;
      if (idCol) {
        await supabase.from(table).delete().eq(idCol, row[idCol]).maybeSingle();
      } else if (row) {
        // Generic: delete by every non-null scalar field (best effort).
        let q = supabase.from(table).delete();
        for (const [k, v] of Object.entries(row)) {
          if (typeof v === 'string' || typeof v === 'number') q = q.eq(k, v);
        }
        await q.neq(Object.keys(row)[0] || 'id', '__none__').maybeSingle();
      }
    }
  }

  // 2) Delete auth users.
  for (const u of manifest.users || []) {
    if (u.id) {
      const { error } = await supabase.auth.admin.deleteUser(u.id);
      if (error) console.warn(`[global-teardown] deleteUser ${u.email}: ${error.message}`);
    }
  }

  cleanupManifest();
}

function cleanupManifest() {
  try {
    if (fs.existsSync(MANIFEST_PATH)) fs.unlinkSync(MANIFEST_PATH);
  } catch {
    /* ignore */
  }
}
