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
import type { DbThread, DbReply, ReactionType } from './types';

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
  const { data, error } = await db
    .from('threads')
    .insert({
      slug,
      title:         input.title,
      body:          input.body,
      category:      input.category,
      author_handle: input.authorHandle,
      author_mode:   input.authorMode,
      tags:          input.tags ?? [],
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
      thread_id:    threadRow.id,
      body:         input.body,
      author_handle: input.authorHandle,
      author_mode:  input.authorMode,
      post_number:  postNumber,
      reply_to_id:  input.replyToId ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[repository] createReply:', error.message);
    return { error: error.message };
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
