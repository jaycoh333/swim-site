'use client';

/**
 * SignalQueueClient — curator interface for reviewing recovered signals.
 *
 * Includes:
 *   - Status section tabs + category / source-type / score filters
 *   - Two-step publish (preview thread title+body → confirm)
 *   - Public submission badge on crowd-sourced signals
 *   - Share package preview after publish (Telegram + X copy)
 *
 * HUMAN APPROVAL GATE:
 *   Nothing here publishes automatically. Every status change and every
 *   publish requires an explicit curator click.
 *
 * TELEGRAM / X INTEGRATION POINT:
 *   See docs/social-automation-plan.md — Phase 2/3 will add post buttons.
 */

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGrid } from '@/components/AmbientGrid';
import { IntakeFormClient } from '@/components/IntakeFormClient';
import { updateSignalStatusAction, publishSignalAsThreadAction } from '@/app/actions';
import { formatTelegramPost, formatXPost, xPostTitleTruncated } from '@/lib/social-formatters';
import type { DbRecoveredSignal, RecoveredSignalStatus, SignalSourceType } from '@/lib/supabase/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS: Array<{ key: RecoveredSignalStatus | 'all'; label: string }> = [
  { key: 'all',      label: 'ALL'      },
  { key: 'pending',  label: 'PENDING'  },
  { key: 'approved', label: 'APPROVED' },
  { key: 'archived', label: 'ARCHIVED' },
  { key: 'rejected', label: 'REJECTED' },
];

const STATUS_SECTION_ORDER: RecoveredSignalStatus[] = ['pending', 'approved', 'archived', 'rejected'];

const SECTION_LABELS: Record<RecoveredSignalStatus, string> = {
  pending:  'PENDING REVIEW',
  approved: 'APPROVED',
  archived: 'ARCHIVED',
  rejected: 'REJECTED',
};

const STATUS_COLORS: Record<RecoveredSignalStatus, string> = {
  pending:  '#d7a85c',
  approved: '#86d46e',
  archived: '#6da8ff',
  rejected: '#ff6b6b',
};

