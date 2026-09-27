// Self-hosted Supabase library (was a live esm.sh import — that caused
// pages to render blank on a slow/cold first load, working only after a
// refresh once the browser had it cached). Loading it locally via an
// absolute path means every page keeps working exactly the same, with
// no other file needing to change.
function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
        if (window.supabase && window.supabase.createClient) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = '/assets/vendor/supabase.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load the Supabase library from /assets/vendor/supabase.js'));
        document.head.appendChild(script);
    });
}

await loadSupabaseLibrary();

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

// window.supabase currently holds the library (from the script we just
// loaded); createClient() then overwrites it with the actual client below.
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Make supabase available globally
window.supabase = supabase;

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };


