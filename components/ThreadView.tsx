'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { AmbientGrid } from '@/components/AmbientGrid';
import { ThreadPost } from '@/components/ThreadPost';
import { mockDb } from '@/lib/mock-db';
import { CATEGORY_COLORS } from '@/lib/forum-types';
import { Reply } from '@/lib/forum-types';
import { useIdentity } from '@/lib/identity';

interface ThreadViewProps {
  threadId: string;
}

let localReplyCounter = 100;

export function ThreadView({ threadId }: ThreadViewProps) {
  const thread = useMemo(() => mockDb.getThread(threadId), [threadId]);
  const seedReplies = useMemo(() => mockDb.getThreadReplies(threadId), [threadId]);
  const [localReplies, setLocalReplies] = useState<Reply[]>([]);
  const [body, setBody] = useState('');
  const { identity, setMode } = useIdentity();

  const allReplies = useMemo(
    () => [...seedReplies, ...localReplies],
    [seedReplies, localReplies],
  );

  const submitReply = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed || !identity) return;
    const reply: Reply = {
      id: `local-${++localReplyCounter}`,
      threadId,
      postNumber: 1 + allReplies.length + 1,
      body: trimmed,
      createdAt: 'just now',
      authorHandle: identity.handle,
      authorMode: identity.mode,
      reactions: { echo: 0, dive: 0, ripple: 0, witness: 0, signal: 0 },
    };
    setLocalReplies((prev) => [...prev, reply]);
    setBody('');
  }, [body, identity, threadId, allReplies.length]);

  if (!thread) {
    return (
      <div className="relative min-h-screen pt-[52px]">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <div className="text-[11px] uppercase tracking-[0.3em] text-crt/30">
            thread not found in archive
          </div>
          <div className="mt-4">
            <Link href="/" className="text-[11px] uppercase tracking-[0.24em] text-crt/45 hover:text-crt transition-colors">
              ← return to index
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const categoryColor = CATEGORY_COLORS[thread.category] ?? '#86d46e';
  const totalPosts = 1 + allReplies.length;

  return (
    <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[52px] md:pb-8">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-15" />

      <div className="relative z-10 mx-auto max-w-4xl px-3 py-4 md:px-4 md:py-6">

        {/* ── Breadcrumb ─── */}
        <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]">
          <Link
            href="/"
            className="text-crt/38 hover:text-crt/70 transition-colors"
          >
            ← index
          </Link>
          <span className="text-crt/18">/</span>
          <Link
            href="/threads"
            className="text-crt/38 hover:text-crt/70 transition-colors"
          >
            threads
          </Link>
          <span className="text-crt/18">/</span>
          <span
            className="px-1.5 py-0.5 text-[9px]"
            style={{
              border: `1px solid color-mix(in srgb, ${categoryColor} 35%, transparent)`,
              color: categoryColor,
              background: `color-mix(in srgb, ${categoryColor} 6%, rgba(7,12,9,0.96))`,
            }}
          >
            {thread.category}
          </span>
        </div>

        {/* ── Thread shell ─── */}
        <div className="forum-shell overflow-hidden">

          {/* Thread header */}
          <div className="border-b border-crt/12 px-4 py-4 md:px-5 md:py-5">
            <h1 className="thread-view-title">{thread.title}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.2em] text-crt/30">
              <span>{totalPosts} posts</span>
              <span>{thread.viewCount} views</span>
              <span>last: {thread.lastActivityAt}</span>
              {thread.pinned && (
                <span className="text-crt/50">■ pinned</span>
              )}
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

          {/* ── Reply Composer ─── */}
          <div className="reply-composer">
            <div className="mb-3 text-[11px] uppercase tracking-[0.26em] text-crt/50">
              reply to this thread
            </div>

            {/* Identity selector */}
            <div className="composer-identity-row">
              <span className="text-crt/28">posting as:</span>
              <button
                onClick={() => setMode('anon')}
                className={`composer-mode-btn ${identity?.mode === 'anon' ? 'active' : ''}`}
              >
                [ true anon ]
              </button>
              <button
                onClick={() => setMode('ghost')}
                className={`composer-mode-btn ${identity?.mode === 'ghost' ? 'active' : ''}`}
              >
                [ ghost handle ]
              </button>
              {identity && (
                <span className="text-crt/45 ml-1">
                  {identity.handle}
                </span>
              )}
            </div>

            {/* Textarea */}
            <textarea
              className="composer-textarea"
              rows={5}
              placeholder={`type your reply... (use > for greentext)`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitReply();
              }}
            />

            {/* Submit row */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.18em] text-crt/22">
                ctrl+enter to post · no account needed · no tracking
              </span>
              <button
                onClick={submitReply}
                disabled={!body.trim()}
                className="composer-submit"
              >
                [ post reply ]
              </button>
            </div>
          </div>
        </div>

        {/* Bottom navigation */}
        <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-crt/30">
          <Link href="/" className="hover:text-crt/60 transition-colors">
            ← back to index
          </Link>
          <a href="#post-1" className="hover:text-crt/60 transition-colors">
            ↑ top of thread
          </a>
        </div>
      </div>
    </div>
  );
}
