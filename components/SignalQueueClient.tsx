'use client';

/**
 * SignalQueueClient — curator interface for reviewing recovered signals.
 *
 * After publishing a signal as a thread, a share package panel appears
 * showing pre-formatted Telegram and X copy with one-click copy buttons.
 * No API calls are made from this component — sharing is manual.
 *
 * HUMAN APPROVAL GATE:
 *   Approval and publishing here are mandatory steps before any signal
 *   becomes public. Nothing posts automatically.
 *
 * TELEGRAM / X INTEGRATION POINT:
 *   formatTelegramPost / formatXPost from lib/social-formatters.ts generate
 *   the preview text. When Phase 2/3 are implemented, the [ post to telegram ]
 *   and [ post to x ] buttons will call server actions that invoke social-poster.ts.
 *   See docs/social-automation-plan.md.
 */

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGrid } from '@/components/AmbientGrid';
import { updateSignalStatusAction, publishSignalAsThreadAction } from '@/app/actions';
import { formatTelegramPost, formatXPost, xPostTitleTruncated } from '@/lib/social-formatters';
import type { DbRecoveredSignal, RecoveredSignalStatus } from '@/lib/supabase/types';

const STATUS_TABS: Array<{ key: RecoveredSignalStatus | 'all'; label: string }> = [
  { key: 'all',      label: 'ALL'      },
  { key: 'pending',  label: 'PENDING'  },
  { key: 'approved', label: 'APPROVED' },
  { key: 'archived', label: 'ARCHIVED' },
  { key: 'rejected', label: 'REJECTED' },
];

const STATUS_COLORS: Record<RecoveredSignalStatus, string> = {
  pending:  '#d7a85c',
  approved: '#86d46e',
  archived: '#6da8ff',
  rejected: '#ff6b6b',
};

interface PublishResult {
  threadSlug:    string;
  telegramText:  string;
  xText:         string;
  titleTruncated: boolean;
}

// ---------------------------------------------------------------------------
// AnomalyBar
// ---------------------------------------------------------------------------

function AnomalyBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="h-[10px] w-[6px]"
            style={{
              backgroundColor: i < score
                ? score >= 8 ? '#ff6b6b' : score >= 6 ? '#d7a85c' : '#86d46e'
                : 'rgba(134,212,110,0.10)',
            }}
          />
        ))}
      </div>
      <span className="text-[11px] tabular-nums tracking-[0.14em] text-crt/45">
        {score}/10
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SharePackagePanel
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="text-[10px] uppercase tracking-[0.16em] text-crt/38 transition-colors hover:text-crt/65"
    >
      {copied ? '✓ copied' : '[ copy ]'}
    </button>
  );
}

