'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  runFetchSessionAction,
  queueFetchedCandidateAction,
  updateSignalStatusAction,
  rebirthSignalAsThreadAction,
} from '@/app/actions';
import { getSourceRecommendation } from '@/lib/source-utils';
import { SCAN_PRESETS, PRESET_ALL, type ScanPreset } from '@/lib/scan-presets';
import { formatTelegramPost, formatXPost } from '@/lib/social-formatters';
import { CATEGORY_ORDER } from '@/lib/forum-types';
import type { DbScannerSource, DbRecoveredSignal } from '@/lib/supabase/types';
import type { SessionSourceResult, FetchedCandidate } from '@/lib/scanner-fetch-types';

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

function Spinner() {
  return (
    <span className="inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-current/20 border-t-current" />
  );
}

function relativeAge(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30)  return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12)  return `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

function sourceTypeBadgeCls(type: string): string {
  const map: Record<string, string> = {
    reddit:      'border-orange-500/30 bg-orange-500/10 text-orange-400',
    wayback:     'border-violet-500/30 bg-violet-500/10 text-violet-400',
    mediawiki:   'border-sky-500/30    bg-sky-500/10    text-sky-400',
    forum:       'border-amber-500/30  bg-amber-500/10  text-amber-400',
    imageboard:  'border-pink-500/30   bg-pink-500/10   text-pink-400',
    archive:     'border-violet-500/30 bg-violet-500/10 text-violet-400',
    bbs:         'border-amber-500/30  bg-amber-500/10  text-amber-400',
    pastebin:    'border-slate-500/25  bg-slate-500/8   text-slate-400',
    irc:         'border-slate-500/25  bg-slate-500/8   text-slate-400',
  };
  return map[type] ?? 'border-slate-500/20 bg-slate-500/6 text-slate-400';
}

function sourceReliabilityLabel(sourceType: string): string {
  const map: Record<string, string> = {
    reddit:     'Community posts',
    wayback:    'Archived web',
    mediawiki:  'Wiki article',
    forum:      'Forum thread',
    imageboard: 'Imageboard',
    pastebin:   'Paste',
    irc:        'IRC log',
    other:      'External source',
  };
  return map[sourceType] ?? 'External source';
}

function EvidenceBlock({ candidate }: { candidate: FetchedCandidate }) {
  const { sourceType } = candidate;

  if (sourceType === 'reddit' && (candidate.redditSubreddit ?? candidate.redditAuthor)) {
    return (
      <div className="mb-3 rounded-xl border border-orange-500/12 bg-orange-500/[0.03] px-3 py-2.5">
        <div className="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          {candidate.redditSubreddit && (
            <span className="text-[13px] font-semibold text-orange-400/80">r/{candidate.redditSubreddit}</span>
          )}
          {candidate.redditAuthor && (
            <span className="text-[12px] text-slate-500">u/{candidate.redditAuthor}</span>
          )}
          {candidate.redditScore != null && (
            <span className="text-[12px] font-semibold text-slate-400">{candidate.redditScore}↑</span>
          )}
          {candidate.redditComments != null && (
            <span className="text-[12px] text-slate-500">{candidate.redditComments} comments</span>
          )}
        </div>
        {candidate.redditPostedAt && (
          <p className="text-[11px] text-slate-600">
            {relativeAge(candidate.redditPostedAt)} · {candidate.redditPostedAt}
          </p>
        )}
      </div>
    );
  }

  if (sourceType === 'wayback' || candidate.isArchived) {
    return (
      <div className="mb-3 rounded-xl border border-violet-500/12 bg-violet-500/[0.03] px-3 py-2.5">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70">Archived Snapshot</span>
          {candidate.archivedAt && (
            <span className="text-[12px] text-violet-300/55">{candidate.archivedAt.slice(0, 10)}</span>
          )}
        </div>
        {candidate.originalDomain && (
          <p className="text-[12px] text-slate-400">
            Original: <span className="text-slate-300">{candidate.originalDomain}</span>
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-slate-600">Snapshot via Wayback Machine</p>
      </div>
    );
  }

  if (sourceType === 'mediawiki') {
    let domain = '';
    try { domain = new URL(candidate.sourceUrl).hostname; } catch { /* ignore */ }
    return (
      <div className="mb-3 rounded-xl border border-sky-500/12 bg-sky-500/[0.03] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400/70">Wiki Article</span>
          {domain && <span className="text-[12px] text-slate-500">{domain}</span>}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-600">MediaWiki · plain-text extract</p>
      </div>
    );
  }

  if (candidate.attributionText) {
    return <p className="mb-3 text-[12px] text-slate-600">{candidate.attributionText}</p>;
  }

  return null;
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
  // Preset state
  const [activePreset,      setActivePreset]      = useState<string>(PRESET_ALL);
  const [lowQualityOpen,    setLowQualityOpen]    = useState<boolean>(false);

  // Review state
  const [reviewSignals,  setReviewSignals]  = useState<DbRecoveredSignal[]>(initialReviewSignals);
  const [statusChanging, setStatusChanging] = useState<string | null>(null);

  // Publish state
  const [readySignals,  setReadySignals]  = useState<DbRecoveredSignal[]>(initialReadySignals);
  const [prepareOpenId, setPrepareOpenId] = useState<string | null>(null);
  const [publishing,    setPublishing]    = useState<string | null>(null);
  const [lastPublished, setLastPublished] = useState<PublishedResult | null>(null);
  const [copied,        setCopied]        = useState<'tg' | 'x' | null>(null);

  // ── Preset helpers ───────────────────────────────────────────────────────

  function sourcesForPreset(presetId: string) {
    if (presetId === PRESET_ALL) return enabledSources;
    const preset = SCAN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return enabledSources;
    return enabledSources.filter((s) => {
      if (preset.sourceTypes.includes(s.source_type)) return true;
      const lc = s.name.toLowerCase();
      return preset.nameKeywords.some((kw) => lc.includes(kw));
    });
  }

  const activeScanSources = sourcesForPreset(activePreset);

  // ── Scan handlers ────────────────────────────────────────────────────────

  async function handleRunScan() {
    if (!activeScanSources.length) return;
    setScanPhase('scanning');
    setScanError(null);
    setScanResults([]);
    setCandStates(new Map());
    setLowQualityOpen(false);
    const res = await runFetchSessionAction(activeScanSources.map((s) => s.id));
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
            <p className="text-[14px] text-slate-500">
              Presets choose sources. They do not auto-publish.
            </p>
          </div>

          {/* Column body */}
          <div className="flex flex-1 flex-col gap-3 p-5">

            {/* ── Preset picker ── */}
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-600">Choose a preset</p>

              {SCAN_PRESETS.map((preset) => {
                const matchCount = sourcesForPreset(preset.id).length;
                const isActive   = activePreset === preset.id;
                const colorMap: Record<string, string> = {
                  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                  sky:     'border-sky-500/40     bg-sky-500/10     text-sky-300',
                  amber:   'border-amber-500/40   bg-amber-500/10   text-amber-300',
                  violet:  'border-violet-500/40  bg-violet-500/10  text-violet-300',
                };
                const colorDim: Record<string, string> = {
                  emerald: 'text-emerald-400/60',
                  sky:     'text-sky-400/60',
                  amber:   'text-amber-400/60',
                  violet:  'text-violet-400/60',
                };
                const activeCls  = isActive ? colorMap[preset.color]  : 'border-white/8 bg-white/[0.02] text-slate-300';
                const taglineCls = isActive ? colorDim[preset.color]   : 'text-slate-600';
                return (
                  <button
                    key={preset.id}
                    onClick={() => setActivePreset(isActive ? PRESET_ALL : preset.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-all hover:border-white/15 hover:bg-white/[0.04] ${activeCls}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-bold">{preset.name}</span>
                      <span className={`shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[12px] font-semibold ${matchCount > 0 ? 'text-slate-400' : 'text-slate-600'}`}>
                        {matchCount} source{matchCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className={`mt-0.5 text-[12px] leading-snug ${taglineCls}`}>{preset.tagline}</p>
                    {isActive && (
                      <p className={`mt-2 text-[11px] leading-relaxed ${colorDim[preset.color]}`}>
                        {preset.riskNote}
                      </p>
                    )}
                  </button>
                );
              })}

              {/* All sources option */}
              <button
                onClick={() => setActivePreset(PRESET_ALL)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-all hover:border-white/15 hover:bg-white/[0.04] ${activePreset === PRESET_ALL ? 'border-white/20 bg-white/[0.05] text-white' : 'border-white/8 bg-white/[0.02] text-slate-400'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold">All Sources</span>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[12px] font-semibold text-slate-500">
                    {enabledSources.length} enabled
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-slate-600">Scan every enabled source — use if you manage sources manually.</p>
              </button>
            </div>

            {/* ── Active sources for selected preset ── */}
            {activePreset !== PRESET_ALL && (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-widest text-slate-600">
                  Sources in this preset
                </p>
                {activeScanSources.length === 0 ? (
                  <div>
                    <p className="text-[13px] text-slate-500">No enabled sources match this preset.</p>
                    <a href="/scanner/sources" className="mt-1.5 inline-block text-[12px] text-emerald-400/70 underline-offset-2 hover:text-emerald-400 hover:underline">
                      Add sources →
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {activeScanSources.map((s) => {
                      const rec = getSourceRecommendation(s);
                      return (
                        <div key={s.id}>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {s.source_type}
                            </span>
                            <span className="text-[13px] text-slate-300">{s.name}</span>
                          </div>
                          {rec && (
                            <p className="mt-1 text-[11px] leading-relaxed text-amber-400/55">{rec}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* All sources list (when All Sources selected) */}
            {activePreset === PRESET_ALL && enabledSources.length > 0 && (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-widest text-slate-600">
                  All enabled sources
                </p>
                <div className="flex flex-col gap-1.5">
                  {enabledSources.slice(0, 6).map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {s.source_type}
                      </span>
                      <span className="text-[13px] text-slate-400">{s.name}</span>
                    </div>
                  ))}
                  {enabledSources.length > 6 && (
                    <span className="text-[12px] text-slate-600">+{enabledSources.length - 6} more</span>
                  )}
                </div>
              </div>
            )}

            {/* No sources at all */}
            {enabledSources.length === 0 && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 text-center">
                <p className="mb-4 text-[16px] text-slate-400">No sources are enabled yet.</p>
                <a href="/scanner/sources" className={BTN_GHOST}>
                  Manage Sources →
                </a>
              </div>
            )}

            {/* Run scan button */}
            {(enabledSources.length > 0 || activeScanSources.length > 0) && (
              <button
                onClick={handleRunScan}
                disabled={scanPhase === 'scanning' || activeScanSources.length === 0}
                className={BTN_PRIMARY}
              >
                {scanPhase === 'scanning'
                  ? <><Spinner /> Scanning…</>
                  : activeScanSources.length === 0
                    ? 'No sources for this preset'
                    : `Run Scan${activePreset !== PRESET_ALL ? ` · ${activeScanSources.length} source${activeScanSources.length !== 1 ? 's' : ''}` : ''}`
                }
              </button>
            )}

            <a href="/scanner/sources" className={BTN_GHOST}>
              Manage Sources
            </a>

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

            {/* Scan results — grouped by quality */}
            {scanPhase === 'done' && scanResults.length > 0 && (() => {
              const goodResults   = scanResults.filter((r) =>
                r.status !== 'error' && !r.candidate.badCandidateReason && !r.candidate.isIndexPage,
              );
              const lowQualResults = scanResults.filter((r) => {
                if (r.status === 'error') return true;
                return !!(r.candidate.badCandidateReason || r.candidate.isIndexPage);
              });
              const queuedCnt  = [...candStates.values()].filter((s) => s.action === 'queued').length;
              const skippedCnt = [...candStates.values()].filter((s) => s.action === 'skipped').length;
              const blockedCnt = scanResults.filter((r) => r.status === 'error' && r.error.includes('blocked')).length;
              const dupCnt     = scanResults.filter((r) => r.status === 'duplicate').length;

              return (
                <div className="flex flex-col gap-4">

                  {/* ── Summary counts ── */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Stories Found', value: goodResults.length,   color: goodResults.length  > 0 ? 'text-emerald-400' : 'text-slate-600' },
                      { label: 'Queued',         value: queuedCnt,            color: queuedCnt           > 0 ? 'text-emerald-400' : 'text-slate-600' },
                      { label: 'Duplicates',     value: dupCnt,               color: dupCnt              > 0 ? 'text-amber-400'   : 'text-slate-600' },
                      { label: 'Weak / Blocked', value: lowQualResults.length + skippedCnt,
                                                                               color: lowQualResults.length + skippedCnt > 0 ? 'text-slate-500' : 'text-slate-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-center">
                        <div className={`font-mono text-[22px] font-bold tabular-nums ${color}`}>{value}</div>
                        <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── Good candidates ── */}
                  {goodResults.length === 0 ? (
                    <div className="rounded-xl border border-white/8 bg-white/[0.015] px-5 py-8 text-center">
                      <p className="text-[16px] font-semibold text-slate-500">No strong candidates this scan</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                        {blockedCnt > 0
                          ? `${blockedCnt} source${blockedCnt !== 1 ? 's' : ''} blocked. Fix source types or use Discover Links.`
                          : 'All results were weak, index pages, or blocked. Try a different preset or add more sources.'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">
                        Stories Found · {goodResults.length}
                      </p>

                      {goodResults.map((result) => {
                        if (result.status === 'error') return null;
                        const st = candStates.get(result.sourceId) ?? { action: 'idle' as CandidateAction };

                        return (
                          <div key={result.sourceId} className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04]">

                            {/* Evidence image — dominant visual, full bleed */}
                            {result.candidate.sourceImageUrl && (
                              <div className="relative h-44 w-full overflow-hidden bg-slate-900/60">
                                <img
                                  src={result.candidate.sourceImageUrl}
                                  alt=""
                                  className="h-full w-full object-cover opacity-70"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                {result.candidate.sourceType && (
                                  <div className="absolute bottom-2.5 left-3">
                                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-sm ${sourceTypeBadgeCls(result.candidate.sourceType)}`}>
                                      {result.candidate.sourceType}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="p-5">

                              {/* Source header */}
                              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">
                                  {result.sourceName}
                                </span>
                                {!result.candidate.sourceImageUrl && result.candidate.sourceType && (
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sourceTypeBadgeCls(result.candidate.sourceType)}`}>
                                    {result.candidate.sourceType}
                                  </span>
                                )}
                                {result.candidate.passReason && (
                                  <span className="rounded-full border border-emerald-500/18 bg-emerald-500/8 px-2 py-0.5 text-[11px] text-emerald-400/70">
                                    ✓ {result.candidate.passReason}
                                  </span>
                                )}
                                {result.status === 'duplicate' && (
                                  <span className="rounded-full border border-amber-500/25 bg-amber-500/12 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                                    ⚠ duplicate
                                  </span>
                                )}
                              </div>

                              {/* Title */}
                              <p className="mb-2 text-[18px] font-bold leading-snug text-white">
                                {result.candidate.title}
                              </p>

                              {/* Excerpt — concise */}
                              <p className="mb-3 text-[14px] leading-relaxed text-slate-400 line-clamp-3">
                                {result.candidate.summary}
                              </p>

                              {/* Evidence block — source-type-specific metadata */}
                              <EvidenceBlock candidate={result.candidate} />

                              {/* Source URL */}
                              <a
                                href={result.candidate.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mb-3 block truncate text-[11px] text-slate-700 transition-colors hover:text-slate-500"
                              >
                                {result.candidate.sourceUrl}
                              </a>

                              {/* Low/medium confidence notice */}
                              {result.candidate.extractionConfidence !== 'high' && st.action === 'idle' && (
                                <div className={`mb-3 rounded-lg px-2.5 py-1.5 text-[12px] ${
                                  result.candidate.extractionConfidence === 'low'
                                    ? 'bg-red-500/8 text-red-400/65'
                                    : 'bg-amber-500/8 text-amber-400/65'
                                }`}>
                                  {result.candidate.extractionConfidence} confidence
                                  {result.candidate.extractionConfidence === 'low' && ' — edit before queueing'}
                                </div>
                              )}

                              {/* Actions */}
                              {st.action === 'idle' && (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => handleQueueCandidate(result)}
                                    className="flex flex-1 min-h-[52px] items-center justify-center rounded-xl bg-emerald-500 text-[16px] font-bold text-black transition-colors hover:bg-emerald-400"
                                  >
                                    Queue This Story
                                  </button>
                                  <button
                                    onClick={() => handleSkip(result.sourceId)}
                                    className="flex min-h-[52px] items-center justify-center rounded-xl border border-white/12 bg-white/5 px-4 text-[15px] font-semibold text-slate-400 transition-colors hover:bg-white/10"
                                  >
                                    Skip
                                  </button>
                                  <a
                                    href={result.candidate.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex min-h-[52px] w-[52px] items-center justify-center rounded-xl border border-white/8 bg-white/[0.02] text-[18px] text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
                                    title="Open source"
                                  >
                                    ↗
                                  </a>
                                </div>
                              )}
                              {st.action === 'queueing' && (
                                <p className="flex items-center gap-2 text-[15px] text-slate-400">
                                  <Spinner /> Queueing…
                                </p>
                              )}
                              {st.action === 'queued' && (
                                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4">
                                  <p className="mb-2.5 text-[16px] font-bold text-emerald-400">✓ Candidate queued for review</p>
                                  <p className="mb-3 text-[13px] text-emerald-400/60">Waiting in the Review column — approve to move to Publish.</p>
                                  <div className="flex flex-wrap gap-2">
                                    <a
                                      href="/scanner/queue"
                                      className="flex min-h-[42px] items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/12 px-4 text-[13px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/22"
                                    >
                                      Open Signal Queue →
                                    </a>
                                    <button
                                      onClick={() => setCandStates((prev) => { const next = new Map(prev); next.delete(result.sourceId); return next; })}
                                      className="flex min-h-[42px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[13px] text-slate-400 transition-colors hover:bg-white/[0.07]"
                                    >
                                      Continue Scanning
                                    </button>
                                  </div>
                                </div>
                              )}
                              {st.action === 'skipped' && (
                                <p className="text-[13px] text-slate-700">Skipped</p>
                              )}
                              {st.action === 'error' && (
                                <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-3">
                                  <p className="text-[14px] text-red-300">{st.error}</p>
                                  {st.error?.includes('Missing Supabase column') && (
                                    <p className="mt-1 text-[12px] text-red-400/55">Run the recovered_signals migration to add the missing column.</p>
                                  )}
                                  {st.error?.includes('index or navigation page') && (
                                    <p className="mt-1 text-[12px] text-red-400/55">Use Discover Links to find specific story URLs.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Skipped / Low Quality section ── */}
                  {lowQualResults.length > 0 && (
                    <div>
                      <button
                        onClick={() => setLowQualityOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.015] px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                      >
                        <span className="text-[13px] font-semibold text-slate-600">
                          Skipped / Low Quality · {lowQualResults.length}
                        </span>
                        <span className="text-[11px] text-slate-700">{lowQualityOpen ? '▲' : '▼'}</span>
                      </button>

                      {lowQualityOpen && (
                        <div className="mt-2 flex flex-col gap-2">
                          {lowQualResults.map((result) => {
                            if (result.status === 'error') {
                              const isBlocked = result.error.includes('blocked direct fetch');
                              return (
                                <div key={result.sourceId} className="rounded-xl border border-white/8 bg-white/[0.015] px-4 py-3">
                                  <p className="mb-0.5 text-[13px] font-semibold text-slate-500">{result.sourceName}</p>
                                  {isBlocked ? (
                                    <>
                                      <p className="mb-2 text-[12px] text-amber-400/60">Blocked — use Discover Links or fix source type</p>
                                      <div className="flex gap-3">
                                        <a href="/scanner/sources" className="text-[12px] text-amber-400/60 underline-offset-2 hover:underline">Try Discovery</a>
                                        <a href="/scanner/sources" className="text-[12px] text-slate-600 underline-offset-2 hover:underline">Edit Source</a>
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-[12px] text-red-400/55">{result.error}</p>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div key={result.sourceId} className="rounded-xl border border-white/8 bg-white/[0.015] px-4 py-3">
                                <div className="mb-1 flex items-start justify-between gap-2">
                                  <p className="text-[13px] font-semibold leading-snug text-slate-500">
                                    {result.candidate.title.slice(0, 70)}{result.candidate.title.length > 70 ? '…' : ''}
                                  </p>
                                  {result.candidate.isIndexPage && (
                                    <span className="shrink-0 rounded-full border border-amber-500/18 bg-amber-500/7 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400/60">
                                      index
                                    </span>
                                  )}
                                </div>
                                <p className="text-[12px] text-slate-700">
                                  {result.candidate.badCandidateReason ?? 'Index/homepage — not a story'}
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-700">{result.sourceName}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })()}
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
            <p className="text-[15px] font-semibold text-amber-300/80">
              Queued Stories Waiting For Review
            </p>
            <p className="mt-0.5 text-[14px] text-slate-500">Approve a story to move it to Publish</p>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">

            {reviewSignals.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-white/[0.02] py-12 text-center">
                <p className="text-[17px] font-semibold text-slate-500">No queued stories yet</p>
                <p className="mt-2 text-[14px] text-slate-600">Run a scan and queue a candidate to see it here.</p>
                <a
                  href="/scanner/queue"
                  className="mt-5 flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-[14px] font-semibold text-slate-400 transition-colors hover:bg-white/10"
                >
                  Open Full Queue →
                </a>
              </div>
            ) : (
              reviewSignals.map((sig) => {
                const isChanging = statusChanging === sig.id;
                return (
                  <div key={sig.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">

                    {/* Evidence image — top of card, dominant */}
                    {sig.source_image_url && (
                      <div className="relative h-36 w-full overflow-hidden">
                        <img
                          src={sig.source_image_url}
                          alt=""
                          className="h-full w-full object-cover opacity-70"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      </div>
                    )}

                    <div className="p-5">

                      {/* "Recovered Story" label + category */}
                      <div className="mb-2.5 flex items-start justify-between gap-3">
                        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-emerald-400">
                          Recovered Story
                        </span>
                        <span className="shrink-0 rounded-full bg-white/6 px-3 py-1 text-[12px] text-slate-500">
                          {sig.category}
                        </span>
                      </div>

                      {/* Title */}
                      <p className="mb-1 text-[17px] font-bold leading-snug text-white">{sig.title}</p>

                      {/* Attribution line */}
                      <p className="mb-3 text-[12px] text-emerald-400/55">
                        {sig.attribution_text ?? sig.source_name}
                      </p>

                      {/* Summary — concise */}
                      <p className="mb-3 text-[14px] leading-relaxed text-slate-300 line-clamp-3">
                        {sig.summary}
                      </p>

                      {/* Capture notes — evidence provenance */}
                      {sig.source_capture_notes && (
                        <div className="mb-3 rounded-xl border border-white/6 bg-white/[0.015] px-3 py-2">
                          <p className="text-[11px] leading-relaxed text-slate-600">{sig.source_capture_notes}</p>
                        </div>
                      )}

                      {/* Source type + reliability */}
                      <div className="mb-3 flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sourceTypeBadgeCls(sig.source_type)}`}>
                          {sig.source_type}
                        </span>
                        <span className="text-[11px] text-slate-600">{sourceReliabilityLabel(sig.source_type)}</span>
                      </div>

                      {/* Source URL */}
                      {sig.source_url && (
                        <a
                          href={sig.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-4 block truncate text-[11px] text-slate-700 transition-colors hover:text-slate-500"
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

            {/* Publish preview — live preview of how thread appears publicly */}
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-widest text-slate-600">
                How it will appear on SWIM
              </p>
              <div className="rounded-xl border border-white/8 bg-black/25 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-sm bg-emerald-500/18 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                    RECOVERED
                  </span>
                  <span className="rounded-sm bg-white/6 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {category}
                  </span>
                </div>
                <p className="mb-1.5 text-[15px] font-bold leading-snug text-white">
                  {title || 'Untitled Thread'}
                </p>
                <p className="mb-2.5 text-[13px] leading-relaxed text-slate-400 line-clamp-3">
                  {body || 'No body text yet.'}
                </p>
                {tags.trim() && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-500">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                {signal.attribution_text && (
                  <p className="mt-1 text-[11px] italic text-slate-700">{signal.attribution_text}</p>
                )}
              </div>
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
