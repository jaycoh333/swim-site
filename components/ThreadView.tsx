'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { AmbientGrid } from '@/components/AmbientGrid';
import { ThreadPost } from '@/components/ThreadPost';
import { mockDb } from '@/lib/mock-db';
import { CATEGORY_COLORS } from '@/lib/forum-types';
import type { Reply, ThreadContent } from '@/lib/forum-types';
import { useIdentity } from '@/lib/identity';
import { createReplyAction } from '@/app/actions';

interface ThreadViewProps {
  threadId: string;
  initialThread?: ThreadContent;
  initialReplies?: Reply[];
}

export function ThreadView({
  threadId,
  initialThread,
  initialReplies = [],
}: ThreadViewProps) {
  const thread = useMemo(
    () => initialThread ?? mockDb.getThread(threadId),
    [threadId, initialThread],
  );
  const seedReplies = useMemo(
    () => (initialReplies.length > 0 ? initialReplies : mockDb.getThreadReplies(threadId)),
    [threadId, initialReplies],
  );

  const [localReplies, setLocalReplies] = useState<Reply[]>([]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [justPosted, setJustPosted] = useState(false);
  const { identity, setMode } = useIdentity();

  const allReplies = useMemo(
    () => [...seedReplies, ...localReplies],
    [seedReplies, localReplies],
  );

  const submitReply = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || !identity || submitting) return;

    setReplyError(null);
    setSubmitting(true);

    const result = await createReplyAction({
      threadId,
      body:         trimmed,
      authorHandle: identity.handle,
      authorMode:   identity.mode,
    });

    setSubmitting(false);

    if ('error' in result) {
      setReplyError(result.error);
      return;
    }

    const reply: Reply = {
      id:           result.id,
      threadId,
      postNumber:   1 + allReplies.length + 1,
      body:         trimmed,
      createdAt:    'just now',
      authorHandle: identity.handle,
      authorMode:   identity.mode,
      reactions:    { echo: 0, dive: 0, ripple: 0, witness: 0, signal: 0 },
    };
    setLocalReplies((prev) => [...prev, reply]);
    setBody('');

    // Brief success flash
    setJustPosted(true);
    setTimeout(() => setJustPosted(false), 2800);
  }, [body, identity, threadId, allReplies.length, submitting]);

  if (!thread) {
    return (
      <div className="relative min-h-screen pt-[80px] md:pt-[100px]">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <div className="text-[13px] uppercase tracking-[0.28em] text-crt/40">
            thread not found in archive
          </div>
          <div className="mt-5">
            <Link
              href="/threads"
              className="text-[13px] uppercase tracking-[0.22em] text-crt/55 hover:text-crt transition-colors"
            >
              ← return to threads
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const categoryColor = CATEGORY_COLORS[thread.category] ?? '#86d46e';
  const totalPosts = 1 + allReplies.length;
  const totalReactions = Object.values(thread.reactions).reduce((a, b) => a + b, 0);

  return (
    <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[80px] md:pb-8 md:pt-[100px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-15" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-5 md:px-6 md:py-8">

        {/* ── Breadcrumb ── */}
        <div className="mb-3 flex items-center gap-2 text-[12px] uppercase tracking-[0.18em]">
          <Link href="/" className="text-crt/48 hover:text-crt/75 transition-colors">
            ← index
          </Link>
          <span className="text-crt/22">/</span>
          <Link href="/threads" className="text-crt/48 hover:text-crt/75 transition-colors">
            threads
          </Link>
          <span className="text-crt/22">/</span>
          <Link
            href={`/threads?category=${encodeURIComponent(thread.category)}`}
            className="px-1.5 py-0.5 text-[11px] transition-opacity hover:opacity-80"
            style={{
              border:     `1px solid color-mix(in srgb, ${categoryColor} 35%, transparent)`,
              color:      categoryColor,
              background: `color-mix(in srgb, ${categoryColor} 6%, rgba(7,12,9,0.96))`,
            }}
          >
            {thread.category}
          </Link>
        </div>

        {/* ── Thread shell ── */}
        <div className="forum-shell overflow-hidden">

          {/* Thread header */}
          <div className="border-b border-crt/12 px-4 py-4 md:px-5 md:py-5">
            <h1 className="thread-view-title">{thread.title}</h1>

            {/* Activity strip */}
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] uppercase tracking-[0.16em] text-crt/45">
              <span>{totalPosts} {totalPosts === 1 ? 'post' : 'posts'}</span>
              <span>{thread.viewCount} views</span>
              {totalReactions > 0 && (
                <span className="text-crt/50">~ {totalReactions} echoes</span>
              )}
              <span className="text-crt/28">↯ last signal: {thread.lastActivityAt}</span>
              {thread.pinned && <span className="text-crt/55">■ pinned</span>}
            </div>
          </div>

          {/* OP post */}
          <ThreadPost post={thread} postNumber={1} isOP />

          {/* Divider */}
          <div className="thread-divider" />

          {/* Reply list */}
          {allReplies.map((reply, idx) => (
            <ThreadPost
              key={reply.id}
              post={reply}
              postNumber={reply.postNumber ?? idx + 2}
            />
          ))}

          {/* ── Reply Composer ── */}
          <div className="reply-composer">
            <div className="mb-3 text-[13px] uppercase tracking-[0.22em] text-crt/62">
              reply to thread
            </div>

            {/* Identity selector */}
            <div className="composer-identity-row">
              <span className="text-crt/45">posting as:</span>
              <button
                onClick={() => setMode('anon')}
                className={`composer-mode-btn ${identity?.mode === 'anon' ? 'active' : ''}`}
              >
                [ anon ]
              </button>
              <button
                onClick={() => setMode('ghost')}
                className={`composer-mode-btn ${identity?.mode === 'ghost' ? 'active' : ''}`}
              >
                [ ghost ]
              </button>
              {identity && (
                <span className="text-crt/55 ml-1">{identity.handle}</span>
              )}
            </div>

            {/* Textarea */}
            <textarea
              className="composer-textarea"
              rows={4}
              placeholder="type your reply... › use > for greentext · ctrl+enter to post"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitReply();
              }}
              disabled={submitting}
            />

            {/* Success flash */}
            {justPosted && (
              <div className="mt-2 px-3 py-2 text-[12px] uppercase tracking-[0.20em] text-crt/72 border border-crt/20 bg-crt/[0.04]">
                ✓ reply archived · your signal is heard
              </div>
            )}

            {/* Error */}
            {replyError && (
              <div className="mt-2 border border-red-900/40 bg-[rgba(40,10,10,0.6)] px-3 py-2 text-[12px] uppercase tracking-[0.18em] text-red-400/80">
                › {replyError}
              </div>
            )}

            {/* Submit row */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[11px] uppercase tracking-[0.16em] text-crt/35">
                ctrl+enter · no account · no tracking
              </span>
              <button
                onClick={submitReply}
                disabled={!body.trim() || submitting}
                className="composer-submit w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? '↯ sending...' : '[ post reply ]'}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom navigation */}
        <div className="mt-5 flex items-center justify-between text-[14px] uppercase tracking-[0.16em] text-crt/48">
          <Link href="/threads" className="hover:text-crt/72 transition-colors">
            ← all threads
          </Link>
          <a href="#post-1" className="hover:text-crt/72 transition-colors">
            ↑ top
          </a>
        </div>
      </div>
    </div>
  );
}
