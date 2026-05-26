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
// Reusable button styles
// ---------------------------------------------------------------------------

const BTN_PRIMARY  = 'flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-[18px] font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_GHOST    = 'flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 text-[17px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white';
const BTN_APPROVE  = 'flex flex-1 min-h-[56px] items-center justify-center rounded-2xl bg-emerald-600/25 border border-emerald-500/45 text-[17px] font-bold text-emerald-300 transition-colors hover:bg-emerald-600/45 disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_REJECT   = 'flex min-h-[56px] items-center justify-center rounded-2xl bg-red-700/20 border border-red-500/35 px-5 text-[17px] font-bold text-red-300 transition-colors hover:bg-red-700/38 disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_ARCHIVE  = 'flex min-h-[56px] items-center justify-center rounded-2xl bg-slate-700/30 border border-slate-500/35 px-5 text-[17px] font-bold text-slate-300 transition-colors hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_PREPARE  = 'flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-purple-700/20 border border-purple-500/40 text-[18px] font-bold text-purple-200 transition-colors hover:bg-purple-700/38';
const BTN_QUEUE    = 'flex flex-1 min-h-[56px] items-center justify-center rounded-2xl bg-emerald-500 text-[17px] font-bold text-black transition-colors hover:bg-emerald-400';
const BTN_SKIP     = 'flex min-h-[56px] items-center justify-center rounded-2xl bg-slate-700/30 border border-white/12 px-5 text-[17px] font-semibold text-slate-400 transition-colors hover:bg-slate-700/50';
const BTN_PUBLISH  = 'flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-[18px] font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed';

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
  return map[status] ?? 'bg-white/10 text-slate-300 border-white/15';
}

function confidenceCls(c: string): string {
  return (
    { high: 'text-emerald-400 bg-emerald-400/10', medium: 'text-amber-400 bg-amber-400/10', low: 'text-red-400 bg-red-400/10' }[c] ??
    'text-slate-400 bg-slate-400/10'
  );
}

