'use client';

/**
 * SignalQueueClient — curator interface for reviewing recovered signals.
 *
 * Actions: approve, archive, reject, publish to thread (stub).
 *
 * HUMAN APPROVAL GATE:
 *   Approval here is the mandatory step before any signal becomes public.
 *   No signal reaches /scanner or any thread without curator action.
 *
 * TELEGRAM / X INTEGRATION POINT:
 *   A future webhook or cron will trigger when status changes to 'approved'.
 *   See docs/growth-playbook.md — Phase 2 (Telegram Bot).
 *
 * PUBLISH TO THREAD:
 *   The [ publish ] button is a stub. Future phase: pre-fill CreateThreadPanel
 *   with signal content so the curator can review and post in one step.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGrid } from '@/components/AmbientGrid';
import { updateSignalStatusAction } from '@/app/actions';
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
  signal: DbRecoveredSignal;
  onStatusChange: (id: string, status: RecoveredSignalStatus) => void;
  pending: boolean;
}

function SignalCard({ signal: sig, onStatusChange, pending }: SignalCardProps) {
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
            disabled={pending}
            className="border border-[#86d46e]/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#86d46e]/70 transition-colors hover:border-[#86d46e]/55 hover:text-[#86d46e] disabled:opacity-30"
          >
            [ approve ]
          </button>
        )}
        {sig.status !== 'archived' && (
          <button
            onClick={() => onStatusChange(sig.id, 'archived')}
            disabled={pending}
            className="border border-[#6da8ff]/28 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#6da8ff]/65 transition-colors hover:border-[#6da8ff]/50 hover:text-[#6da8ff] disabled:opacity-30"
          >
            [ archive ]
          </button>
        )}
        {sig.status !== 'rejected' && (
          <button
            onClick={() => onStatusChange(sig.id, 'rejected')}
            disabled={pending}
            className="border border-[#ff6b6b]/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#ff6b6b]/55 transition-colors hover:border-[#ff6b6b]/42 hover:text-[#ff6b6b]/85 disabled:opacity-30"
          >
            [ reject ]
          </button>
        )}
        {/* PUBLISH TO THREAD — stub: future phase wires this to CreateThreadPanel */}
        <button
          disabled
          title="Publish to thread — future phase"
          className="ml-auto border border-crt/12 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-crt/25 cursor-not-allowed"
        >
          [ publish to thread — soon ]
        </button>
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
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<RecoveredSignalStatus | 'all'>('pending');
  const [actionError, setActionError] = useState<string | null>(null);

  // Local optimistic state maps id → status override
  const [overrides, setOverrides] = useState<Record<string, RecoveredSignalStatus>>({});

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

  function handleStatusChange(id: string, status: RecoveredSignalStatus) {
    const prev = overrides[id] ?? allSignals.find((s) => s.id === id)?.status;
    setOverrides((o) => ({ ...o, [id]: status }));
    setActionError(null);

    startTransition(async () => {
      const result = await updateSignalStatusAction({ id, status });
      if ('error' in result) {
        if (prev) setOverrides((o) => ({ ...o, [id]: prev }));
        setActionError(`signal lost — ${result.error}`);
        setTimeout(() => setActionError(null), 4000);
      } else {
        router.refresh();
      }
    });
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
          {actionError && (
            <div className="border-b border-red-900/40 bg-[rgba(40,10,10,0.6)] px-6 py-3 text-[12px] uppercase tracking-[0.18em] text-red-400/80 md:px-10">
              › {actionError}
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
                    pending={isPending}
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
