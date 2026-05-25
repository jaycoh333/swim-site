/**
 * seed-source-pack.ts
 *
 * Inserts SOURCE_PACK_01 entries from lib/manual-source-pack.ts into
 * the recovered_signals table as status='pending'.
 *
 * Usage:
 *   npm run seed:source-pack
 *
 * Requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 *     (via .env.local in the project root, or already in the environment)
 *
 * Safety:
 *   - Reads .env.local from project root if env vars are not already set
 *   - Checks for duplicate titles before inserting (skips if found)
 *   - All signals inserted as status='pending' for curator review
 *   - Exits cleanly (code 0) if Supabase is not configured — safe to run
 *     in environments without a database connection
 *   - Never auto-publishes; curator must approve each signal in /scanner/queue
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { SOURCE_PACK_01 } from '../lib/manual-source-pack';

// ---------------------------------------------------------------------------
// Load .env.local (only fills keys that are not already in process.env)
// ---------------------------------------------------------------------------

function loadEnvLocal() {
  try {
    const envPath = join(process.cwd(), '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env.local not present — rely on environment variables already set
  }
}

loadEnvLocal();

// ---------------------------------------------------------------------------
// Config check — exit cleanly if Supabase is not configured
// ---------------------------------------------------------------------------

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ROLE_KEY) {
  console.log('[seed:source-pack] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
  console.log('[seed:source-pack] Skipping — no database connection available.');
  console.log('[seed:source-pack] Set both env vars in .env.local and re-run to seed.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const db = createClient(SUPABASE_URL, SUPABASE_ROLE_KEY);

async function run() {
  console.log(`[seed:source-pack] Starting — ${SOURCE_PACK_01.length} entries in pack`);
  console.log(`[seed:source-pack] Target: ${SUPABASE_URL}`);
  console.log('');

  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const entry of SOURCE_PACK_01) {
    const label = entry.title.length > 72
      ? entry.title.slice(0, 69) + '...'
      : entry.title;

    // Duplicate check — skip if a signal with this exact title already exists
    const { data: existing, error: checkErr } = await db
      .from('recovered_signals')
      .select('id')
      .eq('title', entry.title)
      .maybeSingle();

    if (checkErr) {
      console.error(`[error]  ${label}`);
      console.error(`         ${checkErr.message}`);
      errors++;
      continue;
    }

    if (existing) {
      console.log(`[skip]   ${label}`);
      skipped++;
      continue;
    }

    // Insert
    const { error: insertErr } = await db
      .from('recovered_signals')
      .insert({
        category:           entry.category,
        title:              entry.title,
        summary:            entry.summary,
        source_name:        entry.sourceName,
        source_url:         entry.sourceUrl ?? null,
        source_type:        entry.sourceType,
        status:             'pending',
        anomaly_score:      entry.anomalyScore,
        tags:               entry.tags ?? [],
        discovered_at:      entry.discoveredAt ?? new Date().toISOString(),
        submitted_publicly: entry.submittedPublicly ?? false,
      });

    if (insertErr) {
      console.error(`[error]  ${label}`);
      console.error(`         ${insertErr.message}`);
      errors++;
    } else {
      console.log(`[insert] ${label}`);
      inserted++;
    }
  }

  console.log('');
  console.log(`[seed:source-pack] Done`);
  console.log(`  inserted : ${inserted}`);
  console.log(`  skipped  : ${skipped}`);
  console.log(`  errors   : ${errors}`);

  if (errors > 0) {
    process.exit(1);
  }
}

run().catch((err: Error) => {
  console.error('[seed:source-pack] Fatal error:', err.message);
  process.exit(1);
});