const SOURCE_TYPE_LABELS: Record<SignalSourceType, string> = {
  reddit:     'Reddit',
  forum:      'Forum',
  pastebin:   'Paste',
  wayback:    'Wayback',
  imageboard: 'Imageboard',
  irc:        'IRC',
  other:      'Other',
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

interface PublishResult {
  threadSlug:     string;
  telegramText:   string;
  xText:          string;
  titleTruncated: boolean;
}

function buildPreviewBody(sig: DbRecoveredSignal): string {
  const lines = [
    `> RECOVERED SIGNAL // ${sig.category.toUpperCase()}`,
    `> source: ${sig.source_name} · ${sig.source_type}`,
    `> anomaly score: ${sig.anomaly_score}/10`,
    `> discovered: ${sig.discovered_at.slice(0, 10)}`,
    '',
    sig.summary,
  ];
  if (sig.source_url) lines.push('', `source: ${sig.source_url}`);
  lines.push(
    '',
    '[ curator note: add context about how this signal was found and why it matters — remove this line before the thread goes live ]',
  );
  return lines.join('\n');
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
// CopyButton
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

// ---------------------------------------------------------------------------
// SharePackagePanel
// ---------------------------------------------------------------------------

function SharePackagePanel({ result }: { result: PublishResult }) {
  return (
    <div className="mt-4 border-t border-crt/10 pt-4">
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

      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.20em] text-crt/28">telegram</span>
          <CopyButton text={result.telegramText} />
        </div>
        <div className="border border-crt/10 bg-[rgba(134,212,110,0.018)] px-3 py-2.5 font-mono text-[11px] leading-relaxed tracking-[0.03em] text-crt/45 whitespace-pre-wrap">
          {result.telegramText}
        </div>
      </div>

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
// PublishPreviewPanel — two-step publish confirm
// ---------------------------------------------------------------------------

function PublishPreviewPanel({
  sig,
  onConfirm,
  onCancel,
  isPublishing,
}: {
  sig:          DbRecoveredSignal;
  onConfirm:    () => void;
  onCancel:     () => void;
  isPublishing: boolean;
}) {
  return (
    <div className="mt-4 border-t border-[#d7a85c]/20 pt-4">
      <div className="mb-4 text-[10px] uppercase tracking-[0.24em] text-[#d7a85c]/65">
        ↯ publish preview — review before sending
      </div>

      {/* Thread title */}
      <div className="mb-3">
        <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-crt/28">thread title</div>
        <div className="border border-crt/14 px-3 py-2.5 text-[13px] leading-snug tracking-[0.03em] text-crt/75">
          {sig.title}
        </div>
      </div>

      {/* Thread body */}
      <div className="mb-4">
        <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-crt/28">thread body</div>
        <div className="border border-crt/12 bg-[rgba(134,212,110,0.015)] px-3 py-3 font-mono text-[11px] leading-relaxed tracking-[0.03em] text-crt/45 whitespace-pre-wrap max-h-48 overflow-y-auto">
          {buildPreviewBody(sig)}
        </div>
      </div>

      {/* Confirm / cancel */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onConfirm}
          disabled={isPublishing}
          className="border border-[#86d46e]/35 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[#86d46e]/70 transition-colors hover:border-[#86d46e]/60 hover:text-[#86d46e] disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isPublishing ? '↯ publishing...' : '[ confirm & publish ]'}
        </button>
        <button
          onClick={onCancel}
          disabled={isPublishing}
          className="border border-crt/15 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-crt/35 transition-colors hover:border-crt/28 hover:text-crt/55 disabled:cursor-not-allowed disabled:opacity-30"
        >
          [ cancel ]
        </button>
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-crt/20">
        thread created with author=archivist · curator note placeholder included · edit thread after publish
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalCard
// ---------------------------------------------------------------------------

interface SignalCardProps {
  signal:           DbRecoveredSignal;
  onStatusChange:   (id: string, status: RecoveredSignalStatus) => void;
  statusPending:    boolean;
  onRequestPublish: (sig: DbRecoveredSignal) => void;
  onConfirmPublish: (sig: DbRecoveredSignal) => void;
  onCancelPublish:  () => void;
  isPublishing:     boolean;
  isConfirming:     boolean;
  publishedResult:  PublishResult | null;
}

function SignalCard({
  signal: sig,
  onStatusChange,
  statusPending,
  onRequestPublish,
  onConfirmPublish,
  onCancelPublish,
  isPublishing,
  isConfirming,
  publishedResult,
}: SignalCardProps) {
  const alreadyPublished = Boolean(sig.published_thread_id) && !publishedResult;
  const busy = statusPending || isPublishing;

  return (
    <div
      className="terminal-card px-5 py-5 md:px-6 md:py-6"
      style={{ borderLeftColor: `${STATUS_COLORS[sig.status]}44` }}
    >
      {/* ── Header row ── */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.20em] text-crt/28">
            {sig.id.slice(0, 13).toUpperCase()}
          </span>
          <span className="text-crt/18">·</span>
          <span className="text-[12px] uppercase tracking-[0.16em] text-crt/72">
            {sig.category}
          </span>
          <span className="text-crt/18">·</span>
          <span className="text-[11px] uppercase tracking-[0.12em] text-crt/38">
            {SOURCE_TYPE_LABELS[sig.source_type] ?? sig.source_type}
          </span>
          {sig.submitted_publicly && (
            <span className="border border-[#d7a85c]/38 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[#d7a85c]/72">
              ◈ public submission
            </span>
          )}
        </div>
        <span
          className="shrink-0 text-[11px] uppercase tracking-[0.18em]"
          style={{ color: STATUS_COLORS[sig.status] }}
        >
          ◈ {sig.status}
        </span>
      </div>

      {/* ── Title ── */}
      <div className="mb-3 text-[1.08rem] font-medium leading-[1.42] tracking-[0.025em] text-crt/90">
        {sig.title}
      </div>

      {/* ── Summary — large and readable ── */}
      <p className="mb-5 text-[14px] leading-[1.72] tracking-[0.025em] text-crt/65">
        {sig.summary}
      </p>

      {/* ── Metadata grid ── */}
      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[11px] uppercase tracking-[0.14em] sm:grid-cols-4">
        <div>
          <div className="mb-1 text-crt/28">anomaly</div>
          <AnomalyBar score={sig.anomaly_score} />
        </div>
        <div>
          <div className="mb-1 text-crt/28">source</div>
          <div className="truncate text-crt/55">{sig.source_name}</div>
        </div>
        <div>
          <div className="mb-1 text-crt/28">discovered</div>
          <div className="text-crt/55">{sig.discovered_at.slice(0, 10)}</div>
        </div>
        <div>
          <div className="mb-1 text-crt/28">approved</div>
          <div className="text-crt/55">{sig.approved_at ? sig.approved_at.slice(0, 10) : '—'}</div>
        </div>
      </div>

      {/* ── Tags ── */}
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

      {/* ── Source URL ── */}
      {sig.source_url && (
        <div className="mb-4 font-mono text-[11px] tracking-[0.06em] text-crt/30">
          ↗ {sig.source_url}
        </div>
      )}

      {/* ── Action row ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-crt/10 pt-4">
        {sig.status !== 'approved' && (
          <button
            onClick={() => onStatusChange(sig.id, 'approved')}
            disabled={busy || isConfirming}
            className="border border-[#86d46e]/32 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#86d46e]/68 transition-colors hover:border-[#86d46e]/55 hover:text-[#86d46e] disabled:cursor-not-allowed disabled:opacity-28"
          >
            [ approve ]
          </button>
        )}
        {sig.status !== 'archived' && (
          <button
            onClick={() => onStatusChange(sig.id, 'archived')}
            disabled={busy || isConfirming}
            className="border border-[#6da8ff]/28 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#6da8ff]/62 transition-colors hover:border-[#6da8ff]/50 hover:text-[#6da8ff] disabled:cursor-not-allowed disabled:opacity-28"
          >
            [ archive ]
          </button>
        )}
        {sig.status !== 'rejected' && (
          <button
            onClick={() => onStatusChange(sig.id, 'rejected')}
            disabled={busy || isConfirming}
            className="border border-[#ff6b6b]/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#ff6b6b]/52 transition-colors hover:border-[#ff6b6b]/42 hover:text-[#ff6b6b]/82 disabled:cursor-not-allowed disabled:opacity-28"
          >
            [ reject ]
          </button>
        )}

        {/* Publish — right-aligned */}
        <div className="ml-auto">
          {publishedResult ? null : alreadyPublished ? (
            <span className="px-1 text-[11px] uppercase tracking-[0.18em] text-crt/22">
              ◈ published
            </span>
          ) : isConfirming ? null : (
            <button
              onClick={() => onRequestPublish(sig)}
              disabled={busy}
              className="border border-crt/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-crt/52 transition-colors hover:border-crt/38 hover:text-crt/78 disabled:cursor-not-allowed disabled:opacity-28"
            >
              [ preview &amp; publish ]
            </button>
          )}
        </div>
      </div>

      {/* ── Publish preview — two-step confirm ── */}
      {isConfirming && !publishedResult && (
        <PublishPreviewPanel
          sig={sig}
          onConfirm={() => onConfirmPublish(sig)}
          onCancel={onCancelPublish}
          isPublishing={isPublishing}
        />
      )}

      {/* ── Share package — shown after successful publish ── */}
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
  pending:  initialPending,
  approved: initialApproved,
  archived: initialArchived,
  rejected: initialRejected,
}: SignalQueueClientProps) {
  const router = useRouter();
  const [isStatusPending, startStatusTransition] = useTransition();

  // Tab / filter / sort state
  const [activeTab,        setActiveTab]        = useState<RecoveredSignalStatus | 'all'>('pending');
  const [filterCategory,   setFilterCategory]   = useState('');
  const [filterSourceType, setFilterSourceType] = useState('');
  const [sortScore,        setSortScore]        = useState<'desc' | 'asc' | null>(null);

  // Intake form
  const [showIntake, setShowIntake] = useState(false);

  // Optimistic status overrides
  const [overrides, setOverrides] = useState<Record<string, RecoveredSignalStatus>>({});

  // Publish state
  const [publishingId,     setPublishingId]     = useState<string | null>(null);
  const [confirmingId,     setConfirmingId]     = useState<string | null>(null);
  const [publishedResults, setPublishedResults] = useState<Record<string, PublishResult>>({});

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Merge all signals + apply optimistic overrides
  const allSignals = [
    ...initialPending,
    ...initialApproved,
    ...initialArchived,
    ...initialRejected,
  ].map((s) => ({ ...s, status: overrides[s.id] ?? s.status }));

  // Unique values for filter dropdowns
  const uniqueCategories  = [...new Set(allSignals.map((s) => s.category))].sort();
  const uniqueSourceTypes = [...new Set(allSignals.map((s) => s.source_type))].sort() as SignalSourceType[];

  // Counts (after optimistic overrides, before secondary filters)
  const counts: Record<RecoveredSignalStatus | 'all', number> = {
    all:      allSignals.length,
    pending:  allSignals.filter((s) => s.status === 'pending').length,
    approved: allSignals.filter((s) => s.status === 'approved').length,
    archived: allSignals.filter((s) => s.status === 'archived').length,
    rejected: allSignals.filter((s) => s.status === 'rejected').length,
  };

  // Apply tab filter
  let visibleSignals =
    activeTab === 'all'
      ? allSignals
      : allSignals.filter((s) => s.status === activeTab);

  // Apply secondary filters
  if (filterCategory)   visibleSignals = visibleSignals.filter((s) => s.category === filterCategory);
  if (filterSourceType) visibleSignals = visibleSignals.filter((s) => s.source_type === filterSourceType);

  // Apply sort
  if (sortScore === 'desc') visibleSignals = [...visibleSignals].sort((a, b) => b.anomaly_score - a.anomaly_score);
  if (sortScore === 'asc')  visibleSignals = [...visibleSignals].sort((a, b) => a.anomaly_score - b.anomaly_score);

  // Grouped by status for the "all" section view
  const groupedByStatus: Record<RecoveredSignalStatus, DbRecoveredSignal[]> =
    STATUS_SECTION_ORDER.reduce(
      (acc, s) => { acc[s] = visibleSignals.filter((sig) => sig.status === s); return acc; },
      {} as Record<RecoveredSignalStatus, DbRecoveredSignal[]>,
    );

  const hasActiveFilter = Boolean(filterCategory || filterSourceType || sortScore);

  // ── Helpers ──

  function showError(msg: string) {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 6000);
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

  function handleRequestPublish(sig: DbRecoveredSignal) {
    if (publishingId) return;
    setConfirmingId(sig.id);
  }

  function handleCancelPublish() {
    setConfirmingId(null);
  }

  async function handleConfirmPublish(sig: DbRecoveredSignal) {
    if (publishingId) return;
    setPublishingId(sig.id);

    try {
      const result = await publishSignalAsThreadAction(sig.id);
      if ('error' in result) {
        showError(`publish failed — ${result.error}`);
        setConfirmingId(null);
        return;
      }

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
          threadSlug:     result.threadSlug,
          telegramText:   formatTelegramPost(shareData),
          xText:          formatXPost(shareData),
          titleTruncated: xPostTitleTruncated(shareData),
        },
      }));

      setOverrides((o) => ({ ...o, [sig.id]: 'approved' }));
      setConfirmingId(null);
      router.refresh();
    } finally {
      setPublishingId(null);
    }
  }

  // ── Shared card renderer ──
  function renderCard(sig: DbRecoveredSignal) {
    return (
      <SignalCard
        key={sig.id}
        signal={sig}
        onStatusChange={handleStatusChange}
        statusPending={isStatusPending}
        onRequestPublish={handleRequestPublish}
        onConfirmPublish={handleConfirmPublish}
        onCancelPublish={handleCancelPublish}
        isPublishing={publishingId === sig.id}
        isConfirming={confirmingId === sig.id}
        publishedResult={publishedResults[sig.id] ?? null}
      />
    );
  }

  // ── Render ──

  return (
    <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[80px] md:pb-8 md:pt-[100px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
        <div className="forum-shell overflow-hidden">

          {/* ── Header ── */}
          <div className="border-b border-crt/12 px-6 py-7 md:px-10 md:py-9">
            <div className="mb-1.5 flex items-start justify-between gap-4">
              <div className="text-[11px] uppercase tracking-[0.30em] text-crt/35">
                swim · internal · curator access only
              </div>
              <button
                onClick={() => setShowIntake((v) => !v)}
                className={`shrink-0 border px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] transition-colors ${
                  showIntake
                    ? 'border-crt/32 text-crt/65 hover:border-crt/18 hover:text-crt/38'
                    : 'border-crt/20 text-crt/40 hover:border-crt/35 hover:text-crt/62'
                }`}
              >
                {showIntake ? '[ − close intake ]' : '[ + intake signal ]'}
              </button>
            </div>
            <h1 className="text-[1.8rem] tracking-[0.10em] text-crt md:text-[2.2rem]">
              SIGNAL QUEUE
            </h1>
            <p className="mt-2 text-[13px] uppercase tracking-[0.14em] text-crt/42">
              human approval required before any signal becomes public
            </p>
          </div>

          {/* ── Manual intake form ── */}
          {showIntake && (
            <IntakeFormClient onSuccess={() => setShowIntake(false)} />
          )}

          {/* ── Status counts ── */}
          <div className="border-b border-crt/10 bg-[rgba(134,212,110,0.018)] px-6 py-4 md:px-10">
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-[12px] uppercase tracking-[0.18em]">
              <span className="text-crt/45">
                <span className="text-crt/28">total</span>
                <span className="mx-2 text-crt/18">//</span>
                {counts.all}
              </span>
              {STATUS_SECTION_ORDER.map((s) => (
                <span key={s} style={{ color: `${STATUS_COLORS[s]}88` }}>
                  <span className="text-crt/28">{s}</span>
                  <span className="mx-2 text-crt/18">//</span>
                  {counts[s]}
                </span>
              ))}
            </div>
          </div>

          {/* ── Status filter tabs ── */}
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

          {/* ── Secondary filters ── */}
          <div className="border-b border-crt/8 bg-[rgba(134,212,110,0.012)] px-6 py-3 md:px-10">
            <div className="flex flex-wrap items-center gap-4">

              {/* Category */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-crt/28">category</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="border border-crt/15 bg-transparent px-2 py-1 font-mono text-[11px] tracking-[0.08em] text-crt/55 focus:border-crt/30 focus:outline-none"
                >
                  <option value="">all</option>
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Source type */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-crt/28">source</span>
                <select
                  value={filterSourceType}
                  onChange={(e) => setFilterSourceType(e.target.value)}
                  className="border border-crt/15 bg-transparent px-2 py-1 font-mono text-[11px] tracking-[0.08em] text-crt/55 focus:border-crt/30 focus:outline-none"
                >
                  <option value="">all</option>
                  {uniqueSourceTypes.map((t) => (
                    <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {/* Score sort */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-crt/28">score</span>
                <button
                  onClick={() =>
                    setSortScore((v) => v === 'desc' ? 'asc' : v === 'asc' ? null : 'desc')
                  }
                  className={`border px-2 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors ${
                    sortScore
                      ? 'border-crt/28 text-crt/60 hover:border-crt/18 hover:text-crt/38'
                      : 'border-crt/12 text-crt/30 hover:border-crt/22 hover:text-crt/50'
                  }`}
                >
                  {sortScore === 'desc' ? '↓ high first'
                   : sortScore === 'asc' ? '↑ low first'
                   : '— default'}
                </button>
              </div>

              {/* Clear */}
              {hasActiveFilter && (
                <button
                  onClick={() => { setFilterCategory(''); setFilterSourceType(''); setSortScore(null); }}
                  className="ml-auto text-[10px] uppercase tracking-[0.18em] text-crt/28 transition-colors hover:text-crt/52"
                >
                  × clear filters
                </button>
              )}

              {/* Filtered count */}
              {hasActiveFilter && (
                <span className="text-[10px] uppercase tracking-[0.14em] text-crt/22">
                  {visibleSignals.length} shown
                </span>
              )}
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
                {hasActiveFilter ? 'no signals match the current filters' : 'no signals in this state'}
              </div>
            ) : activeTab === 'all' ? (
              /* Grouped section view */
              <div className="space-y-10">
                {STATUS_SECTION_ORDER.map((status) => {
                  const sigs = groupedByStatus[status];
                  if (sigs.length === 0) return null;
                  return (
                    <div key={status}>
                      {/* Section header */}
                      <div className="mb-4 flex items-center gap-4">
                        <div className="h-px flex-1" style={{ backgroundColor: `${STATUS_COLORS[status]}22` }} />
                        <span
                          className="shrink-0 text-[10px] uppercase tracking-[0.26em]"
                          style={{ color: `${STATUS_COLORS[status]}80` }}
                        >
                          {SECTION_LABELS[status]} · {sigs.length}
                        </span>
                        <div className="h-px flex-1" style={{ backgroundColor: `${STATUS_COLORS[status]}22` }} />
                      </div>
                      <div className="terminal-card-grid">
                        {sigs.map(renderCard)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Flat list for single-status tabs */
              <div className="terminal-card-grid">
                {visibleSignals.map(renderCard)}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="border-t border-crt/8 px-6 py-5 text-center text-[11px] uppercase tracking-[0.18em] text-crt/22 md:px-10">
            curator queue · service role key required · not accessible to public users
          </div>

        </div>
      </div>
    </div>
  );
}
