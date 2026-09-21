// tests/helpers/auth.js
// Supabase auth + REST helpers used across the E2E suite.
//
// loginAs(page, role) authenticates against the SUPABASE REST auth
// endpoint directly and injects the resulting session into the
// browser's localStorage so the SPA's supabase-js client picks it up.
//
// getSupabaseRestClient(accessToken) is a thin fetch() wrapper against
// the PostgREST API, used for precise RLS/data-isolation assertions
// that do not need a browser at all.

const env = (name) => process.env[name] || '';

function getSupabaseUrl() {
  return env('SUPABASE_URL');
}

// Extract the project reference (the slug between the URL host and
// .supabase.co) — used to build the localStorage auth token key, e.g.
//   https://abc123.supabase.co  ->  "abc123"
export function getProjectRef() {
  const url = getSupabaseUrl();
  const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : null;
}

export const ROLE_ENV = {
  admin: ['TEST_ADMIN_EMAIL', 'TEST_ADMIN_PASSWORD'],
  teacher: ['TEST_TEACHER_EMAIL', 'TEST_TEACHER_PASSWORD'],
  parent: ['TEST_PARENT_EMAIL', 'TEST_PARENT_PASSWORD'],
  student: ['TEST_STUDENT_EMAIL', 'TEST_STUDENT_PASSWORD'],
  otherParent: ['TEST_OTHER_PARENT_EMAIL', 'TEST_OTHER_PARENT_PASSWORD'],
  otherTeacher: ['TEST_OTHER_TEACHER_EMAIL', 'TEST_OTHER_TEACHER_PASSWORD'],
};

// Is the test environment (BASE_URL/SUPABASE creds + role emails) filled
// in? Used to skip gracefully until .env.test is populated.
export function isEnvConfigured(role = null) {
  if (!env('BASE_URL') || !env('SUPABASE_URL') || !env('SUPABASE_ANON_KEY')) {
    return false;
  }
  if (role === null) return true;
  const [emailKey, passKey] = ROLE_ENV[role] || [];
  return !!(env(emailKey) && env(passKey));
}

// Fetch an identity's auth token directly from Supabase's REST auth
// endpoint — no UI required.
export async function getSessionForRole(role) {
  const [emailKey, passKey] = ROLE_ENV[role] || [];
  const email = env(emailKey);
  const password = env(passKey);
  if (!email || !password) {
    throw new Error(`Missing credentials for role "${role}" in .env.test`);
  }

  const url = `${getSupabaseUrl()}/auth/v1/token?grant_type=password`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env('SUPABASE_ANON_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Auth failed for role "${role}" (${res.status}): ${body.slice(0, 300)}`,
    );
  }

  return res.json(); // { access_token, refresh_token, expires_at, user, ... }
}

// Log a role into the browser by injecting the session into
// localStorage under key `sb-{project-ref}-auth-token` in the exact
// shape supabase-js v2 expects, so the SPA auth guards pick it up.
export async function loginAs(page, role) {
  const email    = process.env[`TEST_${role.toUpperCase()}_EMAIL`];
  const password = process.env[`TEST_${role.toUpperCase()}_PASSWORD`];
  const supabaseUrl  = process.env.SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_ANON_KEY;

  if (!email || !password) {
    throw new Error(
      `loginAs: no credentials for role "${role}". ` +
      `Set TEST_${role.toUpperCase()}_EMAIL and _PASSWORD in .env.test`
    );
  }

  // Call Supabase auth REST endpoint directly
  const res = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ email, password }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`loginAs: Supabase auth failed for ${role}: ${err}`);
  }

  const session = await res.json();

  // Derive the localStorage key Supabase JS v2 uses
  const projectRef = supabaseUrl
    .replace('https://', '')
    .split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  // Write session in the exact shape supabase-js v2 expects
  const storageValue = JSON.stringify({
    access_token:  session.access_token,
    token_type:    session.token_type || 'bearer',
    expires_in:    session.expires_in,
    expires_at:    session.expires_at,
    refresh_token: session.refresh_token,
    user:          session.user,
  });

  // Navigate to the site root first so localStorage 
  // is set on the correct origin
  await page.goto('/', { waitUntil: 'domcontentloaded' })
            .catch(() => {});

  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [storageKey, storageValue]
  );
}

// Build a small PostgREST client bound to a specific access token.
//   client.select('table', { query })  -> GET
//   client.insert('table', body)       -> POST
//   client.update('table', patch, { query }) -> PATCH
// Each returns the raw fetch Response so callers can assert status codes
// (200/201 = allowed, 401/403/empty = isolated).
export function getSupabaseRestClient(accessToken) {
  const base = `${getSupabaseUrl()}/rest/v1`;

  async function request(method, table, { query = '', body = null } = {}) {
    const url = `${base}/${table}${query ? `?${query}` : ''}`;
    const headers = {
      apikey: env('SUPABASE_ANON_KEY'),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    return fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  return {
    select: (table, { query = '' } = {}) => request('GET', table, { query }),
    insert: (table, body, { query = '' } = {}) => request('POST', table, { query, body }),
    update: (table, body, { query = '' } = {}) => request('PATCH', table, { query, body }),
  };
}