function SharePackagePanel({ result }: { result: PublishResult }) {
  return (
    <div className="mt-4 border-t border-crt/10 pt-4">
      {/* Panel header + view thread */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.26em] text-crt/28">
          share package
        </span>
        <Link
          href={`/threads/${result.threadSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] uppercase tracking-[0.18em] text-[#86d46e]/72 transition-colors hover:text-[#86d46e]"
        >
          ✓ view thread ↗
        </Link>
      </div>

      {/* Telegram block */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.20em] text-crt/28">telegram</span>
          <CopyButton text={result.telegramText} />
        </div>
        <div className="border border-crt/10 bg-[rgba(134,212,110,0.018)] px-3 py-2.5 font-mono text-[11px] leading-relaxed tracking-[0.03em] text-crt/45 whitespace-pre-wrap">
          {result.telegramText}
        </div>
      </div>

      {/* X block */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.20em] text-crt/28">x.com</span>
            <span
              className="text-[10px] tabular-nums tracking-[0.12em]"
              style={{ color: result.xText.length > 260 ? '#d7a85c' : 'rgba(134,212,110,0.30)' }}
            >
              {result.xText.length}/280
            </span>
            {result.titleTruncated && (
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#d7a85c]/70">
                title truncated
              </span>
            )}
          </div>
          <CopyButton text={result.xText} />
        </div>
        <div className="border border-crt/10 bg-[rgba(134,212,110,0.018)] px-3 py-2.5 font-mono text-[11px] leading-relaxed tracking-[0.03em] text-crt/45 whitespace-pre-wrap">
          {result.xText}
        </div>
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-crt/22">
          no api calls made — copy and post manually or wait for phase 2/3
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalCard
// ---------------------------------------------------------------------------

interface SignalCardProps {
  signal:          DbRecoveredSignal;
  onStatusChange:  (id: string, status: RecoveredSignalStatus) => void;
  statusPending:   boolean;
  onPublish:       (sig: DbRecoveredSignal) => void;
  isPublishing:    boolean;
  publishedResult: PublishResult | null;
}

function SignalCard({
  signal: sig,
  onStatusChange,
  statusPending,
  onPublish,
  isPublishing,
  publishedResult,
}: SignalCardProps) {
  const alreadyPublished = Boolean(sig.published_thread_id) && !publishedResult;

  return (
    <div
      className="terminal-card px-5 py-5 md:px-6 md:py-6"
      style={{ borderLeftColor: `${STATUS_COLORS[sig.status]}44` }}
    >
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[11px] uppercase tracking-[0.20em] text-crt/35">
            {sig.id.toUpperCase()}
          </span>
          <span className="text-crt/18">·</span>
          <span className="text-[12px] uppercase tracking-[0.16em] text-crt/70">
            {sig.category}
          </span>
          <span className="text-crt/18">·</span>
          <span className="text-[11px] uppercase tracking-[0.14em] text-crt/38">
            {sig.source_type}
          </span>
        </div>
        <span
          className="text-[11px] uppercase tracking-[0.18em]"
          style={{ color: STATUS_COLORS[sig.status] }}
        >
          ◈ {sig.status}
        </span>
      </div>

      {/* Title */}
      <div className="mb-2 text-[1.05rem] leading-[1.45] tracking-[0.03em] text-crt/88">
        {sig.title}
      </div>

      {/* Summary */}
      <p className="mb-4 text-[13px] leading-[1.65] tracking-[0.03em] text-crt/55">
        {sig.summary}
      </p>

      {/* Metadata grid */}
      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.14em] sm:grid-cols-4">
        <div>
          <div className="mb-0.5 text-crt/28">anomaly</div>
          <AnomalyBar score={sig.anomaly_score} />
        </div>
        <div>
          <div className="mb-0.5 text-crt/28">source</div>
          <div className="truncate text-crt/55">{sig.source_name}</div>
        </div>
        <div>
          <div className="mb-0.5 text-crt/28">discovered</div>
          <div className="text-crt/55">{sig.discovered_at.slice(0, 10)}</div>
        </div>
        <div>
          <div className="mb-0.5 text-crt/28">approved</div>
          <div className="text-crt/55">{sig.approved_at ? sig.approved_at.slice(0, 10) : '—'}</div>
        </div>
      </div>

      {/* Tags */}
      {sig.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {sig.tags.map((tag) => (
            <span
              key={tag}
              className="border border-crt/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-crt/38"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Source URL */}
      {sig.source_url && (
        <div className="mb-4 text-[11px] tracking-[0.06em] text-crt/30">
          ↗ {sig.source_url}
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2 border-t border-crt/8 pt-4">
        {sig.status !== 'approved' && (
          <button
            onClick={() => onStatusChange(sig.id, 'approved')}
            disabled={statusPending || isPublishing}
            className="border border-[#86d46e]/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#86d46e]/70 transition-colors hover:border-[#86d46e]/55 hover:text-[#86d46e] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            [ approve ]
          </button>
        )}
        {sig.status !== 'archived' && (
          <button
            onClick={() => onStatusChange(sig.id, 'archived')}
            disabled={statusPending || isPublishing}
            className="border border-[#6da8ff]/28 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#6da8ff]/65 transition-colors hover:border-[#6da8ff]/50 hover:text-[#6da8ff] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            [ archive ]
          </button>
        )}
        {sig.status !== 'rejected' && (
          <button
            onClick={() => onStatusChange(sig.id, 'rejected')}
            disabled={statusPending || isPublishing}
            className="border border-[#ff6b6b]/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#ff6b6b]/55 transition-colors hover:border-[#ff6b6b]/42 hover:text-[#ff6b6b]/85 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            [ reject ]
          </button>
        )}

        {/* Publish button — right-aligned, three states */}
        <div className="ml-auto">
          {publishedResult ? null /* panel renders below */ : alreadyPublished ? (
            <span className="px-1 text-[11px] uppercase tracking-[0.18em] text-crt/25">
              ◈ already published
            </span>
          ) : (
            <button
              onClick={() => onPublish(sig)}
              disabled={statusPending || isPublishing}
              className="border border-crt/25 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-crt/55 transition-colors hover:border-crt/42 hover:text-crt/80 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isPublishing ? '↯ publishing...' : '[ publish to thread ]'}
            </button>
          )}
        </div>
      </div>

      {/* Share package — appears after successful publish in this session */}
      {publishedResult && <SharePackagePanel result={publishedResult} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalQueueClient
// ---------------------------------------------------------------------------

export interface SignalQueueClientProps {
  pending:  DbRecoveredSignal[];
  approved: DbRecoveredSignal[];
  archived: DbRecoveredSignal[];
  rejected: DbRecoveredSignal[];
}

export function SignalQueueClient({
  pending: initialPending,
  approved: initialApproved,
  archived: initialArchived,
  rejected: initialRejected,
}: SignalQueueClientProps) {
  const router = useRouter();
  const [isStatusPending, startStatusTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<RecoveredSignalStatus | 'all'>('pending');

  // Optimistic status overrides for approve/archive/reject actions
  const [overrides, setOverrides] = useState<Record<string, RecoveredSignalStatus>>({});

  // Publish state
  const [publishingId,     setPublishingId]     = useState<string | null>(null);
  // Maps signalId → PublishResult for signals published in this session
  const [publishedResults, setPublishedResults] = useState<Record<string, PublishResult>>({});

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allSignals = [
    ...initialPending,
    ...initialApproved,
    ...initialArchived,
    ...initialRejected,
  ].map((s) => ({ ...s, status: overrides[s.id] ?? s.status }));

  const counts: Record<RecoveredSignalStatus | 'all', number> = {
    all:      allSignals.length,
    pending:  allSignals.filter((s) => s.status === 'pending').length,
    approved: allSignals.filter((s) => s.status === 'approved').length,
    archived: allSignals.filter((s) => s.status === 'archived').length,
    rejected: allSignals.filter((s) => s.status === 'rejected').length,
  };

  const visibleSignals =
    activeTab === 'all'
      ? allSignals
      : allSignals.filter((s) => s.status === activeTab);

  function showError(msg: string) {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  }

  function handleStatusChange(id: string, status: RecoveredSignalStatus) {
    const prev = overrides[id] ?? allSignals.find((s) => s.id === id)?.status;
    setOverrides((o) => ({ ...o, [id]: status }));

    startStatusTransition(async () => {
      const result = await updateSignalStatusAction({ id, status });
      if ('error' in result) {
        if (prev) setOverrides((o) => ({ ...o, [id]: prev }));
        showError(`signal lost — ${result.error}`);
      } else {
        router.refresh();
      }
    });
  }

  async function handlePublish(sig: DbRecoveredSignal) {
    if (publishingId) return;
    setPublishingId(sig.id);

    try {
      const result = await publishSignalAsThreadAction(sig.id);
      if ('error' in result) {
        showError(`publish failed — ${result.error}`);
        return;
      }

      // Build share data from the signal + returned slug
      const shareData = {
        title:        sig.title,
        category:     sig.category,
        summary:      sig.summary,
        threadSlug:   result.threadSlug,
        sourceName:   sig.source_name,
        anomalyScore: sig.anomaly_score,
        tags:         sig.tags,
      };

      setPublishedResults((p) => ({
        ...p,
        [sig.id]: {
          threadSlug:    result.threadSlug,
          telegramText:  formatTelegramPost(shareData),
          xText:         formatXPost(shareData),
          titleTruncated: xPostTitleTruncated(shareData),
        },
      }));

      // Optimistically flip to approved in the status tab counts
      setOverrides((o) => ({ ...o, [sig.id]: 'approved' }));
      router.refresh();
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[80px] md:pb-8 md:pt-[100px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
        <div className="forum-shell overflow-hidden">

          {/* ── Header ── */}
          <div className="border-b border-crt/12 px-6 py-7 md:px-10 md:py-9">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.30em] text-crt/35">
              swim · internal · curator access only
            </div>
            <h1 className="text-[1.8rem] tracking-[0.10em] text-crt md:text-[2.2rem]">
              SIGNAL QUEUE
            </h1>
            <p className="mt-2 text-[13px] uppercase tracking-[0.14em] text-crt/42">
              human approval required before any signal becomes public
            </p>
          </div>

          {/* ── Status counts ── */}
          <div className="border-b border-crt/10 bg-[rgba(134,212,110,0.018)] px-6 py-4 md:px-10">
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-[12px] uppercase tracking-[0.18em]">
              <span className="text-crt/45">
                <span className="text-crt/28">total</span>
                <span className="mx-2 text-crt/18">//</span>
                {counts.all}
              </span>
              <span style={{ color: `${STATUS_COLORS.pending}99` }}>
                <span className="text-crt/28">pending</span>
                <span className="mx-2 text-crt/18">//</span>
                {counts.pending}
              </span>
              <span style={{ color: `${STATUS_COLORS.approved}88` }}>
                <span className="text-crt/28">approved</span>
                <span className="mx-2 text-crt/18">//</span>
                {counts.approved}
              </span>
              <span style={{ color: `${STATUS_COLORS.archived}88` }}>
                <span className="text-crt/28">archived</span>
                <span className="mx-2 text-crt/18">//</span>
                {counts.archived}
              </span>
              <span style={{ color: `${STATUS_COLORS.rejected}88` }}>
                <span className="text-crt/28">rejected</span>
                <span className="mx-2 text-crt/18">//</span>
                {counts.rejected}
              </span>
            </div>
          </div>

          {/* ── Filter tabs ── */}
          <div className="border-b border-crt/10 px-6 py-0 md:px-10">
            <div className="flex gap-0 overflow-x-auto">
              {STATUS_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`border-b-2 px-4 py-4 text-[11px] uppercase tracking-[0.22em] transition-colors whitespace-nowrap ${
                    activeTab === key
                      ? 'border-crt/55 text-crt/80'
                      : 'border-transparent text-crt/30 hover:text-crt/55'
                  }`}
                >
                  {label}
                  {key !== 'all' && (
                    <span className="ml-1.5 text-crt/28">
                      {counts[key as RecoveredSignalStatus]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Error banner ── */}
          {errorMsg && (
            <div className="border-b border-red-900/40 bg-[rgba(40,10,10,0.6)] px-6 py-3 text-[12px] uppercase tracking-[0.18em] text-red-400/80 md:px-10">
              › {errorMsg}
            </div>
          )}

          {/* ── Signal list ── */}
          <div className="px-6 py-6 md:px-10 md:py-8">
            {visibleSignals.length === 0 ? (
              <div className="py-16 text-center text-[13px] uppercase tracking-[0.22em] text-crt/28">
                no signals in this state
              </div>
            ) : (
              <div className="terminal-card-grid">
                {visibleSignals.map((sig) => (
                  <SignalCard
                    key={sig.id}
                    signal={sig}
                    onStatusChange={handleStatusChange}
                    statusPending={isStatusPending}
                    onPublish={handlePublish}
                    isPublishing={publishingId === sig.id}
                    publishedResult={publishedResults[sig.id] ?? null}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Footer note ── */}
          <div className="border-t border-crt/8 px-6 py-5 text-center text-[11px] uppercase tracking-[0.18em] text-crt/22 md:px-10">
            curator queue · service role key required · not accessible to public users
          </div>

        </div>
      </div>
    </div>
  );
}
