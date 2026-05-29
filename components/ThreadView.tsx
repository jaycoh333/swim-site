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
import type { ThreadMeta, ThreadLineageData } from '@/lib/thread-meta';

const SITE_BASE = 'https://www.sw1m.me';

// Categories that warrant the "Internet Artifact — Not Verification" note
const CONSPIRACY_CATEGORIES = new Set([
  'UFOs', 'Paranormal', 'Conspiracy Theory', 'Hidden History', 'Censored History',
  'Redacted Files', 'Whistleblower Files', 'Black Projects', 'Forbidden Tech',
  'Shadow Systems', 'Surveillance State', 'Psyops', 'Dark Web Lore',
  'Occult Archives', 'Internet Mysteries', 'Unsolved Events',
]);

// Source types that always get the disclaimer
const ORIGIN_SOURCE_TYPES = new Set(['wayback', 'bbs', 'archive', 'mediawiki', 'forum', 'erowid']);

function buildThreadShareText(thread: ThreadContent): string {
  const url = `${SITE_BASE}/threads/${thread.id}`;
  const title = thread.title.length > 100 ? thread.title.slice(0, 97) + '...' : thread.title;
  return `RECOVERED SIGNAL // ${thread.category.toUpperCase()}\n"${title}"\n\nswim archive: ${url}`;
}

// ---------------------------------------------------------------------------
// TASK 1: Source-native artifact blocks
// ---------------------------------------------------------------------------

function ArtifactHeader({
  icon, badge, meta, right,
}: {
  icon: string;
  badge: string;
  meta?: string;
  right?: string;
}) {
  return (
    <div className="artifact-header">
      <span className="artifact-source-badge">{icon} {badge}</span>
      {meta && <span>{meta}</span>}
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>
  );
}

function ArtifactFooter({ url, label }: { url: string | null; label: string }) {
  return (
    <div className="artifact-footer">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="source-evidence-link">
          {url.length > 70 ? url.slice(0, 70) + '…' : url}
        </a>
      ) : (
        <span>{label}</span>
      )}
      <span style={{ marginLeft: 'auto', opacity: 0.5 }}>
        internet artifact · unverified
      </span>
    </div>
  );
}

// Reddit artifact
function RedditArtifactBlock({ meta, excerpt }: { meta: ThreadMeta; excerpt: string }) {
  return (
    <div className="artifact-block artifact-block--reddit">
      <ArtifactHeader
        icon="⬡"
        badge={meta.subredditHint ? `Reddit · ${meta.subredditHint}` : 'Reddit'}
        meta="community discussion"
        right={meta.archiveYear ?? undefined}
      />
      <div className="artifact-excerpt">{excerpt}</div>
      <ArtifactFooter url={meta.sourceUrl} label={meta.sourceName ?? 'reddit source'} />
    </div>
  );
}

