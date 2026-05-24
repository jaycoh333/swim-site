import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// True only when both env vars are present at runtime.
// All Supabase calls must guard on this flag — never assume the client exists.
export const hasSupabase = Boolean(url && key);

// Singleton — reused across renders in the same browser session.
let _client: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!hasSupabase) return null;
  if (!_client) _client = createClient<Database>(url, key);
  return _client;
}

// Convenience export — null when env vars are absent (safe to import anywhere).
export const supabase: SupabaseClient<Database> | null = hasSupabase
  ? createClient<Database>(url, key)
  : null;
