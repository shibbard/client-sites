import { createClient } from '@supabase/supabase-js';

// Service role key — server-side only. It bypasses RLS and can read owner_url,
// so it must never be exposed to the browser or prefixed NEXT_PUBLIC/VITE.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Separate client on the anon key, used only to issue and verify the 6-digit
// codes through Supabase Auth rather than hand-rolling code logic.
export const authClient = createClient(url, process.env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
