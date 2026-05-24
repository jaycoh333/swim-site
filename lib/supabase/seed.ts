/**
 * Seed script — migrates current mock data into a live Supabase project.
 *
 * Usage (run once, after creating the project and applying schema.sql):
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx ts-node --project tsconfig.json lib/supabase/seed.ts
 *
 * Or with tsx:
 *   npx tsx lib/supabase/seed.ts
 *
 * The script is idempotent — it upserts on `slug` / `name` so re-running is safe.
 * It does NOT delete existing rows.
 */

import { createClient } from '@supabase/supabase-js';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '../forum-types';
import { THREAD_SEED } from '../seed-data';
import { REPLY_SEED } from '../reply-seed';

const url        = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY      ?? '';
const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  ?? '';

if (!url || !(serviceKey || anonKey)) {
  console.error(
    'Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and ' +
    'SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  );
  process.exit(1);
}

// Prefer service role for seeding — bypasses RLS insert restrictions
const key = serviceKey || anonKey;
const db  = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
async function seedCategories() {
  console.log('Seeding categories …');
  const rows = CATEGORY_ORDER.map((name, i) => ({
    name,
    color:         CATEGORY_COLORS[name] ?? '#86d46e',
    display_order: i,
  }));

  const { error } = await db
    .from('categories')
    .upsert(rows, { onConflict: 'name' });

  if (error) throw new Error(`categories: ${error.message}`);
  console.log(`  ✓ ${rows.length} categories`);
}

// ---------------------------------------------------------------------------
async function seedThreads() {
  console.log('Seeding threads …');

  const rows = THREAD_SEED.map((t) => ({
    slug:            t.id,
    title:           t.title,
    body:            t.body,
    category:        t.category,
    author_handle:   t.authorHandle,
    author_mode:     ('ghost' satisfies 'ghost'),
    tags:            t.tags,
    is_pinned:       t.pinned ?? false,
    is_highlighted:  t.isHighlighted ?? false,
    badge:           t.badge ?? null,
    archive_status:  t.archiveStatus ?? null,
    signal_level:    t.signalLevel ?? null,
    archive_id:      t.archiveId ?? null,
    view_count:      t.viewCount,
    reply_count:     t.replyCount,
  }));

  const { error } = await db
    .from('threads')
    .upsert(rows, { onConflict: 'slug' });

  if (error) throw new Error(`threads: ${error.message}`);
  console.log(`  ✓ ${rows.length} threads`);
}

// ---------------------------------------------------------------------------
async function seedReplies() {
  console.log('Seeding replies …');

  // Fetch all threads to get UUID → slug mapping
  const { data: threadRows, error: threadErr } = await db
    .from('threads')
    .select('id, slug');

  if (threadErr) throw new Error(`fetch threads for replies: ${threadErr.message}`);

  const slugToUuid: Record<string, string> = {};
  for (const row of threadRows ?? []) {
    slugToUuid[row.slug] = row.id;
  }

  let totalInserted = 0;

  for (const [threadSlug, replies] of Object.entries(REPLY_SEED)) {
    const threadUuid = slugToUuid[threadSlug];
    if (!threadUuid) {
      console.warn(`  ! No thread found for slug "${threadSlug}" — skipping replies`);
      continue;
    }

    const rows = replies.map((r) => ({
      thread_id:    threadUuid,
      body:         r.body,
      author_handle: r.authorHandle,
      author_mode:  r.authorMode,
      post_number:  r.postNumber,
      reply_to_id:  null,
    }));

    const { error } = await db
      .from('replies')
      // post_number is unique per thread — safe to upsert
      .upsert(rows, { onConflict: 'thread_id,post_number' });

    if (error) {
      console.warn(`  ! replies for ${threadSlug}: ${error.message}`);
    } else {
      totalInserted += rows.length;
    }
  }

  console.log(`  ✓ ${totalInserted} replies across ${Object.keys(REPLY_SEED).length} threads`);
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('SWIM → Supabase seed starting …\n');
  try {
    await seedCategories();
    await seedThreads();
    await seedReplies();
    console.log('\nDone. All mock data is now in Supabase.');
  } catch (err) {
    console.error('\nSeed failed:', err);
    process.exit(1);
  }
}

main();
