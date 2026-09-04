// tests/helpers/expectations.js
// Shared collectors + assertions to enforce the suite's cross-cutting
// rules on every protected page load:
//   - No uncaught window errors (page.on('pageerror'))
//   - No failed (>= 400) network requests to supabase.co
//   - Optionally track CDN resources

export function installPageErrorCollector(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  return errors;
}

export function installSupabaseFailureCollector(page) {
  const failed = [];
  page.on('response', (res) => {
    const url = res.url();
    if (/supabase\.co/.test(url) && res.status() >= 400) {
      failed.push({ url, status: res.status() });
    }
  });
  return failed;
}

export function installCdn404Collector(page) {
  const cdn404s = [];
  page.on('response', (res) => {
    const url = res.url();
    const isCdn =
      /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url);
    if (isCdn && res.status() >= 400) {
      cdn404s.push({ url, status: res.status() });
    }
  });
  return cdn404s;
}

// Assert no JS errors were recorded (failures get a descriptive message).
export function expectNoPageErrors(errors, context = '') {
  if (errors.length > 0) {
    throw new Error(
      `JS pageerror(s) occurred${context ? ` (${context})` : ''}: ${errors
        .map((e) => e.message)
        .join(' | ')}`,
    );
  }
}

// Assert no failed (>=400) requests to supabase.co were recorded.
export function expectNoSupabaseFailures(failed, context = '') {
  if (failed.length > 0) {
    throw new Error(
      `Failed supabase.co request(s)${context ? ` (${context})` : ''}: ${failed
        .map((f) => `${f.url} -> ${f.status}`)
        .join(' | ')}`,
    );
  }
}

// Convenience: assert both of the two mandatory conditions.
export function expectCleanPage(errors, failed, context = '') {
  expectNoPageErrors(errors, context);
  expectNoSupabaseFailures(failed, context);
}

// Record every Supabase REST write request (POST/PATCH upserts/inserts)
// so tests can assert a real write fired (not just trust the UI).
// Collected entries: { method, url, body }.
export function installSupabaseWriteCollector(page) {
  const writes = [];
  page.on('request', (req) => {
    if (!/supabase\.co\/rest\/v1\//.test(req.url())) return;
    if (req.method() === 'POST' || req.method() === 'PATCH') {
      writes.push({
        method: req.method(),
        url: req.url(),
        body: req.postData() || '',
      });
    }
  });
  return writes;
}

// Record every CDN request URL (for Group 10 static sanity checks).
export function installCdnRequestCollector(page) {
  const cdn = [];
  page.on('request', (req) => {
    if (/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(req.url())) {
      cdn.push(req.url());
    }
  });
  return cdn;
}
