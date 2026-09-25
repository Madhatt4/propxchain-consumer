import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check your .env.local');
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Security scan M6: under the default implicit flow supabase-js accepted a
    // session from #access_token in ANY URL, so a crafted link could sign a
    // victim into an attacker's account. PKCE only exchanges a ?code= this
    // browser started; auth emails carry a token_hash instead (auth-email-hook).
    flowType: 'pkce',
  },
});
