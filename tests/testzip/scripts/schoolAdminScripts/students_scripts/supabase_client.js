// supabase_client.js
// Single shared Supabase client for all student-page modules.
// Importing multiple times is safe — ES module system caches the module,
// so only ONE GoTrueClient instance is ever created.
import { supabase } from '../../../core/config.js';

export const supabaseClient = supabase;
