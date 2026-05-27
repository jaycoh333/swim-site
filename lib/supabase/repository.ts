/**
 * Repository — unified data access layer.
 *
 * When NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set,
 * functions query Supabase.  Otherwise they fall back to the mock database
 * so the app builds and runs locally without any env vars.
 *
 * Import this from server components and API/server-action files.
 * Client components that need live mutations should call server actions
 * that delegate here.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { mockDb } from '@/lib/mock-db';
import type { Category, ThreadContent, Reply } from '@/lib/forum-types';
import type { DbThread, DbReply, ReactionType, DbRecoveredSignal, RecoveredSignalStatus, SignalSourceType, DbScannerSource, ScannerRiskLevel } from './types';
import { RECOVERED_SIGNAL_SEED } from '@/lib/recovered-signals-seed';
import { SCANNER_SOURCES_SEED } from '@/lib/scanner-sources-seed';

// ---------------------------------------------------------------------------
// Untyped client — the repository casts results to our own DB types explicitly.
// This avoids fighting Supabase's generic type inference at the query-builder
// level while still keeping strong types on everything we return to callers.
// ---------------------------------------------------------------------------

const _url     = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? '';
const _anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const _svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY     ?? '';

export const hasSupabase = Boolean(_url && _anonKey);

// Singleton per process (server) — use service key when available so RLS
// insert restrictions don't block server-side writes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: SupabaseClient<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDb(): SupabaseClient<any> | null {
  if (!hasSupabase) return null;
  if (!_db) {
    const key = _svcKey || _anonKey;
    _db = createClient(_url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Helpers — map DB rows → app types
// (Keeps UI code decoupled from raw DB column names.)
// ---------------------------------------------------------------------------

function dbThreadToContent(row: DbThread): ThreadContent {
  return {
    id:              row.slug,
    type:            'THREAD',
    category:        row.category as Category,
    title:           row.title,
    body:            row.body,
    excerpt:         row.body.slice(0, 160),
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
    lastActivityAt:  row.last_activity_at,
    tags:            row.tags,
    reactions:       { echo: 0, dive: 0, ripple: 0, witness: 0, signal: 0 },
    replyCount:      row.reply_count,
    viewCount:       row.view_count,
    authorHandle:    row.author_handle,
    authorId:        row.id,
    lastPostPreview: '',
    board:           `/${row.category.toLowerCase().replace(/\s+/g, '-')}/`,
    pinned:          row.is_pinned,
    isHighlighted:   row.is_highlighted,
    badge:           row.badge ?? undefined,
    archiveStatus:   row.archive_status ?? undefined,
    signalLevel:     row.signal_level ?? undefined,
    archiveId:       row.archive_id ?? undefined,
  };
}

function dbReplyToReply(row: DbReply, index: number): Reply {
  return {
    id:           row.id,
    threadId:     row.thread_id,
    postNumber:   row.post_number ?? index + 2,
    body:         row.body,
    createdAt:    row.created_at,
    authorHandle: row.author_handle,
    authorMode:   row.author_mode,
    reactions:    { echo: 0, dive: 0, ripple: 0, witness: 0, signal: 0 },
    replyToId:    row.reply_to_id ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Input types for mutations
// ---------------------------------------------------------------------------

export interface CreateThreadInput {
  title:        string;
  body:         string;
  category:     string;
  authorHandle: string;
  authorMode:   'anon' | 'ghost';
  tags?:        string[];
}

export interface CreateReplyInput {
  threadId:     string;
  body:         string;
  authorHandle: string;
  authorMode:   'anon' | 'ghost';
  replyToId?:   string;
}

export interface AddReactionInput {
  targetType:      'thread' | 'reply';
  targetId:        string;
  reactionType:    ReactionType;
  anonFingerprint: string;
}

export interface ReportContentInput {
  targetType: 'thread' | 'reply';
  targetId:   string;
  reason:     'spam' | 'illegal_content' | 'doxxing' | 'harassment' | 'off_topic' | 'other';
  details?:   string;
}

// ---------------------------------------------------------------------------
// Read — threads
// ---------------------------------------------------------------------------

export async function getThreads(
  category: Category | 'ALL' = 'ALL',
): Promise<ThreadContent[]> {
  if (!hasSupabase) return mockDb.getThreads(category);

  const db = getDb()!;
  let q = db
    .from('threads')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('last_activity_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (category !== 'ALL') q = q.eq('category', category);

  const { data, error } = await q;
  if (error) {
    console.error('[repository] getThreads:', error.message);
    return mockDb.getThreads(category);
  }
  return (data ?? []).map(dbThreadToContent);
}

export async function getThread(id: string): Promise<ThreadContent | undefined> {
  if (!hasSupabase) return mockDb.getThread(id);

  const db = getDb()!;
  const { data, error } = await db
    .from('threads')
    .select('*')
    .eq('slug', id)
    .single();

  if (error || !data) {
    console.error('[repository] getThread:', error?.message);
    return mockDb.getThread(id);
  }
  return dbThreadToContent(data);
}

export async function getHomepageThreads(): Promise<ThreadContent[]> {
  if (!hasSupabase) return mockDb.getHomepageThreads();

  const db = getDb()!;
  const { data, error } = await db
    .from('threads')
    .select('*')
    .order('last_activity_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[repository] getHomepageThreads:', error.message);
    return mockDb.getHomepageThreads();
  }
  return (data ?? []).map(dbThreadToContent);
}

export async function getHighlightedThreads(): Promise<ThreadContent[]> {
  if (!hasSupabase) return mockDb.getHighlightedThreads();

  const db = getDb()!;
  const { data, error } = await db
    .from('threads')
    .select('*')
    .eq('is_highlighted', true)
    .order('last_activity_at', { ascending: false })
    .limit(6);

  if (error) {
    console.error('[repository] getHighlightedThreads:', error.message);
    return mockDb.getHighlightedThreads();
  }
  return (data ?? []).map(dbThreadToContent);
}

export async function getPinnedThreads(): Promise<ThreadContent[]> {
  if (!hasSupabase) return mockDb.getPinnedThreads();

  const db = getDb()!;
  const { data, error } = await db
    .from('threads')
    .select('*')
    .eq('is_pinned', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[repository] getPinnedThreads:', error.message);
    return mockDb.getPinnedThreads();
  }
  return (data ?? []).map(dbThreadToContent);
}

export async function getRelatedThreads(
  category: string,
  excludeId: string,
  limit = 5,
): Promise<ThreadContent[]> {
  if (!hasSupabase) return mockDb.getRelatedThreads(category, excludeId, limit);

  const db = getDb()!;
  const { data, error } = await db
    .from('threads')
    .select('*')
    .eq('category', category)
    .neq('slug', excludeId)
    .order('last_activity_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[repository] getRelatedThreads:', error.message);
    return mockDb.getRelatedThreads(category, excludeId, limit);
  }
  return (data ?? []).map(dbThreadToContent);
}

export async function getHotThreads(): Promise<ThreadContent[]> {
  if (!hasSupabase) return mockDb.getHotThreads();

  const db = getDb()!;
  const { data, error } = await db
    .from('threads')
    .select('*')
    .order('view_count', { ascending: false })
    .limit(5);

  if (error) {
    console.error('[repository] getHotThreads:', error.message);
    return mockDb.getHotThreads();
  }
  return (data ?? []).map(dbThreadToContent);
}

// ---------------------------------------------------------------------------
// Read — replies
// ---------------------------------------------------------------------------

export async function getReplies(threadId: string): Promise<Reply[]> {
  if (!hasSupabase) return mockDb.getThreadReplies(threadId);

  // threadId here is the slug; resolve to UUID first
  const db = getDb()!;
  const threadResult = await db.from('threads').select('*').eq('slug', threadId).single();
  const threadRow = threadResult.data as DbThread | null;

  if (!threadRow) return mockDb.getThreadReplies(threadId);

  const { data, error } = await db
    .from('replies')
    .select('*')
    .eq('thread_id', threadRow.id)
    .order('post_number', { ascending: true });

  if (error) {
    console.error('[repository] getReplies:', error.message);
    return mockDb.getThreadReplies(threadId);
  }
  return (data ?? []).map((row, i) => dbReplyToReply(row, i));
}

// ---------------------------------------------------------------------------
// Write — threads
// ---------------------------------------------------------------------------

export async function createThread(
  input: CreateThreadInput,
): Promise<{ id: string } | { error: string }> {
  if (!hasSupabase) {
    // Mock: return a fake id so the UI can redirect without crashing
    return { id: `th-local-${Date.now()}` };
  }

  const slug = `${Date.now()}-${input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)}`;

  const db = getDb()!;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('threads')
    .insert({
      slug,
      title:            input.title,
      body:             input.body,
      category:         input.category,
      author_handle:    input.authorHandle,
      author_mode:      input.authorMode,
      tags:             input.tags ?? [],
      last_activity_at: now,
    })
    .select('slug')
    .single();

  if (error) {
    console.error('[repository] createThread:', error.message);
    return { error: error.message };
  }
  return { id: data.slug };
}

// ---------------------------------------------------------------------------
// Write — replies
// ---------------------------------------------------------------------------

export async function createReply(
  input: CreateReplyInput,
): Promise<{ id: string } | { error: string }> {
  if (!hasSupabase) {
    return { id: `reply-local-${Date.now()}` };
  }

  const db = getDb()!;

  // Resolve slug → UUID
  const threadResult = await db.from('threads').select('*').eq('slug', input.threadId).single();
  const threadRow = threadResult.data as DbThread | null;

  if (!threadRow) return { error: 'thread not found' };

  const postNumber = (threadRow.reply_count ?? 0) + 2;

  const { data, error } = await db
    .from('replies')
    .insert({
      thread_id:     threadRow.id,
      body:          input.body,
      author_handle: input.authorHandle,
      author_mode:   input.authorMode,
      post_number:   postNumber,
      reply_to_id:   input.replyToId ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[repository] createReply:', error.message);
    return { error: error.message };
  }

  // Bump thread metadata so the thread sorts to top and shows the correct count.
  const now = new Date().toISOString();
  const { error: updateErr } = await db
    .from('threads')
    .update({
      reply_count:      (threadRow.reply_count ?? 0) + 1,
      last_activity_at: now,
    })
    .eq('id', threadRow.id);

  if (updateErr) {
    // Non-fatal — reply was saved; metadata update failed.
    console.error('[repository] createReply (thread update):', updateErr.message);
  }

  return { id: data.id };
}

// ---------------------------------------------------------------------------
// Write — reactions
// ---------------------------------------------------------------------------

export async function addReaction(
  input: AddReactionInput,
): Promise<{ ok: true } | { error: string }> {
  if (!hasSupabase) return { ok: true };

  const db = getDb()!;
  const { error } = await db.from('reactions').insert({
    target_type:      input.targetType,
    target_id:        input.targetId,
    reaction_type:    input.reactionType,
    anon_fingerprint: input.anonFingerprint,
  });

  // Unique constraint violation (23505) = already reacted — treat as ok
  if (error && error.code !== '23505') {
    console.error('[repository] addReaction:', error.message);
    return { error: error.message };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Write — reports
// ---------------------------------------------------------------------------

export async function reportContent(
  input: ReportContentInput,
): Promise<{ ok: true } | { error: string }> {
  if (!hasSupabase) return { ok: true };

  const db = getDb()!;
  const { error } = await db.from('reports').insert({
    target_type: input.targetType,
    target_id:   input.targetId,
    reason:      input.reason,
    details:     input.details ?? null,
  });

  if (error) {
    console.error('[repository] reportContent:', error.message);
    return { error: error.message };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Recovered signals — read
//
// SCRAPER INTEGRATION POINT:
//   Automated scrapers will INSERT rows with status='pending'.
//   Only status='approved' rows are shown on the public /scanner page.
//   Human approval via /scanner/queue is mandatory before any signal goes public.
// ---------------------------------------------------------------------------

export async function getRecoveredSignals(
  status?: RecoveredSignalStatus,
): Promise<DbRecoveredSignal[]> {
  if (!hasSupabase) {
    if (!status) return RECOVERED_SIGNAL_SEED;
    return RECOVERED_SIGNAL_SEED.filter((s) => s.status === status);
  }

  const db = getDb()!;
  let q = db
    .from('recovered_signals')
    .select('*')
    .order('anomaly_score', { ascending: false })
    .order('discovered_at', { ascending: false });
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) {
    console.error('[repository] getRecoveredSignals:', error.message);
    if (!status) return RECOVERED_SIGNAL_SEED;
    return RECOVERED_SIGNAL_SEED.filter((s) => s.status === status);
  }
  return (data ?? []) as DbRecoveredSignal[];
}

export async function getRecoveredSignal(
  id: string,
): Promise<DbRecoveredSignal | undefined> {
  if (!hasSupabase) {
    return RECOVERED_SIGNAL_SEED.find((s) => s.id === id);
  }

  const db = getDb()!;
  const { data, error } = await db
    .from('recovered_signals')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('[repository] getRecoveredSignal:', error?.message);
    return RECOVERED_SIGNAL_SEED.find((s) => s.id === id);
  }
  return data as DbRecoveredSignal;
}

// ---------------------------------------------------------------------------
// Recovered signals — write (curator only, service role key required)
// ---------------------------------------------------------------------------

export interface UpdateSignalStatusInput {
  id:                  string;
  status:              RecoveredSignalStatus;
  publishedThreadId?:  string;
}

export async function updateSignalStatus(
  input: UpdateSignalStatusInput,
): Promise<{ ok: true } | { error: string }> {
  if (!hasSupabase) return { ok: true };

  const db = getDb()!;
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = { status: input.status };
  if (input.status === 'approved') patch.approved_at = now;
  if (input.publishedThreadId) patch.published_thread_id = input.publishedThreadId;

  const { error } = await db
    .from('recovered_signals')
    .update(patch)
    .eq('id', input.id);

  if (error) {
    console.error('[repository] updateSignalStatus:', error.message);
    return { error: error.message };
  }
  return { ok: true };
}

export interface CreateRecoveredSignalInput {
  category:             string;
  title:                string;
  summary:              string;
  sourceName:           string;
  sourceUrl?:           string;
  sourceType:           SignalSourceType;
  anomalyScore:         number;
  tags?:                string[];
  discoveredAt?:        string;
  submittedPublicly?:   boolean;
  sourceImageUrl?:      string;
  mediaUrl?:            string;
  mediaType?:           string;
  attributionText?:     string;
  sourceCaptureNotes?:  string;
}

// ---------------------------------------------------------------------------
// Recovered signals — publish to thread (curator only)
//
// Creates a SWIM thread from a recovered signal in a single server-side
// operation, then stamps the signal with the thread UUID and status='approved'.
// Prevents duplicate publishing if published_thread_id is already set.
//
// HUMAN APPROVAL GATE:
//   This function is the mandatory step between a recovered signal and the
//   public archive. Nothing calls this automatically — a curator must click
//   [ publish to thread ] in /scanner/queue.
// ---------------------------------------------------------------------------

function formatSignalBody(sig: DbRecoveredSignal): string {
  const lines: string[] = [];

  // Recovered excerpt
  lines.push(sig.summary);
  lines.push('');
  lines.push('────────────────────────');
  lines.push('');

  // Scanner analysis block
  lines.push('> SCANNER ANALYSIS');
  lines.push(`> Category: ${sig.category}`);
  lines.push(`> Anomaly score: ${sig.anomaly_score}/10`);
  lines.push(`> Discovered: ${sig.discovered_at.slice(0, 10)}`);
  lines.push(`> Source type: ${sig.source_type}`);
  lines.push('');

  // Source attribution block
  lines.push('> SOURCE ATTRIBUTION');
  lines.push(`> Source: ${sig.source_name}`);
  if (sig.attribution_text) {
    lines.push(`> ${sig.attribution_text}`);
  }
  if (sig.source_url) {
    lines.push(`> URL: ${sig.source_url}`);
  }

  // Evidence
  if (sig.source_image_url) {
    lines.push(`> Image: ${sig.source_image_url}`);
  }

  // Capture notes (brief only)
  if (sig.source_capture_notes && sig.source_capture_notes.length < 180) {
    lines.push('');
    lines.push('> CAPTURE NOTES');
    lines.push(`> ${sig.source_capture_notes}`);
  }

  const publicTags = (sig.tags ?? []).filter((t) => t !== 'recovered-signal');
  if (publicTags.length > 0) {
    lines.push('');
    lines.push(`tags: ${publicTags.join(' · ')}`);
  }

  lines.push(
    '',
    '[ curator note: add context about how this signal was found and why it matters — remove this line before going live ]',
  );

  return lines.join('\n');
}

export async function publishSignalAsThread(
  signalId: string,
): Promise<{ threadSlug: string } | { error: string }> {
  if (!hasSupabase) {
    const sig = RECOVERED_SIGNAL_SEED.find((s) => s.id === signalId);
    if (!sig) return { error: 'signal not found' };
    // Mock: return a fake slug so the UI can display the success state
    return { threadSlug: `th-local-${Date.now()}` };
  }

  const db = getDb()!;

  // 1. Fetch the signal
  const { data: sigData, error: sigErr } = await db
    .from('recovered_signals')
    .select('*')
    .eq('id', signalId)
    .single();

  if (sigErr || !sigData) {
    return { error: sigErr?.message ?? 'signal not found' };
  }
  const sig = sigData as DbRecoveredSignal;

  // 2. Prevent duplicate publishing
  if (sig.published_thread_id) {
    return { error: 'signal already published to a thread' };
  }

  // 3. Create the thread — select both UUID (for the FK) and slug (for the link)
  const slug = `${Date.now()}-${sig.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)}`;
  const now = new Date().toISOString();

  const { data: threadData, error: threadErr } = await db
    .from('threads')
    .insert({
      slug,
      title:            sig.title,
      body:             formatSignalBody(sig),
      category:         sig.category,
      author_handle:    'ARCHIVIST',
      author_mode:      'ghost',
      tags:             [...(sig.tags ?? []), 'recovered-signal'],
      last_activity_at: now,
    })
    .select('id, slug')
    .single();

  if (threadErr || !threadData) {
    console.error('[repository] publishSignalAsThread (thread insert):', threadErr?.message);
    return { error: threadErr?.message ?? 'thread creation failed' };
  }

  // 4. Stamp the signal: status='approved', approved_at, published_thread_id=UUID
  const { error: updateErr } = await db
    .from('recovered_signals')
    .update({
      status:               'approved',
      approved_at:          now,
      published_thread_id:  threadData.id,
    })
    .eq('id', signalId);

  if (updateErr) {
    // Thread was created — non-fatal. Log and still return success so the
    // curator can navigate to the new thread.
    console.error('[repository] publishSignalAsThread (signal update):', updateErr.message);
  }

  return { threadSlug: threadData.slug };
}

// ---------------------------------------------------------------------------
// Recovered signals — rebirth as thread (curator-edited publish)
//
// Like publishSignalAsThread but uses curator-provided title/body/category/tags
// rather than auto-generating them from the signal. The curator edits the content
// in the RebirthPanel before clicking [ rebirth as thread ].
//
// HUMAN APPROVAL GATE: identical to publishSignalAsThread.
// ---------------------------------------------------------------------------

export interface RebirthSignalInput {
  signalId:  string;
  title:     string;
  body:      string;
  category:  string;
  tags:      string[];
}

export async function rebirthSignalAsThread(
  input: RebirthSignalInput,
): Promise<{ threadSlug: string } | { error: string }> {
  if (!hasSupabase) {
    return { threadSlug: `th-rebirth-${Date.now()}` };
  }

  const db = getDb()!;

  // 1. Verify signal exists and hasn't already been published
  const { data: sigData, error: sigErr } = await db
    .from('recovered_signals')
    .select('id, published_thread_id')
    .eq('id', input.signalId)
    .single();

  if (sigErr || !sigData) {
    return { error: sigErr?.message ?? 'signal not found' };
  }
  if ((sigData as { published_thread_id: string | null }).published_thread_id) {
    return { error: 'signal already reborn into a thread' };
  }

  // 2. Create the thread with curator-edited content
  const slug = `${Date.now()}-${input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)}`;
  const now = new Date().toISOString();

  const { data: threadData, error: threadErr } = await db
    .from('threads')
    .insert({
      slug,
      title:            input.title,
      body:             input.body,
      category:         input.category,
      author_handle:    'ARCHIVIST',
      author_mode:      'ghost' as const,
      tags:             [...new Set([...input.tags, 'recovered-signal'])],
      last_activity_at: now,
    })
    .select('id, slug')
    .single();

  if (threadErr || !threadData) {
    console.error('[repository] rebirthSignalAsThread (thread insert):', threadErr?.message);
    return { error: threadErr?.message ?? 'thread creation failed' };
  }

  // 3. Stamp the signal: approved + thread UUID
  const { error: updateErr } = await db
    .from('recovered_signals')
    .update({
      status:              'approved',
      approved_at:         now,
      published_thread_id: threadData.id,
    })
    .eq('id', input.signalId);

  if (updateErr) {
    console.error('[repository] rebirthSignalAsThread (signal update):', updateErr.message);
  }

  return { threadSlug: threadData.slug };
}

// ---------------------------------------------------------------------------
// Scanner stats — public aggregate counts for /scanner activity layer
// ---------------------------------------------------------------------------

export interface ScannerStats {
  totalRecovered:    number;
  pendingReview:     number;
  threadsReborn:     number;
  publicSubmissions: number;
}

export async function getScannerStats(): Promise<ScannerStats> {
  if (!hasSupabase) {
    return { totalRecovered: 847, pendingReview: 12, threadsReborn: 34, publicSubmissions: 218 };
  }

  const db = getDb()!;
  const { data, error } = await db
    .from('recovered_signals')
    .select('status, published_thread_id, submitted_publicly');

  if (error || !data) {
    console.error('[repository] getScannerStats:', error?.message);
    return { totalRecovered: 0, pendingReview: 0, threadsReborn: 0, publicSubmissions: 0 };
  }

  const rows = data as Array<{
    status:              string;
    published_thread_id: string | null;
    submitted_publicly:  boolean;
  }>;

  return {
    totalRecovered:    rows.length,
    pendingReview:     rows.filter((r) => r.status === 'pending').length,
    threadsReborn:     rows.filter((r) => Boolean(r.published_thread_id)).length,
    publicSubmissions: rows.filter((r) => r.submitted_publicly).length,
  };
}

// ---------------------------------------------------------------------------
// Recovered signals — curator notes (curator only)
//
// curator_notes is a local-only annotation field. It is never shown publicly.
// Requires the curator_notes TEXT column — see schema migration note in types.ts.
// ---------------------------------------------------------------------------

export async function updateCuratorNotes(
  id:    string,
  notes: string,
): Promise<{ ok: true } | { error: string }> {
  if (!hasSupabase) return { ok: true };

  const db = getDb()!;
  const { error } = await db
    .from('recovered_signals')
    .update({ curator_notes: notes })
    .eq('id', id);

  if (error) {
    console.error('[repository] updateCuratorNotes:', error.message);
    return { error: error.message };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Scanner source registry
//
// STATUS: REGISTRY ONLY — no automated fetchers connected.
// These functions manage the list of candidate sources. Enabling a source
// in this registry does NOT trigger any automated fetch — that is a future phase.
// ---------------------------------------------------------------------------

export interface CreateScannerSourceInput {
  name:              string;
  source_type:       string;
  base_url?:         string;
  description?:      string;
  category_focus?:   string[];
  risk_level?:       ScannerRiskLevel;
  refresh_cadence?:  string;
  attribution_rules?: string;
}

export interface UpdateScannerSourceInput {
  id:                string;
  name?:             string;
  source_type?:      string;
  base_url?:         string | null;
  description?:      string | null;
  category_focus?:   string[];
  risk_level?:       ScannerRiskLevel;
  refresh_cadence?:  string | null;
  attribution_rules?: string | null;
}

// ---------------------------------------------------------------------------
// Duplicate detection — used by the manual fetch pipeline before inserting
// a new candidate signal. Checks both exact URL match and title similarity.
// ---------------------------------------------------------------------------

export async function checkSignalDuplicates(
  sourceUrl: string,
  title:     string,
): Promise<Array<{ id: string; title: string; source_url: string | null; status: string }>> {
  if (!hasSupabase) return [];

  const db = getDb()!;
  type Row = { id: string; title: string; source_url: string | null; status: string };
  const seen = new Set<string>();
  const results: Row[] = [];

  // 1. Exact URL match
  if (sourceUrl) {
    const { data: urlRows } = await db
      .from('recovered_signals')
      .select('id, title, source_url, status')
      .eq('source_url', sourceUrl)
      .limit(5);
    for (const row of (urlRows ?? []) as Row[]) {
      if (!seen.has(row.id)) { seen.add(row.id); results.push(row); }
    }
  }

  // 2. Title similarity — first 40 chars, case-insensitive
  const fragment = title.trim().slice(0, 40);
  if (fragment.length >= 10) {
    const { data: titleRows } = await db
      .from('recovered_signals')
      .select('id, title, source_url, status')
      .ilike('title', `%${fragment}%`)
      .limit(5);
    for (const row of (titleRows ?? []) as Row[]) {
      if (!seen.has(row.id)) { seen.add(row.id); results.push(row); }
    }
  }

  return results;
}

/**
 * Batch freshness check — returns the set of all source_url values already in
 * recovered_signals (any status). Used to pre-filter candidates before attempting
 * individual duplicate checks.
 */
