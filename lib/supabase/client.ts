import { createBrowserClient } from '@supabase/ssr';

// Check if Supabase is configured
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
    // Return null if Supabase is not configured (demo mode or using Neon)
    if (!supabaseUrl || !supabaseKey) {
        return null;
    }

    return createBrowserClient(supabaseUrl, supabaseKey);
}

// Helper to check if Supabase is configured
export function isSupabaseConfigured() {
    return !!(supabaseUrl && supabaseKey);
}
