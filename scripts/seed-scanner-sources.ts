/**
 * seed-scanner-sources.ts
 *
 * Inserts SCANNER_SOURCES_SEED entries from lib/scanner-sources-seed.ts into
 * the scanner_sources table.
 *
 * Usage:
 *   npm run seed:scanner-sources
 *
 * Requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 *     (via .env.local in the project root, or already in the environment)
 *
 * Safety:
 *   - Reads .env.local from project root if env vars are not already set
 *   - Skips sources whose name already exists in the table
 *   - All sources inserted with enabled=false — curator must enable manually
 *   - Exits cleanly (code 0) if Supabase is not configured
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { SCANNER_SOURCES_SEED } from '../lib/scanner-sources-seed';

// ---------------------------------------------------------------------------
// Load .env.local (only fills keys not already in process.env)
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
  console.log('[seed:scanner-sources] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
  console.log('[seed:scanner-sources] Skipping — no database connection available.');
  console.log('[seed:scanner-sources] Set both env vars in .env.local and re-run to seed.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const db = createClient(SUPABASE_URL, SUPABASE_ROLE_KEY);

async function run() {
  console.log(`[seed:scanner-sources] Starting — ${SCANNER_SOURCES_SEED.length} sources in seed`);
  console.log(`[seed:scanner-sources] Target: ${SUPABASE_URL}`);
  console.log('');

  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const source of SCANNER_SOURCES_SEED) {
    const label = source.name.length > 72
      ? source.name.slice(0, 69) + '...'
      : source.name;

    // Duplicate check — skip if a source with this exact name already exists
    const { data: existing, error: checkErr } = await db
      .from('scanner_sources')
      .select('id')
      .eq('name', source.name)
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

    // Insert — omit id and created_at so DB defaults apply
    const { error: insertErr } = await db
      .from('scanner_sources')
      .insert({
        name:              source.name,
        source_type:       source.source_type,
        base_url:          source.base_url ?? null,
        description:       source.description ?? null,
        category_focus:    source.category_focus ?? [],
        risk_level:        source.risk_level,
        refresh_cadence:   source.refresh_cadence ?? null,
        attribution_rules: source.attribution_rules ?? null,
        enabled:           false,
        last_scanned_at:   null,
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
  console.log(`[seed:scanner-sources] Done`);
  console.log(`  inserted : ${inserted}`);
  console.log(`  skipped  : ${skipped}`);
  console.log(`  errors   : ${errors}`);

  if (errors > 0) {
    process.exit(1);
  }
}

run().catch((err: Error) => {
  console.error('[seed:scanner-sources] Fatal error:', err.message);
  process.exit(1);
});