function Spinner() {
  return (
    <span className="inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-current/20 border-t-current" />
  );
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
  const [scanPhase,      setScanPhase]      = useState<'idle' | 'scanning' | 'done'>('idle');
  const [scanResults,    setScanResults]    = useState<SessionSourceResult[]>([]);
  const [scanError,      setScanError]      = useState<string | null>(null);
  const [candStates,     setCandStates]     = useState<Map<string, CandidateState>>(new Map());
  const [sourceViewOpen, setSourceViewOpen] = useState<Set<string>>(new Set());

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
    setTimeout(() => setCopied(null), 2500);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-8 pb-20 md:px-8">

      {/* ── Page header ── */}
      <div className="mb-10">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[14px] text-slate-500">
          <a href="/scanner/admin"   className="transition-colors hover:text-slate-300">Admin Hub</a>
          <span>/</span>
          <a href="/scanner/sources" className="transition-colors hover:text-slate-300">Sources</a>
          <span>/</span>
          <a href="/scanner/queue"   className="transition-colors hover:text-slate-300">Queue (Advanced)</a>
        </div>

        <h1 className="mb-2 text-[42px] font-bold leading-tight tracking-tight text-white md:text-[48px]">
          Scanner Console
        </h1>
        <p className="mb-6 text-[19px] text-slate-400">
          Scan sources, review signals, publish to SWIM / X / Telegram.
        </p>

        {/* Stats row */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Total Recovered', value: stats.totalRecovered,  warn: false },
            { label: 'Pending Review',  value: stats.pendingReview,   warn: stats.pendingReview > 0 },
            { label: 'Threads Reborn',  value: stats.threadsReborn,   warn: false },
          ].map(({ label, value, warn }) => (
            <div key={label} className="flex items-baseline gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-3">
              <span className={`font-mono text-[26px] font-bold ${warn ? 'text-amber-300' : 'text-emerald-400'}`}>
                {value}
              </span>
              <span className="text-[15px] text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3-column grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ══ 1 · SCAN ══ */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">

          {/* Column header */}
          <div className="border-b border-white/8 px-6 py-5">
            <div className="mb-1 flex items-center gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[15px] font-bold text-emerald-400">
                1
              </span>
              <h2 className="text-[22px] font-bold text-white">Scan</h2>
            </div>
            <p className="text-[15px] text-slate-500">
              {enabledSources.length > 0
                ? `${enabledSources.length} source${enabledSources.length !== 1 ? 's' : ''} enabled`
                : 'No sources enabled — add sources first'}
            </p>
          </div>

          {/* Column body */}
          <div className="flex flex-1 flex-col gap-4 p-5">

            {enabledSources.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 text-center">
                <p className="mb-4 text-[16px] text-slate-400">No sources are enabled yet.</p>
                <a href="/scanner/sources" className={BTN_GHOST}>
                  Manage Sources →
                </a>
              </div>
            ) : (
              <>
                {/* Enabled source pills */}
                <div className="flex flex-wrap gap-2">
                  {enabledSources.slice(0, 3).map((s) => (
                    <span key={s.id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] text-slate-400">
                      {s.name}
                    </span>
                  ))}
                  {enabledSources.length > 3 && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] text-slate-500">
                      +{enabledSources.length - 3} more
                    </span>
                  )}
                </div>

                <button onClick={handleRunScan} disabled={scanPhase === 'scanning'} className={BTN_PRIMARY}>
                  {scanPhase === 'scanning' ? <><Spinner /> Scanning…</> : 'Run Scan'}
                </button>

                <a href="/scanner/sources" className={BTN_GHOST}>
                  Manage Sources
                </a>
              </>
            )}

            {/* Scan error */}
            {scanError && (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-[15px] text-red-300">
                {scanError}
              </div>
            )}

            {/* No results */}
            {scanPhase === 'done' && scanResults.length === 0 && (
              <p className="text-center text-[15px] text-slate-500">No results returned from sources.</p>
            )}

            {/* Candidate cards */}
            {scanPhase === 'done' && scanResults.length > 0 && (
              <div className="flex flex-col gap-4">
                <p className="text-[15px] font-semibold text-slate-400">
                  {scanResults.length} result{scanResults.length !== 1 ? 's' : ''}
                </p>

                {scanResults.map((result) => {
                  const st         = candStates.get(result.sourceId) ?? { action: 'idle' as CandidateAction };
                  const svOpen     = sourceViewOpen.has(result.sourceId);
                  const toggleSV   = () => setSourceViewOpen((prev) => {
                    const next = new Set(prev);
                    svOpen ? next.delete(result.sourceId) : next.add(result.sourceId);
                    return next;
                  });
                  return (
                    <div key={result.sourceId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <p className="mb-1 text-[12px] font-semibold uppercase tracking-widest text-slate-500">
                        {result.sourceName}
                      </p>

                      {result.status === 'error' ? (
                        <p className="text-[15px] text-red-300">Error: {result.error}</p>
                      ) : (
                        <>
                          <p className="mb-1.5 text-[17px] font-bold leading-snug text-white">
                            {result.candidate.title}
                          </p>

                          {/* Source page URL */}
                          <a
                            href={result.candidate.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mb-3 block truncate text-[12px] text-slate-600 transition-colors hover:text-slate-400"
                          >
                            {result.candidate.sourceUrl}
                          </a>

                          {/* Index page warning */}
                          {result.candidate.isIndexPage && (
                            <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
                              <p className="text-[13px] font-bold text-amber-300">Index page — discovery recommended</p>
                              <p className="mt-0.5 text-[12px] text-amber-400/65">This looks like a site front page. Use Discover Links instead of queueing this directly.</p>
                            </div>
                          )}

                          {/* Extracted preview */}
                          <p className="mb-3 text-[16px] leading-relaxed text-slate-300 line-clamp-4">
                            {result.candidate.summary}
                          </p>

                          {/* Evidence image */}
                          {result.candidate.sourceImageUrl && (
                            <img
                              src={result.candidate.sourceImageUrl}
                              alt=""
                              className="mb-3 h-32 w-full rounded-xl object-cover opacity-85"
                            />
                          )}

                          {/* Badges */}
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${confidenceCls(result.candidate.extractionConfidence)}`}>
                              {result.candidate.extractionConfidence} confidence
                            </span>
                            {result.candidate.sourceType && (
                              <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-[13px] font-semibold text-sky-400">
                                {result.candidate.sourceType}
                              </span>
                            )}
                            {result.candidate.isArchived ? (
                              <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[13px] font-semibold text-violet-400">
                                archived
                              </span>
                            ) : (
                              result.candidate.sourceType && (
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1 text-[13px] font-semibold text-emerald-400/70">
                                  live
                                </span>
                              )
                            )}
                            {result.candidate.archivedAt && (
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] text-slate-500">
                                {result.candidate.archivedAt.slice(0, 10)}
                              </span>
                            )}
                            {result.status === 'duplicate' && (
                              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[13px] font-semibold text-amber-400">
                                ⚠ duplicate detected
                              </span>
                            )}
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] text-slate-500">
                              {result.candidate.category}
                            </span>
                            {result.candidate.passReason && (
                              <span className="rounded-full border border-white/8 bg-white/4 px-3 py-1 text-[12px] text-slate-600">
                                ✓ {result.candidate.passReason}
                              </span>
                            )}
                          </div>

                          {/* Original Source View toggle */}
                          <button
                            onClick={toggleSV}
                            className="mb-3 text-[12px] font-semibold text-slate-600 underline-offset-2 hover:text-slate-400 hover:underline"
                          >
                            {svOpen ? '▾ Hide source preview' : '▸ View source preview'}
                          </button>

                          {svOpen && (
                            <div className="mb-4 rounded-xl border border-white/8 bg-black/30 p-4 text-[13px]">
                              <a
                                href={result.candidate.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mb-2 block break-all font-mono text-emerald-400/70 hover:text-emerald-400"
                              >
                                {result.candidate.sourceUrl}
                              </a>
                              <p className="mb-2 font-semibold text-white">{result.candidate.title}</p>
                              <p className="mb-3 leading-relaxed text-slate-400">{result.candidate.summary}</p>
                              {result.candidate.sourceImageUrl && (
                                <img
                                  src={result.candidate.sourceImageUrl}
                                  alt=""
                                  className="mb-2 h-24 w-full rounded-lg object-cover opacity-75"
                                />
                              )}
                              {result.candidate.attributionText && (
                                <p className="text-slate-600">{result.candidate.attributionText}</p>
                              )}
                            </div>
                          )}

                          {/* Index page queue warning */}
                          {result.candidate.isIndexPage && st.action === 'idle' && (
                            <p className="mb-2 text-[12px] text-amber-400/70">
                              Queue only if this is an actual story or article, not a site index.
                            </p>
                          )}

                          {st.action === 'idle' && (
                            <div className="flex gap-3">
                              <button onClick={() => handleQueueCandidate(result)} className={BTN_QUEUE}>
                                Queue Candidate
                              </button>
                              <button onClick={() => handleSkip(result.sourceId)} className={BTN_SKIP}>
                                Skip
                              </button>
                            </div>
                          )}
                          {st.action === 'queueing' && (
                            <p className="flex items-center gap-2 text-[15px] text-slate-400">
                              <Spinner /> Queueing…
                            </p>
                          )}
                          {st.action === 'queued' && (
                            <p className="text-[15px] font-semibold text-emerald-400">✓ Queued — now in Review</p>
                          )}
                          {st.action === 'skipped' && (
                            <p className="text-[15px] text-slate-500">Skipped</p>
                          )}
                          {st.action === 'error' && (
                            <div>
                              <p className="text-[15px] text-red-300">{st.error}</p>
                              {st.error?.includes('Missing Supabase column') && (
                                <p className="mt-1 text-[13px] text-red-400/60">Run the recovered_signals migration in your Supabase project to add the missing column.</p>
                              )}
                            </div>
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
        <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">

          <div className="border-b border-white/8 px-6 py-5">
            <div className="mb-1 flex items-center gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[15px] font-bold text-amber-400">
                2
              </span>
              <h2 className="text-[22px] font-bold text-white">Review</h2>
              {reviewSignals.length > 0 && (
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[14px] font-bold text-amber-300">
                  {reviewSignals.length}
                </span>
              )}
            </div>
            <p className="text-[15px] text-slate-500">Approve to move a signal to Publish</p>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">

            {reviewSignals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-[17px] text-slate-500">No signals to review.</p>
                <p className="mt-2 text-[15px] text-slate-600">Queue candidates from Scan first.</p>
              </div>
            ) : (
              reviewSignals.map((sig) => {
                const isChanging = statusChanging === sig.id;
                return (
                  <div key={sig.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

                    {/* Status + category */}
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <span className={`rounded-full border px-3 py-1 text-[13px] font-bold ${statusBadgeCls(sig.status)}`}>
                        {statusLabel(sig.status)}
                      </span>
                      <span className="shrink-0 rounded-full bg-white/6 px-3 py-1 text-[13px] text-slate-500">
                        {sig.category}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="mb-1.5 text-[17px] font-bold leading-snug text-white">{sig.title}</p>

                    {/* Source badge */}
                    <p className="mb-2 text-[14px] text-slate-500">{sig.source_name}</p>

                    {/* Summary */}
                    <p className="mb-4 text-[16px] leading-relaxed text-slate-300 line-clamp-4">
                      {sig.summary}
                    </p>

                    {/* Evidence image */}
                    {sig.source_image_url && (
                      <img
                        src={sig.source_image_url}
                        alt=""
                        className="mb-4 h-32 w-full rounded-xl object-cover opacity-80"
                      />
                    )}

                    {/* Source link */}
                    {sig.source_url && (
                      <a
                        href={sig.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-4 block truncate text-[13px] text-emerald-400/60 transition-colors hover:text-emerald-400"
                      >
                        {sig.source_url}
                      </a>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => handleStatusChange(sig.id, 'rebirth-ready')} disabled={isChanging} className={BTN_APPROVE}>
                        {isChanging ? <Spinner /> : 'Approve'}
                      </button>
                      <button onClick={() => handleStatusChange(sig.id, 'rejected')}  disabled={isChanging} className={BTN_REJECT}>
                        Reject
                      </button>
                      <button onClick={() => handleStatusChange(sig.id, 'archived')}  disabled={isChanging} className={BTN_ARCHIVE}>
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
        <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">

          <div className="border-b border-white/8 px-6 py-5">
            <div className="mb-1 flex items-center gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[15px] font-bold text-purple-400">
                3
              </span>
              <h2 className="text-[22px] font-bold text-white">Publish</h2>
              {readySignals.length > 0 && (
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[14px] font-bold text-purple-300">
                  {readySignals.length}
                </span>
              )}
            </div>
            <p className="text-[15px] text-slate-500">Compose threads, then publish to SWIM</p>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">

            {/* Published success banner */}
            {lastPublished && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-5">
                <p className="mb-1 text-[14px] font-bold uppercase tracking-wider text-emerald-400">
                  Published
                </p>
                <p className="mb-4 text-[17px] font-semibold leading-snug text-white">
                  {lastPublished.title}
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`/threads/${lastPublished.threadSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[52px] items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/40 px-4 text-[15px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/30"
                  >
                    Open Thread →
                  </a>
                  <button
                    onClick={() => handleCopy(lastPublished.xText, 'x')}
                    className="flex min-h-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 text-[15px] font-semibold text-slate-300 transition-colors hover:bg-white/10"
                  >
                    {copied === 'x' ? '✓ Copied' : 'Copy X Post'}
                  </button>
                  <button
                    onClick={() => handleCopy(lastPublished.telegramText, 'tg')}
                    className="flex min-h-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 text-[15px] font-semibold text-slate-300 transition-colors hover:bg-white/10"
                  >
                    {copied === 'tg' ? '✓ Copied' : 'Copy Telegram'}
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {readySignals.length === 0 && !lastPublished && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-[17px] text-slate-500">No signals ready to publish.</p>
                <p className="mt-2 text-[15px] text-slate-600">Approve signals in Review first.</p>
              </div>
            )}

            {/* Ready signal cards */}
            {readySignals.map((sig) => (
              <ReadyCard
                key={sig.id}
                signal={sig}
                isOpen={prepareOpenId === sig.id}
                isPublishing={publishing === sig.id}
                onToggle={() => setPrepareOpenId((prev) => (prev === sig.id ? null : sig.id))}
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
// ReadyCard — approved signal with inline thread composer
// ---------------------------------------------------------------------------

interface ReadyCardProps {
  signal:       DbRecoveredSignal;
  isOpen:       boolean;
  isPublishing: boolean;
  onToggle:     () => void;
  onPublish:    (form: { title: string; body: string; category: string; tags: string }) => void;
}

function ReadyCard({ signal, isOpen, isPublishing, onToggle, onPublish }: ReadyCardProps) {
  const [title,    setTitle]    = useState(signal.title);
  const [body,     setBody]     = useState(signal.summary);
  const [category, setCategory] = useState(signal.category);
  const [tags,     setTags]     = useState(signal.tags.join(', '));

  const inputCls = 'w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder:text-slate-600 focus:border-white/28 focus:outline-none transition-colors';

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">

      {/* Summary row — always visible */}
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="rounded-full border border-purple-500/25 bg-purple-500/15 px-3 py-1 text-[13px] font-bold text-purple-300">
            Ready
          </span>
          <span className="shrink-0 rounded-full bg-white/6 px-3 py-1 text-[13px] text-slate-500">
            {signal.category}
          </span>
        </div>
        <p className="mb-1.5 text-[17px] font-bold leading-snug text-white">{signal.title}</p>
        <p className="mb-4 text-[14px] text-slate-500">{signal.source_name}</p>
        <button onClick={onToggle} className={`${BTN_PREPARE}`}>
          {isOpen ? 'Close Editor' : 'Prepare Thread'}
        </button>
      </div>

      {/* Inline thread composer */}
      {isOpen && (
        <div className="border-t border-white/8 p-5">
          <div className="flex flex-col gap-4">

            <div>
              <label className="mb-2 block text-[14px] font-semibold text-slate-400">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className="mb-2 block text-[14px] font-semibold text-slate-400">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className={`${inputCls} resize-y leading-relaxed`}
              />
            </div>

            <div>
              <label className="mb-2 block text-[14px] font-semibold text-slate-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`${inputCls} bg-[#111a15]`}
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[14px] font-semibold text-slate-400">
                Tags <span className="font-normal text-slate-600">comma separated</span>
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className={inputCls}
              />
            </div>

            <button
              onClick={() => onPublish({ title, body, category, tags })}
              disabled={isPublishing || !title.trim() || !body.trim()}
              className={`${BTN_PUBLISH}`}
            >
              {isPublishing ? <><Spinner /> Publishing…</> : 'Publish to SWIM'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
