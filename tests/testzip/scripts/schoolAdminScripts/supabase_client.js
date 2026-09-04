// supabase_client.js
// Single shared Supabase client for all teacher-page modules.
// ES module caching guarantees only ONE GoTrueClient instance is created.
import { supabase } from '../../core/config.js';

export const supabaseClient = supabase;