export async function getExistingSignalUrls(): Promise<Set<string>> {
  if (!hasSupabase) return new Set();

  const db = getDb()!;
  type Row = { source_url: string | null };
  const { data } = await db
    .from('recovered_signals')
    .select('source_url')
    .not('source_url', 'is', null);

  const urls = new Set<string>();
  for (const row of (data ?? []) as Row[]) {
    if (row.source_url) urls.add(row.source_url);
  }
  return urls;
}

export async function getScannerSource(id: string): Promise<DbScannerSource | undefined> {
  if (!hasSupabase) return SCANNER_SOURCES_SEED.find((s) => s.id === id);

  const db = getDb()!;
  const { data, error } = await db
    .from('scanner_sources')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('[repository] getScannerSource:', error?.message);
    return SCANNER_SOURCES_SEED.find((s) => s.id === id);
  }
  return data as DbScannerSource;
}

export async function updateScannerSourceLastScanned(id: string): Promise<void> {
  if (!hasSupabase) return;

  const db = getDb()!;
  const { error } = await db
    .from('scanner_sources')
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[repository] updateScannerSourceLastScanned:', error.message);
  }
}

export async function getScannerSources(): Promise<DbScannerSource[]> {
  if (!hasSupabase) return SCANNER_SOURCES_SEED;

  const db = getDb()!;
  const { data, error } = await db
    .from('scanner_sources')
    .select('*')
    .order('risk_level', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[repository] getScannerSources:', error.message);
    return SCANNER_SOURCES_SEED;
  }
  return (data ?? []) as DbScannerSource[];
}

