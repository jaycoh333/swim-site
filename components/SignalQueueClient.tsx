'use client';

/**
 * SignalQueueClient — curator interface for reviewing recovered signals.
 *
 * Actions: approve, archive, reject, publish to thread.
 *
 * HUMAN APPROVAL GATE:
 *   Approval and publishing here are the mandatory steps before any signal
 *   becomes public. Nothing reaches /scanner or any thread automatically.
 *
 * PUBLISH TO THREAD:
 *   [ publish to thread ] calls publishSignalAsThreadAction, which:
 *   1. Formats a thread body from the signal content
 *   2. Creates a thread with author_handle='ARCHIVIST'
 *   3. Stamps the signal with published_thread_id + status='approved'
 *   A link to the new thread appears in place of the button on success.
 *
 * TELEGRAM / X INTEGRATION POINT:
 *   After publishing, share the thread link manually using the growth playbook
 *   (docs/growth-playbook.md). Automated Telegram/X posting is a future phase.
 */

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGrid } from '@/components/AmbientGrid';
import { updateSignalStatusAction, publishSignalAsThreadAction } from '@/app/actions';
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

interface SignalCardProps {
  signal:              DbRecoveredSignal;
  onStatusChange:      (id: string, status: RecoveredSignalStatus) => void;
  statusPending:       boolean;
  onPublish:           (id: string) => void;
  isPublishing:        boolean;
  publishedThreadSlug: string | null;
}

function SignalCard({
  signal: sig,
  onStatusChange,
  statusPending,
  onPublish,
  isPublishing,
  publishedThreadSlug,
}: SignalCardProps) {
  const alreadyPublished = Boolean(sig.published_thread_id);

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
        {/* Status actions */}
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

        {/* Publish to thread */}
        <div className="ml-auto">
          {publishedThreadSlug ? (
            // Just published in this session — show link
            <Link
              href={`/threads/${publishedThreadSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center border border-[#86d46e]/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#86d46e]/80 transition-colors hover:border-[#86d46e]/65 hover:text-[#86d46e]"
            >
              ✓ published — view thread ↗
            </Link>
          ) : alreadyPublished ? (
            // Previously published (from server) — no slug available without extra join
            <span className="px-1 text-[11px] uppercase tracking-[0.18em] text-crt/25">
              ◈ already published
            </span>
          ) : (
            // Not yet published — active button
            <button
              onClick={() => onPublish(sig.id)}
              disabled={statusPending || isPublishing}
              className="border border-crt/25 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-crt/55 transition-colors hover:border-crt/42 hover:text-crt/80 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isPublishing ? '↯ publishing...' : '[ publish to thread ]'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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

  // Status overrides — optimistic local state for approve/archive/reject
  const [overrides, setOverrides] = useState<Record<string, RecoveredSignalStatus>>({});

  // Publish state — one signal can publish at a time
  const [publishingId,   setPublishingId]   = useState<string | null>(null);
  // Maps signalId → threadSlug for signals published in this session
  const [publishedSlugs, setPublishedSlugs] = useState<Record<string, string>>({});

  // Shared error banner (status changes and publish failures share it)
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

  async function handlePublish(signalId: string) {
    if (publishingId) return; // one at a time
    setPublishingId(signalId);

    try {
      const result = await publishSignalAsThreadAction(signalId);
      if ('error' in result) {
        showError(`publish failed — ${result.error}`);
      } else {
        setPublishedSlugs((p) => ({ ...p, [signalId]: result.threadSlug }));
        // Optimistically flip status to approved
        setOverrides((o) => ({ ...o, [signalId]: 'approved' }));
        router.refresh();
      }
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
                    publishedThreadSlug={publishedSlugs[sig.id] ?? null}
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
