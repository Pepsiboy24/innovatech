// Supabase client — the library is self-hosted as a bundled ES module
// (assets/vendor/supabase.esm.js) instead of being fetched live from a
// third-party CDN. A plain static import means the browser finishes
// loading it BEFORE any page script runs, so there is no startup race
// and no dependency on an outside server being fast or online.
import { createClient } from '/assets/vendor/supabase.esm.js';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Make supabase available globally (other files rely on window.supabase)
window.supabase = supabase;

// ─────────────────────────────────────────────────────────────────────────
// Trusted metadata shim
// `user_metadata` can be edited by the logged-in user themselves, so it must
// not decide who someone is or which school they belong to. `app_metadata`
// can only be written server-side (Edge Function / service role).
// This shim copies the trusted keys from app_metadata over user_metadata on
// every user/session object the client returns, so all ~90 existing
// `user.user_metadata.school_id` reads automatically see the trusted value.
//
// STRICT_APP_METADATA = false  -> fall back to user_metadata for users that
//                                 have not been backfilled yet (migration mode).
// STRICT_APP_METADATA = true   -> ignore user_metadata for these keys. Switch
//                                 this on after running the backfill SQL.
// ─────────────────────────────────────────────────────────────────────────
const STRICT_APP_METADATA = false;
const TRUSTED_KEYS = ['school_id', 'user_type', 'role', 'must_change_password'];

function mergeTrustedMetadata(user) {
    if (!user) return user;
    const app = user.app_metadata || {};
    const merged = { ...(user.user_metadata || {}) };
    for (const k of TRUSTED_KEYS) {
        if (app[k] !== undefined) merged[k] = app[k];
        else if (STRICT_APP_METADATA) delete merged[k];
    }
    user.user_metadata = merged;
    return user;
}

(function patchAuth(auth) {
    const origGetUser = auth.getUser.bind(auth);
    auth.getUser = async (...args) => {
        const res = await origGetUser(...args);
        if (res?.data?.user) mergeTrustedMetadata(res.data.user);
        return res;
    };

    const origGetSession = auth.getSession.bind(auth);
    auth.getSession = async (...args) => {
        const res = await origGetSession(...args);
        if (res?.data?.session?.user) mergeTrustedMetadata(res.data.session.user);
        return res;
    };

    const origSignIn = auth.signInWithPassword.bind(auth);
    auth.signInWithPassword = async (...args) => {
        const res = await origSignIn(...args);
        if (res?.data?.user) mergeTrustedMetadata(res.data.user);
        if (res?.data?.session?.user) mergeTrustedMetadata(res.data.session.user);
        return res;
    };

    const origOnChange = auth.onAuthStateChange.bind(auth);
    auth.onAuthStateChange = (cb) => origOnChange((event, session) => {
        if (session?.user) mergeTrustedMetadata(session.user);
        return cb(event, session);
    });
})(supabase.auth);

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
