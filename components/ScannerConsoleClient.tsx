'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  runFetchSessionAction,
  queueFetchedCandidateAction,
  updateSignalStatusAction,
  rebirthSignalAsThreadAction,
} from '@/app/actions';
import { formatTelegramPost, formatXPost } from '@/lib/social-formatters';
import { CATEGORY_ORDER } from '@/lib/forum-types';
import type { DbScannerSource, DbRecoveredSignal } from '@/lib/supabase/types';
import type { SessionSourceResult } from '@/lib/scanner-fetch-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsoleStats {
  totalRecovered:    number;
  pendingReview:     number;
  threadsReborn:     number;
  publicSubmissions: number;
}

interface PublishedResult {
  threadSlug:   string;
  title:        string;
  telegramText: string;
  xText:        string;
}

export interface ScannerConsoleClientProps {
  sources:              DbScannerSource[];
  enabledSources:       DbScannerSource[];
  initialReviewSignals: DbRecoveredSignal[];
  initialReadySignals:  DbRecoveredSignal[];
  stats:                ConsoleStats;
}

type CandidateAction = 'idle' | 'queueing' | 'queued' | 'skipped' | 'error';
interface CandidateState { action: CandidateAction; error?: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending:         'New',
    reviewing:       'In Review',
    'rebirth-ready': 'Ready',
    approved:        'Approved',
  };
  return map[status] ?? status;
}

