import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const url    = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
// Service role key is never exposed to the browser — server-only env var.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY  ?? '';

export const hasSupabase = Boolean(url && anonKey);

/**
 * Returns a server-side Supabase client.
 *
 * @param useServiceRole  Pass `true` from server actions / API routes that
 *                        need to bypass RLS (e.g. moderation, seeding).
 *                        Falls back to anon key when service key is absent.
 *
 * Returns null when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * are not set, so the build passes without env vars.
 */
export function createServerSupabase(
  useServiceRole = false,
): SupabaseClient<Database> | null {
  if (!hasSupabase) return null;
  const key = useServiceRole && serviceKey ? serviceKey : anonKey;
  return createClient<Database>(url, key, {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
    },
  });
}
