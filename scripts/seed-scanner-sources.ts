/**
 * seed-scanner-sources.ts
 *
 * Inserts or updates SCANNER_SOURCES_SEED entries in scanner_sources.
 *
 * Usage:
 *   npm run seed:scanner-sources           — insert only (skip existing)
 *   npm run seed:scanner-sources:update    — insert + update existing rows
 *
 * Flags:
 *   --update-existing   Update source_type / base_url / description /
 *                       category_focus / risk_level / refresh_cadence /
 *                       attribution_rules for rows whose name already exists.
 *                       Does NOT overwrite `enabled` unless the seed value
 *                       is explicitly true (so disabling a source in the DB
 *                       is safe to do manually).
 *
 * Requirements:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 *   (via .env.local in project root, or already in environment).
 *
 * Safety:
 *   - Reads .env.local from project root if env vars are not already set
 *   - Exits cleanly (code 0) if Supabase is not configured
 *   - Never touches curator_notes, last_scanned_at, or created_at
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { SCANNER_SOURCES_SEED } from '../lib/scanner-sources-seed';

// ---------------------------------------------------------------------------
// Load .env.local (fills keys not already in process.env)
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
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env.local not present — rely on environment variables already set
  }
}

loadEnvLocal();

// ---------------------------------------------------------------------------
// Config check
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
// Parse flags
// ---------------------------------------------------------------------------

const UPDATE_EXISTING = process.argv.includes('--update-existing');

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const db = createClient(SUPABASE_URL, SUPABASE_ROLE_KEY);

async function run() {
  const mode = UPDATE_EXISTING ? 'insert + update existing' : 'insert only';
  console.log(`[seed:scanner-sources] Starting — ${SCANNER_SOURCES_SEED.length} sources in seed`);
  console.log(`[seed:scanner-sources] Mode    : ${mode}`);
  console.log(`[seed:scanner-sources] Target  : ${SUPABASE_URL}`);
  console.log('');

  let inserted = 0;
  let updated  = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const source of SCANNER_SOURCES_SEED) {
    const label = source.name.length > 72
      ? source.name.slice(0, 69) + '...'
      : source.name;

    // Check whether this source name already exists
    const { data: existing, error: checkErr } = await db
      .from('scanner_sources')
      .select('id, enabled')
      .eq('name', source.name)
      .maybeSingle();

    if (checkErr) {
      console.error(`[error]   ${label}`);
      console.error(`          ${checkErr.message}`);
      errors++;
      continue;
    }

    if (existing) {
      if (!UPDATE_EXISTING) {
        console.log(`[skip]    ${label}`);
        skipped++;
        continue;
      }

      // --update-existing: refresh metadata fields.
      // Only set enabled=true if the seed explicitly enables it;
      // never flip enabled from true → false automatically.
      const patch: Record<string, unknown> = {
        source_type:       source.source_type,
        base_url:          source.base_url ?? null,
        description:       source.description ?? null,
        category_focus:    source.category_focus ?? [],
        risk_level:        source.risk_level,
        refresh_cadence:   source.refresh_cadence ?? null,
        attribution_rules: source.attribution_rules ?? null,
      };
      if (source.enabled === true && !existing.enabled) {
        patch.enabled = true;
      }

      const { error: updateErr } = await db
        .from('scanner_sources')
        .update(patch)
        .eq('id', existing.id);

      if (updateErr) {
        console.error(`[error]   ${label}`);
        console.error(`          ${updateErr.message}`);
        errors++;
      } else {
        const enabledNote = patch.enabled ? ' [enabled=true applied]' : '';
        console.log(`[update]  ${label}${enabledNote}`);
        updated++;
      }
      continue;
    }

    // Insert new row — omit id and created_at so DB defaults apply
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
        enabled:           source.enabled ?? false,
        last_scanned_at:   null,
      });

    if (insertErr) {
      console.error(`[error]   ${label}`);
      console.error(`          ${insertErr.message}`);
      errors++;
    } else {
      const enabledNote = source.enabled ? ' [enabled=true]' : ' [enabled=false — enable manually]';
      console.log(`[insert]  ${label}${enabledNote}`);
      inserted++;
    }
  }

  console.log('');
  console.log('[seed:scanner-sources] Done');
  console.log(`  inserted : ${inserted}`);
  if (UPDATE_EXISTING) {
    console.log(`  updated  : ${updated}`);
  }
  console.log(`  skipped  : ${skipped}`);
  console.log(`  errors   : ${errors}`);

  if (errors > 0) process.exit(1);
}

run().catch((err: Error) => {
  console.error('[seed:scanner-sources] Fatal error:', err.message);
  process.exit(1);
});