function statusBadgeCls(status: string): string {
  const map: Record<string, string> = {
    pending:         'bg-amber-500/15  text-amber-300  border-amber-500/25',
    reviewing:       'bg-blue-500/15   text-blue-300   border-blue-500/25',
    'rebirth-ready': 'bg-purple-500/15 text-purple-300 border-purple-500/25',
    approved:        'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  };
  return map[status] ?? 'bg-white/10 text-white/60 border-white/15';
}

function confidenceCls(c: string): string {
  return { high: 'text-emerald-400', medium: 'text-amber-400', low: 'text-red-400' }[c] ?? 'text-white/50';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ScannerConsoleClient({
  sources,
  enabledSources,
  initialReviewSignals,
  initialReadySignals,
  stats,
}: ScannerConsoleClientProps) {
  const router = useRouter();

  // Scan state
  const [scanPhase,   setScanPhase]   = useState<'idle' | 'scanning' | 'done'>('idle');
  const [scanResults, setScanResults] = useState<SessionSourceResult[]>([]);
  const [scanError,   setScanError]   = useState<string | null>(null);
  const [candStates,  setCandStates]  = useState<Map<string, CandidateState>>(new Map());

  // Review state
  const [reviewSignals,  setReviewSignals]  = useState<DbRecoveredSignal[]>(initialReviewSignals);
  const [statusChanging, setStatusChanging] = useState<string | null>(null);

  // Publish state
  const [readySignals,  setReadySignals]  = useState<DbRecoveredSignal[]>(initialReadySignals);
  const [prepareOpenId, setPrepareOpenId] = useState<string | null>(null);
  const [publishing,    setPublishing]    = useState<string | null>(null);
  const [lastPublished, setLastPublished] = useState<PublishedResult | null>(null);
  const [copied,        setCopied]        = useState<'tg' | 'x' | null>(null);

  // ── Scan handlers ────────────────────────────────────────────────────────

  async function handleRunScan() {
    if (!enabledSources.length) return;
    setScanPhase('scanning');
    setScanError(null);
    setScanResults([]);
    setCandStates(new Map());
    const res = await runFetchSessionAction(enabledSources.map((s) => s.id));
    if ('error' in res) {
      setScanError(res.error);
      setScanPhase('idle');
      return;
    }
    setScanResults(res.results);
    setScanPhase('done');
  }

  async function handleQueueCandidate(result: SessionSourceResult) {
    if (result.status === 'error') return;
    const key = result.sourceId;
    setCandStates((prev) => new Map(prev).set(key, { action: 'queueing' }));
    const c = result.candidate;
    const qr = await queueFetchedCandidateAction({
      sourceId:          result.sourceId,
      title:             c.title,
      summary:           c.summary,
      sourceUrl:         c.sourceUrl,
      category:          c.category,
      tags:              c.tags,
      anomalyScore:      c.anomalyScore,
      overrideDuplicate: true,
      sourceImageUrl:    c.sourceImageUrl,
      mediaType:         c.mediaType,
      attributionText:   c.attributionText,
      captureNotes:      c.captureNotes,
    });
    if ('error' in qr) {
      setCandStates((prev) => new Map(prev).set(key, { action: 'error', error: qr.error }));
    } else {
      setCandStates((prev) => new Map(prev).set(key, { action: 'queued' }));
      router.refresh();
    }
  }

  function handleSkip(sourceId: string) {
    setCandStates((prev) => new Map(prev).set(sourceId, { action: 'skipped' }));
  }

  // ── Review handlers ──────────────────────────────────────────────────────

  async function handleStatusChange(
    signalId: string,
    newStatus: 'rebirth-ready' | 'rejected' | 'archived',
  ) {
    setStatusChanging(signalId);
    const result = await updateSignalStatusAction({ id: signalId, status: newStatus });
    setStatusChanging(null);
    if ('error' in result) { alert(`Error: ${result.error}`); return; }
    if (newStatus === 'rebirth-ready') {
      const sig = reviewSignals.find((s) => s.id === signalId);
      if (sig) setReadySignals((prev) => [{ ...sig, status: 'rebirth-ready' }, ...prev]);
    }
    setReviewSignals((prev) => prev.filter((s) => s.id !== signalId));
  }

  // ── Publish handlers ─────────────────────────────────────────────────────

  async function handlePublish(
    signalId: string,
    form: { title: string; body: string; category: string; tags: string },
  ) {
    setPublishing(signalId);
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const result = await rebirthSignalAsThreadAction({
      signalId,
      title:    form.title,
      body:     form.body,
      category: form.category,
      tags,
    });
    setPublishing(null);
    if ('error' in result) { alert(`Publish error: ${result.error}`); return; }
    const sig = readySignals.find((s) => s.id === signalId);
    const shareData = {
      title:        form.title,
      category:     form.category,
      summary:      form.body.slice(0, 200),
      threadSlug:   result.threadSlug,
      sourceName:   sig?.source_name,
      anomalyScore: sig?.anomaly_score,
      tags,
    };
    setLastPublished({
      threadSlug:   result.threadSlug,
      title:        form.title,
      telegramText: formatTelegramPost(shareData),
      xText:        formatXPost(shareData),
    });
    setReadySignals((prev) => prev.filter((s) => s.id !== signalId));
    setPrepareOpenId(null);
    setCopied(null);
  }

  async function handleCopy(text: string, which: 'tg' | 'x') {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 pb-16">

      {/* ── Page header ── */}
      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[14px]">
          <a href="/scanner/admin"   className="text-slate-500 transition-colors hover:text-slate-300">Admin Hub</a>
          <span className="text-slate-700">/</span>
          <a href="/scanner/sources" className="text-slate-500 transition-colors hover:text-slate-300">Sources</a>
          <span className="text-slate-700">/</span>
          <a href="/scanner/queue"   className="text-slate-500 transition-colors hover:text-slate-300">Queue (Advanced)</a>
        </div>
        <h1 className="mb-2 text-[38px] font-bold tracking-tight text-white">Scanner Console</h1>
        <p className="text-[17px] text-slate-400">
          Scan real sources, review recovered signals, publish to SWIM / X / Telegram.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {[
            { label: 'Total Recovered', value: stats.totalRecovered,  accent: false },
            { label: 'Pending Review',  value: stats.pendingReview,   accent: stats.pendingReview > 0 },
            { label: 'Threads Reborn',  value: stats.threadsReborn,   accent: false },
          ].map(({ label, value, accent }) => (
            <div key={label} className="flex items-baseline gap-2 rounded border border-white/8 bg-white/[0.025] px-4 py-2.5">
              <span className={`font-mono text-[22px] font-bold ${accent ? 'text-amber-300' : 'text-emerald-400'}`}>
                {value}
              </span>
              <span className="text-[14px] text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3-column grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ══ 1 · SCAN ══ */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-white/8">
          <div className="border-b border-white/8 bg-white/[0.03] px-5 py-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[13px] font-bold text-emerald-400">
                1
              </span>
              <h2 className="text-[20px] font-bold text-white">Scan</h2>
            </div>
            <p className="text-[14px] text-slate-500">
              {enabledSources.length > 0
                ? `${enabledSources.length} source${enabledSources.length !== 1 ? 's' : ''} enabled`
                : 'No sources enabled'}
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-5">
            {enabledSources.length === 0 ? (
              <div className="rounded border border-white/6 bg-white/[0.02] p-5 text-center">
                <p className="mb-3 text-[15px] text-slate-400">No sources are enabled yet.</p>
                <a
                  href="/scanner/sources"
                  className="inline-flex h-10 items-center rounded border border-emerald-500/40 px-4 text-[14px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10"
                >
                  Manage Sources →
                </a>
              </div>
            ) : (
              <>
                {/* Enabled source chips */}
                <div className="flex flex-wrap gap-1.5">
                  {enabledSources.slice(0, 3).map((s) => (
                    <span key={s.id} className="rounded border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[13px] text-slate-400">
                      {s.name}
                    </span>
                  ))}
                  {enabledSources.length > 3 && (
                    <span className="rounded border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[13px] text-slate-500">
                      +{enabledSources.length - 3} more
                    </span>
                  )}
                </div>

                <button
                  onClick={handleRunScan}
                  disabled={scanPhase === 'scanning'}
                  className="flex min-h-[56px] w-full items-center justify-center rounded bg-emerald-500 px-5 text-[17px] font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
                >
                  {scanPhase === 'scanning' ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                      Scanning…
                    </span>
                  ) : 'Run Scan'}
                </button>

                <a
                  href="/scanner/sources"
                  className="flex h-10 w-full items-center justify-center rounded border border-white/12 text-[14px] font-semibold text-slate-400 transition-colors hover:border-white/20 hover:text-slate-300"
                >
                  Manage Sources
                </a>
              </>
            )}

            {scanError && (
              <div className="rounded border border-red-500/25 bg-red-500/10 p-3 text-[14px] text-red-300">
                {scanError}
              </div>
            )}

            {/* Scan results */}
            {scanPhase === 'done' && scanResults.length === 0 && (
              <p className="text-center text-[14px] text-slate-500">No results returned.</p>
            )}

            {scanPhase === 'done' && scanResults.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-[14px] font-semibold text-slate-400">
                  {scanResults.length} result{scanResults.length !== 1 ? 's' : ''}
                </p>
                {scanResults.map((result) => {
                  const st = candStates.get(result.sourceId) ?? { action: 'idle' as CandidateAction };
                  return (
                    <div key={result.sourceId} className="rounded border border-white/8 bg-white/[0.025] p-4">
                      <p className="mb-0.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                        {result.sourceName}
                      </p>
                      {result.status === 'error' ? (
                        <p className="text-[14px] text-red-300">Error: {result.error}</p>
                      ) : (
                        <>
                          <p className="mb-1 text-[15px] font-semibold leading-snug text-white">
                            {result.candidate.title}
                          </p>
                          <p className="mb-2 line-clamp-3 text-[13px] text-slate-400">
                            {result.candidate.summary}
                          </p>
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className={`text-[12px] font-semibold ${confidenceCls(result.candidate.extractionConfidence)}`}>
                              {result.candidate.extractionConfidence} confidence
                            </span>
                            {result.status === 'duplicate' && (
                              <span className="text-[12px] text-amber-400">⚠ duplicate detected</span>
                            )}
                          </div>

                          {st.action === 'idle' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleQueueCandidate(result)}
                                className="flex-1 rounded bg-emerald-500/90 px-3 py-2 text-[14px] font-bold text-black transition-colors hover:bg-emerald-400"
                              >
                                Queue Candidate
                              </button>
                              <button
                                onClick={() => handleSkip(result.sourceId)}
                                className="rounded border border-white/12 px-3 py-2 text-[14px] text-slate-400 transition-colors hover:border-white/20"
                              >
                                Skip
                              </button>
                            </div>
                          )}
                          {st.action === 'queueing' && (
                            <p className="text-[13px] text-slate-400">Queueing…</p>
                          )}
                          {st.action === 'queued' && (
                            <p className="text-[13px] text-emerald-400">✓ Queued — now in Review</p>
                          )}
                          {st.action === 'skipped' && (
                            <p className="text-[13px] text-slate-500">Skipped</p>
                          )}
                          {st.action === 'error' && (
                            <p className="text-[13px] text-red-300">Error: {st.error}</p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══ 2 · REVIEW ══ */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-white/8">
          <div className="border-b border-white/8 bg-white/[0.03] px-5 py-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[13px] font-bold text-amber-400">
                2
              </span>
              <h2 className="text-[20px] font-bold text-white">Review</h2>
              {reviewSignals.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[13px] font-bold text-amber-300">
                  {reviewSignals.length}
                </span>
              )}
            </div>
            <p className="text-[14px] text-slate-500">Approve signals to move them to Publish</p>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
            {reviewSignals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-[15px] text-slate-500">No signals to review.</p>
                <p className="mt-1 text-[13px] text-slate-600">Queue some candidates from Scan.</p>
              </div>
            ) : (
              reviewSignals.map((sig) => {
                const isChanging = statusChanging === sig.id;
                return (
                  <div key={sig.id} className="rounded border border-white/8 bg-white/[0.025] p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className={`rounded border px-2 py-0.5 text-[12px] font-semibold ${statusBadgeCls(sig.status)}`}>
                        {statusLabel(sig.status)}
                      </span>
                      <span className="shrink-0 text-[12px] text-slate-600">{sig.category}</span>
                    </div>

                    <p className="mb-1 text-[15px] font-semibold leading-snug text-white">{sig.title}</p>
                    <p className="mb-1 text-[13px] text-slate-400">{sig.source_name}</p>
                    <p className="mb-3 line-clamp-4 text-[13px] leading-relaxed text-slate-400">
                      {sig.summary}
                    </p>

                    {sig.source_image_url && (
                      <img
                        src={sig.source_image_url}
                        alt=""
                        className="mb-3 h-28 w-full rounded object-cover opacity-80"
                      />
                    )}

                    {sig.source_url && (
                      <a
                        href={sig.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-3 block truncate text-[12px] text-emerald-400/60 transition-colors hover:text-emerald-400"
                      >
                        {sig.source_url}
                      </a>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleStatusChange(sig.id, 'rebirth-ready')}
                        disabled={isChanging}
                        className="flex-1 rounded border border-emerald-500/40 px-3 py-2 text-[14px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-40"
                      >
                        {isChanging ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleStatusChange(sig.id, 'rejected')}
                        disabled={isChanging}
                        className="rounded border border-red-400/30 px-3 py-2 text-[14px] font-semibold text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-40"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleStatusChange(sig.id, 'archived')}
                        disabled={isChanging}
                        className="rounded border border-slate-500/30 px-3 py-2 text-[14px] font-semibold text-slate-400 transition-colors hover:bg-slate-500/10 disabled:opacity-40"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ══ 3 · PUBLISH ══ */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-white/8">
          <div className="border-b border-white/8 bg-white/[0.03] px-5 py-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[13px] font-bold text-purple-400">
                3
              </span>
              <h2 className="text-[20px] font-bold text-white">Publish</h2>
              {readySignals.length > 0 && (
                <span className="ml-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-[13px] font-bold text-purple-300">
                  {readySignals.length}
                </span>
              )}
            </div>
            <p className="text-[14px] text-slate-500">Compose threads, then publish</p>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">

            {/* Published success banner */}
            {lastPublished && (
              <div className="rounded border border-emerald-500/25 bg-emerald-500/8 p-4">
                <p className="mb-1 text-[13px] font-semibold text-emerald-400">Published!</p>
                <p className="mb-3 text-[14px] font-medium leading-snug text-white">
                  {lastPublished.title}
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/threads/${lastPublished.threadSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-emerald-500/30 px-3 py-1.5 text-[13px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10"
                  >
                    Open Thread →
                  </a>
                  <button
                    onClick={() => handleCopy(lastPublished.xText, 'x')}
                    className="rounded border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-slate-300 transition-colors hover:bg-white/5"
                  >
                    {copied === 'x' ? '✓ Copied' : 'Copy X Post'}
                  </button>
                  <button
                    onClick={() => handleCopy(lastPublished.telegramText, 'tg')}
                    className="rounded border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-slate-300 transition-colors hover:bg-white/5"
                  >
                    {copied === 'tg' ? '✓ Copied' : 'Copy Telegram'}
                  </button>
                </div>
              </div>
            )}

            {readySignals.length === 0 && !lastPublished && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-[15px] text-slate-500">No signals ready to publish.</p>
                <p className="mt-1 text-[13px] text-slate-600">Approve signals in Review first.</p>
              </div>
            )}

            {readySignals.map((sig) => (
              <ReadyCard
                key={sig.id}
                signal={sig}
                isOpen={prepareOpenId === sig.id}
                isPublishing={publishing === sig.id}
                onToggle={() =>
                  setPrepareOpenId((prev) => (prev === sig.id ? null : sig.id))
                }
                onPublish={(form) => handlePublish(sig.id, form)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReadyCard — signal approved and ready to publish (inline thread editor)
// ---------------------------------------------------------------------------

interface ReadyCardProps {
  signal:      DbRecoveredSignal;
  isOpen:      boolean;
  isPublishing: boolean;
  onToggle:    () => void;
  onPublish:   (form: { title: string; body: string; category: string; tags: string }) => void;
}

function ReadyCard({ signal, isOpen, isPublishing, onToggle, onPublish }: ReadyCardProps) {
  const [title,    setTitle]    = useState(signal.title);
  const [body,     setBody]     = useState(signal.summary);
  const [category, setCategory] = useState(signal.category);
  const [tags,     setTags]     = useState(signal.tags.join(', '));

  return (
    <div className="rounded border border-white/8 bg-white/[0.025]">
      {/* Card summary — always visible */}
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="rounded border border-purple-500/25 bg-purple-500/15 px-2 py-0.5 text-[12px] font-semibold text-purple-300">
            Ready
          </span>
          <span className="shrink-0 text-[12px] text-slate-600">{signal.category}</span>
        </div>
        <p className="mb-1 text-[15px] font-semibold leading-snug text-white">{signal.title}</p>
        <p className="mb-3 text-[13px] text-slate-400">{signal.source_name}</p>
        <button
          onClick={onToggle}
          className="flex min-h-[48px] w-full items-center justify-center rounded border border-purple-500/40 px-4 text-[15px] font-semibold text-purple-300 transition-colors hover:bg-purple-500/10"
        >
          {isOpen ? 'Close Editor' : 'Prepare Thread'}
        </button>
      </div>

      {/* Inline thread editor */}
      {isOpen && (
        <div className="border-t border-white/8 p-4">
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-slate-400">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-white/12 bg-white/[0.04] px-3 py-2 text-[15px] text-white placeholder:text-slate-600 focus:border-white/25 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-semibold text-slate-400">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                className="w-full resize-y rounded border border-white/12 bg-white/[0.04] px-3 py-2 text-[14px] leading-relaxed text-white/85 placeholder:text-slate-600 focus:border-white/25 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-semibold text-slate-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border border-white/12 bg-[#0d1612] px-3 py-2 text-[14px] text-white focus:border-white/25 focus:outline-none"
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-semibold text-slate-400">
                Tags{' '}
                <span className="font-normal text-slate-600">comma separated</span>
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="w-full rounded border border-white/12 bg-white/[0.04] px-3 py-2 text-[14px] text-white placeholder:text-slate-600 focus:border-white/25 focus:outline-none"
              />
            </div>

            <button
              onClick={() => onPublish({ title, body, category, tags })}
              disabled={isPublishing || !title.trim() || !body.trim()}
              className="flex min-h-[52px] w-full items-center justify-center rounded bg-emerald-500 px-5 text-[16px] font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
            >
              {isPublishing ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  Publishing…
                </span>
              ) : (
                'Publish to SWIM'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