export async function createScannerSource(
  input: CreateScannerSourceInput,
): Promise<{ id: string } | { error: string }> {
  if (!hasSupabase) {
    return { id: `src-local-${Date.now()}` };
  }

  const db = getDb()!;
  const { data, error } = await db
    .from('scanner_sources')
    .insert({
      name:              input.name,
      source_type:       input.source_type ?? 'other',
      base_url:          input.base_url ?? null,
      description:       input.description ?? null,
      category_focus:    input.category_focus ?? [],
      risk_level:        input.risk_level ?? 'low',
      refresh_cadence:   input.refresh_cadence ?? null,
      attribution_rules: input.attribution_rules ?? null,
      enabled:           false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[repository] createScannerSource:', error.message);
    return { error: error.message };
  }
  return { id: data.id };
}

export async function updateScannerSource(
  input: UpdateScannerSourceInput,
): Promise<{ ok: true } | { error: string }> {
  if (!hasSupabase) return { ok: true };

  const db = getDb()!;
  const patch: Record<string, unknown> = {};
  if (input.name             !== undefined) patch.name              = input.name;
  if (input.source_type      !== undefined) patch.source_type       = input.source_type;
  if (input.base_url         !== undefined) patch.base_url          = input.base_url;
  if (input.description      !== undefined) patch.description       = input.description;
  if (input.category_focus   !== undefined) patch.category_focus    = input.category_focus;
  if (input.risk_level       !== undefined) patch.risk_level        = input.risk_level;
  if (input.refresh_cadence  !== undefined) patch.refresh_cadence   = input.refresh_cadence;
  if (input.attribution_rules !== undefined) patch.attribution_rules = input.attribution_rules;

  const { error } = await db
    .from('scanner_sources')
    .update(patch)
    .eq('id', input.id);

  if (error) {
    console.error('[repository] updateScannerSource:', error.message);
    return { error: error.message };
  }
  return { ok: true };
}

export async function toggleScannerSource(
  id:      string,
  enabled: boolean,
): Promise<{ ok: true } | { error: string }> {
  if (!hasSupabase) return { ok: true };

  const db = getDb()!;
  const { error } = await db
    .from('scanner_sources')
    .update({ enabled })
    .eq('id', id);

  if (error) {
    console.error('[repository] toggleScannerSource:', error.message);
    return { error: error.message };
  }
  return { ok: true };
}

// SCRAPER INTEGRATION POINT:
//   Future automated scrapers call this to submit signals for curator review.
//   All signals are inserted with status='pending' regardless of the caller.
export async function createRecoveredSignal(
  input: CreateRecoveredSignalInput,
): Promise<{ id: string } | { error: string }> {
  if (!hasSupabase) {
    return { id: `sig-local-${Date.now()}` };
  }

  const db = getDb()!;
  const { data, error } = await db
    .from('recovered_signals')
    .insert({
      category:             input.category,
      title:                input.title,
      summary:              input.summary,
      source_name:          input.sourceName,
      source_url:           input.sourceUrl ?? null,
      source_type:          input.sourceType,
      status:               'pending',
      anomaly_score:        input.anomalyScore,
      tags:                 input.tags ?? [],
      discovered_at:        input.discoveredAt ?? new Date().toISOString(),
      submitted_publicly:   input.submittedPublicly ?? false,
      source_image_url:     input.sourceImageUrl ?? null,
      media_url:            input.mediaUrl ?? null,
      media_type:           input.mediaType ?? null,
      attribution_text:     input.attributionText ?? null,
      source_capture_notes: input.sourceCaptureNotes ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[repository] createRecoveredSignal:', error.message);
    const colMatch = error.message.match(/column "([^"]+)" of relation "recovered_signals" does not exist/);
    if (colMatch) {
      return { error: `Missing Supabase column: ${colMatch[1]}. Run the recovered_signals migration.` };
    }
    return { error: error.message };
  }
  return { id: data.id };
}
