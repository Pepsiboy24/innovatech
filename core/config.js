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

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
