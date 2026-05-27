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
import { ShareBar } from '@/components/ShareBar';
import { parseThreadMeta, getEraClass } from '@/lib/thread-meta';

const SITE_BASE = 'https://www.sw1m.me';

function buildThreadShareText(thread: ThreadContent): string {
  const url = `${SITE_BASE}/threads/${thread.id}`;
  const title = thread.title.length > 100 ? thread.title.slice(0, 97) + '...' : thread.title;
  return `RECOVERED SIGNAL // ${thread.category.toUpperCase()}\n"${title}"\n\nswim archive: ${url}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RecoveredExcerptBlock({ excerpt, eraClass }: { excerpt: string; eraClass: string }) {
  if (!excerpt) return null;
  return (
    <div className="recovered-excerpt-wrap">
      <blockquote className={`recovered-excerpt-quote ${eraClass}`}>
        {excerpt}
      </blockquote>
      <p className="recovered-excerpt-caption">
        ↯ Recovered from archived internet source.
      </p>
    </div>
  );
}

function ScannerAnalysisPanel({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="scanner-panel">
      <div className="scanner-panel-label">SWIM SCANNER ANALYSIS</div>
      <div className="scanner-panel-lines">
        {lines.map((line, i) => (
          <div key={i} className="scanner-panel-line">
            <span className="scanner-panel-bullet">›</span>
            <span>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceEvidencePanel({
  sourceUrl, sourceImageUrl, sourceName, captureLines,
}: {
  sourceUrl: string | null;
  sourceImageUrl: string | null;
  sourceName: string | null;
  captureLines: string[];
}) {
  const hasContent = sourceUrl || sourceImageUrl || captureLines.length > 0;
  if (!hasContent) return null;
  return (
    <details className="source-evidence-panel">
      <summary className="source-evidence-summary">[ original source evidence ]</summary>
      <div className="source-evidence-body">
        {sourceName && (
          <div className="source-evidence-row">
            <span className="source-evidence-key">source</span>
            <span>{sourceName}</span>
          </div>
        )}
        {sourceUrl && (
          <div className="source-evidence-row">
            <span className="source-evidence-key">url</span>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="source-evidence-link"
            >
              {sourceUrl.length > 72 ? sourceUrl.slice(0, 72) + '…' : sourceUrl}
            </a>
          </div>
        )}
        {sourceImageUrl && (
          <div className="source-evidence-row">
            <span className="source-evidence-key">image</span>
            <span className="text-crt/55 break-all">{sourceImageUrl}</span>
          </div>
        )}
        {captureLines.map((line, i) => (
          <div key={i} className="source-evidence-row">
            {i === 0 && <span className="source-evidence-key">notes</span>}
            {i > 0  && <span className="source-evidence-key" />}
            <span className="text-crt/55">{line}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function RelatedSignals({ threads }: { threads: ThreadContent[] }) {
  if (!threads.length) return null;
  return (
    <div className="related-signals-section">
      <div className="related-signals-label">Related Signals</div>
      <div className="related-signals-grid">
        {threads.map((t) => {
          const color = CATEGORY_COLORS[t.category] ?? '#86d46e';
          return (
            <Link
              key={t.id}
              href={`/threads/${t.id}`}
              className="related-signal-card"
            >
              <div className="related-signal-title">{t.title}</div>
              <div className="related-signal-meta">
                <span style={{ color: `color-mix(in srgb, ${color} 72%, transparent)` }}>
                  {t.category}
                </span>
                <span>{t.createdAt?.slice(0, 10) ?? ''}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ThreadFooter({
  sourceEra, sourceName, createdAt,
}: {
  sourceEra: string | null;
  sourceName: string | null;
  createdAt: string;
}) {
  return (
    <div className="recovered-thread-footer">
      <span className="recovered-footer-label">Recovered by SWIM AI Signal Scanner</span>
      <div className="recovered-footer-meta">
        {sourceEra && <span>Archive era: {sourceEra}</span>}
        {sourceName && <span>Source: {sourceName}</span>}
        <span>Discovered: {createdAt.slice(0, 10)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ThreadViewProps {
  threadId: string;
  initialThread?: ThreadContent;
  initialReplies?: Reply[];
  relatedThreads?: ThreadContent[];
}

export function ThreadView({
  threadId,
  initialThread,
  initialReplies = [],
  relatedThreads = [],
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

  const meta = parseThreadMeta(thread.body);
  const eraClass = getEraClass(meta.sourceEra);

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
        <div className={`forum-shell overflow-hidden ${eraClass}`}>

          {/* ── Thread header ── */}
          <div className="border-b border-crt/12 px-4 py-4 md:px-5 md:py-5">
            <h1 className="thread-view-title">{thread.title}</h1>

            {/* TASK 1 — Recovered signal hero metadata */}
            {meta.isRecoveredSignal && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {meta.sourceEra && (
                    <span className="era-badge-inline">{meta.sourceEra.toUpperCase()}</span>
                  )}
                  {meta.archiveYear && (
                    <span className="archive-year-badge">{meta.archiveYear}</span>
                  )}
                  <span className="origin-signal-badge">ORIGIN SIGNAL</span>
                  {meta.sourceName && (
                    <span className="source-name-inline">↯ {meta.sourceName}</span>
                  )}
                </div>
                <p className="text-[12px] uppercase tracking-[0.20em] text-crt/42">
                  Recovered from archived internet source.
                </p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-crt/28">
                  Signal recovered: {thread.createdAt?.slice(0, 10) ?? ''}
                </p>
              </div>
            )}

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

            {/* Share bar */}
            <div className="mt-4 border-t border-crt/8 pt-4">
              <ShareBar
                shareText={buildThreadShareText(thread)}
                shareUrl={`${SITE_BASE}/threads/${thread.id}`}
                label="share signal"
              />
            </div>
          </div>

          {/* TASK 2 — Recovered excerpt block */}
          {meta.isRecoveredSignal && meta.excerpt && (
            <RecoveredExcerptBlock excerpt={meta.excerpt} eraClass={eraClass} />
          )}

          {/* TASK 3 — Scanner analysis panel */}
          {meta.isRecoveredSignal && (
            <ScannerAnalysisPanel lines={meta.scannerLines} />
          )}

          {/* TASK 6 — Source evidence panel */}
          {meta.isRecoveredSignal && (
            <SourceEvidencePanel
              sourceUrl={meta.sourceUrl}
              sourceImageUrl={meta.sourceImageUrl}
              sourceName={meta.sourceName}
              captureLines={meta.captureLines}
            />
          )}

          {/* OP post — body starts after excerpt for recovered threads */}
          <ThreadPost
            post={thread}
            postNumber={1}
            isOP
            hideExcerpt={meta.isRecoveredSignal}
          />

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

        {/* TASK 4 — Related signals */}
        {relatedThreads.length > 0 && (
          <RelatedSignals threads={relatedThreads} />
        )}

        {/* TASK 8 — Thread footer (recovered only) */}
        {meta.isRecoveredSignal && (
          <ThreadFooter
            sourceEra={meta.sourceEra}
            sourceName={meta.sourceName}
            createdAt={thread.createdAt ?? ''}
          />
        )}

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