// Wayback archive artifact
function WaybackArtifactBlock({ meta, excerpt }: { meta: ThreadMeta; excerpt: string }) {
  return (
    <div className="artifact-block artifact-block--wayback">
      <ArtifactHeader
        icon="📦"
        badge="Wayback Machine Archive"
        meta={meta.originalDomain ?? 'archived page'}
      />
      {/* Year + domain hero */}
      {(meta.archiveYear || meta.originalDomain) && (
        <div style={{ padding: '12px 18px 0', display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {meta.archiveYear && (
            <div>
              <div className="artifact-domain-line" style={{ fontSize: 9, letterSpacing: '0.26em' }}>CAPTURED</div>
              <div className="artifact-year-hero">{meta.archiveYear}</div>
            </div>
          )}
          {meta.originalDomain && (
            <div>
              <div className="artifact-domain-line" style={{ fontSize: 9, letterSpacing: '0.26em' }}>ORIGIN DOMAIN</div>
              <div className="artifact-domain-line" style={{ fontSize: 14, fontWeight: 700 }}>{meta.originalDomain}</div>
            </div>
          )}
          {meta.sourceEra && meta.sourceEra !== 'modern source' && (
            <div>
              <div className="artifact-domain-line" style={{ fontSize: 9, letterSpacing: '0.26em' }}>ARCHIVE ERA</div>
              <div className="artifact-domain-line" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{meta.sourceEra}</div>
            </div>
          )}
        </div>
      )}
      <div className="artifact-excerpt">{excerpt}</div>
      <ArtifactFooter url={meta.sourceUrl} label="wayback snapshot" />
    </div>
  );
}

// BBS / textfile artifact
function BbsArtifactBlock({ meta, excerpt }: { meta: ThreadMeta; excerpt: string }) {
  return (
    <div className="artifact-block artifact-block--bbs">
      <ArtifactHeader
        icon="⬡"
        badge="BBS TEXT FILE ARCHIVE"
        meta={meta.sourceName ?? 'bulletin board system'}
      />
      <div className="artifact-bbs-meta">
        {meta.archiveYear && <span>DATE: {meta.archiveYear}</span>}
        {meta.originalDomain && <span>BOARD: {meta.originalDomain}</span>}
        {meta.sourceEra && <span>ERA: {meta.sourceEra.toUpperCase()}</span>}
        <span>FORMAT: PLAIN TEXT</span>
      </div>
      <div className="artifact-excerpt">{excerpt}</div>
      <ArtifactFooter url={meta.sourceUrl} label="bbs archive · text file" />
    </div>
  );
}

// Erowid experience report
function ErowidArtifactBlock({ meta, excerpt }: { meta: ThreadMeta; excerpt: string }) {
  return (
    <div className="artifact-block artifact-block--erowid">
      <ArtifactHeader
        icon="◈"
        badge="Erowid Experience Report"
        meta="archived substance experience"
      />
      <div className="artifact-excerpt">{excerpt}</div>
      <ArtifactFooter url={meta.sourceUrl} label="erowid.org archive" />
    </div>
  );
}

// MediaWiki article
function MediaWikiArtifactBlock({ meta, excerpt }: { meta: ThreadMeta; excerpt: string }) {
  return (
    <div className="artifact-block artifact-block--mediawiki">
      <ArtifactHeader
        icon="⬡"
        badge={meta.sourceName ?? 'MediaWiki Article'}
        meta="wiki article excerpt"
        right={meta.originalDomain ?? undefined}
      />
      <div className="artifact-excerpt">{excerpt}</div>
      <ArtifactFooter url={meta.sourceUrl} label="mediawiki source" />
    </div>
  );
}

// Generic forum thread
function ForumArtifactBlock({ meta, excerpt }: { meta: ThreadMeta; excerpt: string }) {
  return (
    <div className="artifact-block artifact-block--forum">
      <ArtifactHeader
        icon="⬡"
        badge={meta.sourceName ? `Forum · ${meta.sourceName}` : 'Forum Thread'}
        meta={meta.archiveYear ? `archived ${meta.archiveYear}` : 'archived post'}
      />
      <div className="artifact-excerpt">{excerpt}</div>
      <ArtifactFooter url={meta.sourceUrl} label="forum archive" />
    </div>
  );
}

// Generic / fallback
function GenericArtifactBlock({ meta, excerpt, eraClass }: { meta: ThreadMeta; excerpt: string; eraClass: string }) {
  return (
    <div className="recovered-excerpt-wrap">
      <blockquote className={`recovered-excerpt-quote ${eraClass}`}>
        {excerpt}
      </blockquote>
      <p className="recovered-excerpt-caption">
        ↯ Recovered from archived internet source.{meta.sourceName ? ` Source: ${meta.sourceName}.` : ''}
      </p>
    </div>
  );
}

// Dispatch based on source type
function SourceArtifactBlock({
  meta,
  excerpt,
  eraClass,
}: {
  meta: ThreadMeta;
  excerpt: string;
  eraClass: string;
}) {
  if (!excerpt) return null;
  const t = meta.sourceType ?? '';

  if (t === 'reddit') return <RedditArtifactBlock meta={meta} excerpt={excerpt} />;
  if (t === 'wayback' || t === 'archive') return <WaybackArtifactBlock meta={meta} excerpt={excerpt} />;
  if (t === 'bbs') return <BbsArtifactBlock meta={meta} excerpt={excerpt} />;
  if (t === 'erowid' || (meta.sourceUrl ?? '').includes('erowid.org')) {
    return <ErowidArtifactBlock meta={meta} excerpt={excerpt} />;
  }
  if (t === 'mediawiki') return <MediaWikiArtifactBlock meta={meta} excerpt={excerpt} />;
  if (t === 'forum' || t === 'imageboard' || t === 'archive_forum') {
    return <ForumArtifactBlock meta={meta} excerpt={excerpt} />;
  }
  return <GenericArtifactBlock meta={meta} excerpt={excerpt} eraClass={eraClass} />;
}

// ---------------------------------------------------------------------------
// TASK 3: Source era hero — more prominent than before
// ---------------------------------------------------------------------------

function SourceEraHero({ meta }: { meta: ThreadMeta }) {
  const hasEra   = meta.sourceEra && meta.sourceEra !== 'modern source';
  const hasYear  = !!meta.archiveYear;
  const hasType  = !!meta.sourceType;
  const hasDomain = !!meta.originalDomain;

  if (!hasEra && !hasYear && !hasType && !hasDomain) return null;

  return (
    <div className="source-era-hero">
      {hasYear && (
        <div className="source-era-hero-item">
          <span className="source-era-hero-label">First Seen</span>
          <span className="source-era-hero-year">{meta.archiveYear}</span>
        </div>
      )}
      {hasEra && (
        <div className="source-era-hero-item">
          <span className="source-era-hero-label">Archive Era</span>
          <span className="source-era-hero-value">{meta.sourceEra}</span>
        </div>
      )}
      {hasType && (
        <div className="source-era-hero-item">
          <span className="source-era-hero-label">Source Type</span>
          <span className="source-era-hero-value">{meta.sourceType}</span>
        </div>
      )}
      {hasDomain && (
        <div className="source-era-hero-item">
          <span className="source-era-hero-label">Origin Domain</span>
          <span className="source-era-hero-value" style={{ textTransform: 'none', letterSpacing: '0.06em' }}>
            {meta.originalDomain}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TASK 2: Origin trail panel for public thread pages
// ---------------------------------------------------------------------------

function OriginTrailBlock({ lineage }: { lineage: ThreadLineageData }) {
  if (!lineage.trail || lineage.trail.length === 0) return null;

  return (
    <div className="origin-trail-panel">
      <div className="origin-trail-header">
        <span>◈ Signal Lineage</span>
        {lineage.earliestYear && (
          <span style={{ color: 'rgba(215,168,92,0.55)', fontWeight: 700 }}>
            first known archive: {lineage.earliestYear}
          </span>
        )}
        {lineage.seenCount > 1 && (
          <span className="origin-trail-seen-count">
            {lineage.seenCount} appearances detected
          </span>
        )}
      </div>
      <div className="origin-trail-body">
        {lineage.trail.map((entry, idx) => (
          <div key={`${entry.domain}-${idx}`}>
            <div className="origin-trail-entry">
              <div className={`origin-trail-dot ${idx === 0 ? 'origin-trail-dot--current' : ''}`} />
              <div>
                <div className="origin-trail-label">{entry.label}</div>
                <div className="origin-trail-type">{entry.sourceType}</div>
              </div>
            </div>
            {idx < lineage.trail.length - 1 && (
              <div style={{ paddingLeft: '3px' }}>
                <div className="origin-trail-connector" />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="origin-trail-footer">
        Internet mythology archaeology · appearance trail only · not a factual claim
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TASK 4: Internet Artifact disclaimer
// ---------------------------------------------------------------------------

function ArtifactDisclaimerNote({
  category,
  sourceType,
}: {
  category: string;
  sourceType: string | null;
}) {
  const show =
    CONSPIRACY_CATEGORIES.has(category) ||
    (sourceType != null && ORIGIN_SOURCE_TYPES.has(sourceType));
  if (!show) return null;

  return (
    <div className="artifact-disclaimer">
      ◈ Internet Artifact — Not Verification
      {' · '}
      This signal was recovered from archived internet material.
      Content is presented as an internet artifact and mythological signal only.
      It does not represent a verified fact or endorsed claim.
      SWIM is an internet archaeology archive, not a news source.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Existing sub-components (unchanged)
// ---------------------------------------------------------------------------

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
  threadId:       string;
  initialThread?: ThreadContent;
  initialReplies?: Reply[];
  relatedThreads?: ThreadContent[];
  lineage?:        ThreadLineageData;  // Phase Z: server-resolved lineage data
}

export function ThreadView({
  threadId,
  initialThread,
  initialReplies = [],
  relatedThreads = [],
  lineage,
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
      {/* Thread page workstation atmosphere */}
      <div aria-hidden className="aq-thread-atmosphere" />

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
          <div className="aq-scan-sweep border-b border-crt/12 px-4 py-5 md:px-5 md:py-6">
            <h1 className="thread-view-title aq-heading-live">{thread.title}</h1>

            {/* Recovered signal hero metadata */}
            {meta.isRecoveredSignal && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {meta.sourceEra && meta.sourceEra !== 'modern source' && (
                    <span className="era-badge-inline">{meta.sourceEra.toUpperCase()}</span>
                  )}
                  {meta.archiveYear && (
                    <span className="archive-year-badge">{meta.archiveYear}</span>
                  )}
                  <span className="origin-signal-badge">ORIGIN SIGNAL</span>
                  {meta.sourceName && (
                    <span className="source-name-inline">↯ {meta.sourceName}</span>
                  )}
                  {/* Phase Z: source type badge */}
                  {meta.sourceType && (
                    <span className="source-name-inline" style={{ opacity: 0.7 }}>
                      [{meta.sourceType.toUpperCase()}]
                    </span>
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

          {/* TASK 3: Source era hero — prominent metadata row */}
          {meta.isRecoveredSignal && (
            <SourceEraHero meta={meta} />
          )}

          {/* TASK 1: Source-native artifact block — wrapped in terminal window frame */}
          {meta.isRecoveredSignal && meta.excerpt && (
            <div style={{ margin: '18px 20px 0' }} className="aq-terminal-window">
              <div className="aq-terminal-titlebar">
                <div className="aq-terminal-dot" style={{ background: 'rgba(215,168,92,0.45)' }} />
                <div className="aq-terminal-dot" style={{ background: 'rgba(134,212,110,0.30)' }} />
                <div className="aq-terminal-dot" style={{ background: 'rgba(134,212,110,0.18)' }} />
                <span>source artifact</span>
                {meta.archiveYear && (
                  <span style={{ marginLeft: 'auto', color: 'rgba(215,168,92,0.52)' }}>
                    {meta.archiveYear}
                  </span>
                )}
                {meta.sourceType && (
                  <span style={{ color: 'rgba(134,212,110,0.28)', marginLeft: meta.archiveYear ? 10 : 'auto' }}>
                    [{meta.sourceType.toUpperCase()}]
                  </span>
                )}
              </div>
              <SourceArtifactBlock meta={meta} excerpt={meta.excerpt} eraClass={eraClass} />
            </div>
          )}

          {/* TASK 4: Internet Artifact disclaimer */}
          {meta.isRecoveredSignal && (
            <ArtifactDisclaimerNote
              category={thread.category}
              sourceType={meta.sourceType}
            />
          )}

          {/* TASK 2: Origin trail panel */}
          {lineage && <OriginTrailBlock lineage={lineage} />}

          {/* Scanner analysis panel */}
          {meta.isRecoveredSignal && (
            <ScannerAnalysisPanel lines={meta.scannerLines} />
          )}

          {/* Source evidence panel */}
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

        {/* Related signals */}
        {relatedThreads.length > 0 && (
          <RelatedSignals threads={relatedThreads} />
        )}

        {/* Thread footer (recovered only) */}
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
