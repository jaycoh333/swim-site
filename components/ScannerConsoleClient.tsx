'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  runFetchSessionAction,
  queueFetchedCandidateAction,
  updateSignalStatusAction,
  rebirthSignalAsThreadAction,
} from '@/app/actions';
import { getSourceRecommendation } from '@/lib/source-utils';
import { SCAN_PRESETS, PRESET_ALL, PRESET_DEBUG, MAX_PRESET_SOURCES, type ScanPreset } from '@/lib/scan-presets';
import { formatTelegramPost, formatXPost } from '@/lib/social-formatters';
import { CATEGORY_ORDER } from '@/lib/forum-types';
import { computeSourceHealthMap, healthBadgeCls, HEALTH_LABELS, type SourceHealth } from '@/lib/discovery-engine';
import { detectClusters, type ClusterResult } from '@/lib/cluster-detection';
import type { DbScannerSource, DbRecoveredSignal } from '@/lib/supabase/types';
import type { SessionSourceResult, FetchedCandidate, SourceDiagnostic } from '@/lib/scanner-fetch-types';
import { generateSignalAnalysis, type SignalAnalysis } from '@/lib/story-intelligence';

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
  category:     string;
  sourceName:   string;
  publishedAt:  string;  // ISO
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

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
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

// ---------------------------------------------------------------------------
// StoryTimeline — compact 4-step progress strip
// ---------------------------------------------------------------------------

const TIMELINE_STEPS = ['RECOVERED', 'REVIEWED', 'READY', 'REBORN'] as const;
type TimelinePhase = 'recovered' | 'reviewed' | 'ready' | 'reborn';

function StoryTimeline({ phase }: { phase: TimelinePhase }) {
  const phaseIdx = { recovered: 0, reviewed: 1, ready: 2, reborn: 3 }[phase];
  return (
    <div className="mb-3 flex items-center gap-0.5">
      {TIMELINE_STEPS.map((step, i) => {
        const isActive = i === phaseIdx;
        const isPast   = i < phaseIdx;
        return (
          <div key={step} className="flex items-center gap-0.5">
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-widest ${
              isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
              : isPast ? 'text-slate-500'
              : 'text-slate-700'
            }`}>
              {step}
            </span>
            {i < TIMELINE_STEPS.length - 1 && (
              <span className={`text-[9px] ${isPast || isActive ? 'text-slate-600' : 'text-slate-800'}`}>›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalAnalysisBlock — template-based analysis, no AI
// ---------------------------------------------------------------------------

const CORROBORATION_COLORS: Record<string, string> = {
  none:     'text-slate-600',
  weak:     'text-amber-400/60',
  moderate: 'text-amber-400',
  strong:   'text-emerald-400',
};
const RARITY_COLORS: Record<string, string> = {
  common:      'text-slate-500',
  notable:     'text-sky-400/70',
  rare:        'text-violet-400',
  exceptional: 'text-emerald-400',
};

function SignalAnalysisBlock({ analysis }: { analysis: SignalAnalysis }) {
  return (
    <div className="mb-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">Signal Analysis</p>
      <p className="mb-2 text-[12px] leading-snug text-slate-500">{analysis.surfacedBecause}</p>
      {analysis.anomalyMarkers.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {analysis.anomalyMarkers.slice(0, 4).map((m) => (
            <span key={m} className="rounded-full border border-emerald-500/12 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400/50">
              {m}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
        <span className={CORROBORATION_COLORS[analysis.corroborationLevel]}>
          corroboration: <strong>{analysis.corroborationLevel}</strong>
        </span>
        <span className={RARITY_COLORS[analysis.rarityLevel]}>
          rarity: <strong>{analysis.rarityLevel}</strong>
        </span>
        <span className="text-slate-600">
          source: {analysis.sourceReliability}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EvidenceBlock — source-type-specific metadata
// ---------------------------------------------------------------------------

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
  const [scanStatus,     setScanStatus]     = useState('');
  const scanStatusIdx = useRef(0);
  // Key = candidate.sourceUrl (supports multiple candidates from same source)
  const [candStates,     setCandStates]     = useState<Map<string, CandidateState>>(new Map());
  const [queueToast,     setQueueToast]     = useState<string | null>(null);
  // Source health + cluster analysis (computed after each scan)
  const [healthMap,      setHealthMap]      = useState<Map<string, SourceHealth>>(new Map());
  const [clusterList,    setClusterList]    = useState<ClusterResult[]>([]);
  const [diagnostics,      setDiagnostics]      = useState<SourceDiagnostic[]>([]);
  const [showDiagnostics,  setShowDiagnostics]  = useState(false);
  const [showRejected,     setShowRejected]     = useState(false);
  // Preset state
  const [activePreset,      setActivePreset]      = useState<string>(PRESET_ALL);
  const [lowQualityOpen,    setLowQualityOpen]    = useState<boolean>(false);
  const [showPresetTest,    setShowPresetTest]    = useState<boolean>(false);
  const [activeTab,         setActiveTab]         = useState<'strong' | 'needs-review' | 'low-signal' | 'blocked'>('strong');
  const [selectedUrls,      setSelectedUrls]      = useState<Set<string>>(new Set());
  const [showSeen,          setShowSeen]          = useState<boolean>(false);

  // Review state
  const [reviewSignals,  setReviewSignals]  = useState<DbRecoveredSignal[]>(initialReviewSignals);
  const [statusChanging, setStatusChanging] = useState<string | null>(null);
  const [reviewError,    setReviewError]    = useState<string | null>(null);

  // Review → Publish toast
  const [approveToast, setApproveToast] = useState<string | null>(null);

  // Publish state
  const [readySignals,  setReadySignals]  = useState<DbRecoveredSignal[]>(initialReadySignals);
  const [prepareOpenId, setPrepareOpenId] = useState<string | null>(null);
  const [publishing,    setPublishing]    = useState<string | null>(null);
  const [publishError,  setPublishError]  = useState<string | null>(null);
  const [lastPublished, setLastPublished] = useState<PublishedResult | null>(null);
  const [copied,        setCopied]        = useState<'tg' | 'x' | null>(null);

  // ── Scan status message cycling ──────────────────────────────────────────

  const SCAN_STATUS_MESSAGES = [
    'querying endpoints...',
    'discovering archive links...',
    'scoring candidate signals...',
    'checking corroboration...',
    'building clusters...',
    'applying story heuristics...',
    'filtering low-signal noise...',
  ];

  useEffect(() => {
    if (scanPhase !== 'scanning') { setScanStatus(''); return; }
    scanStatusIdx.current = 0;
    setScanStatus(SCAN_STATUS_MESSAGES[0]);
    const id = window.setInterval(() => {
      scanStatusIdx.current = (scanStatusIdx.current + 1) % SCAN_STATUS_MESSAGES.length;
      setScanStatus(SCAN_STATUS_MESSAGES[scanStatusIdx.current]);
    }, 1800);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanPhase]);

  useEffect(() => {
    if (scanPhase === 'done') {
      setActiveTab('strong');
      setSelectedUrls(new Set());
    }
  }, [scanPhase]);

  // ── Preset helpers ───────────────────────────────────────────────────────

  // Sources whose base_url is a root/homepage are excluded from Run Scan —
  // they produce index pages, not stories. Use Discover Links on these instead.
  function isHomepageSource(s: DbScannerSource): boolean {
    if (!s.base_url) return false;
    try { const { pathname } = new URL(s.base_url); return pathname === '/' || pathname === ''; }
    catch { return false; }
  }

  function sourcesForPreset(presetId: string) {
    const pool = (() => {
      if (presetId === PRESET_ALL) return enabledSources;
      const preset = SCAN_PRESETS.find((p) => p.id === presetId);
      if (!preset) return enabledSources;
      return enabledSources.filter((s) => {
        if (preset.nameKeywords.length > 0) {
          const lc = s.name.toLowerCase();
          if (preset.nameKeywords.some((kw) => lc.includes(kw))) return true;
        }
        return preset.sourceTypes.includes(s.source_type);
      });
    })();
    const nonHomepage = pool.filter((s) => !isHomepageSource(s));

    // For preset runs (not All Sources), cap at MAX_PRESET_SOURCES.
    // Prefer sources with recent successful health records over blocked/unknown ones.
    if (presetId === PRESET_ALL) return nonHomepage;

    const sorted = [...nonHomepage].sort((a, b) => {
      const ha = healthMap.get(a.id);
      const hb = healthMap.get(b.id);
      const rank = (h: typeof ha) => {
        if (!h || h.status === 'unknown') return 1;
        if (h.status === 'high-yield')   return 4;
        if (h.status === 'healthy')      return 3;
        if (h.status === 'weak')         return 0;
        if (h.status === 'blocked')      return -1;
        return 1;
      };
      return rank(hb) - rank(ha);
    });

    return sorted.slice(0, MAX_PRESET_SOURCES);
  }

  const activeScanSources = sourcesForPreset(activePreset);

  // Coverage: total sources in DB matching this preset (enabled + disabled), uncapped
  function allSourcesMatchingPreset(presetId: string): typeof sources {
    if (presetId === PRESET_ALL || presetId === PRESET_DEBUG) return [];
    const preset = SCAN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return [];
    return sources.filter((s) => {
      if (preset.nameKeywords.length > 0) {
        const lc = s.name.toLowerCase();
        if (preset.nameKeywords.some((kw) => lc.includes(kw))) return true;
      }
      return preset.sourceTypes.includes(s.source_type);
    });
  }

  const presetAllMatched     = allSourcesMatchingPreset(activePreset);
  const presetEnabledMatched = presetAllMatched.filter((s) => s.enabled);

  // ── Scan handlers ────────────────────────────────────────────────────────

  async function handleRunScan() {
    const isDebugRun = activePreset === PRESET_DEBUG;
    if (!isDebugRun && !activeScanSources.length) return;
    setScanPhase('scanning');
    setScanError(null);
    setScanResults([]);
    setCandStates(new Map());
    setLowQualityOpen(false);
    setShowDiagnostics(false);
    const sourceIdsToRun = isDebugRun
      ? ['__debug_test__']
      : activeScanSources.map((s) => s.id);
    const res = await runFetchSessionAction(sourceIdsToRun, { includeRejected: showRejected });
    if ('error' in res) {
      setScanError(res.error);
      setScanPhase('idle');
      return;
    }
    setScanResults(res.results);
    const diags = res.diagnostics ?? [];
    setDiagnostics(diags);
    setScanPhase('done');
    const totalFetched = diags.reduce((sum, d) => sum + d.pagesFetched, 0);
    if (totalFetched === 0) setShowDiagnostics(true);
    setHealthMap(computeSourceHealthMap(res.results));
    const allCandidates = res.results
      .filter((r) => r.status !== 'error')
      .map((r) => r.candidate);
    setClusterList(detectClusters(allCandidates));
  }

  async function handleQueueCandidate(result: SessionSourceResult) {
    if (result.status === 'error') return;
    const key = result.candidate.sourceUrl;
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
      // Optimistic update — show the story in the Review column immediately
      const now = new Date().toISOString();
      setReviewSignals((prev) => [{
        id:                   ('signalId' in qr ? qr.signalId : `optimistic-${Date.now()}`),
        title:                c.title,
        summary:              c.summary,
        category:             c.category,
        source_name:          result.sourceName,
        source_url:           c.sourceUrl,
        source_type:          (c.sourceType ?? 'other') as DbRecoveredSignal['source_type'],
        status:               'pending',
        anomaly_score:        c.anomalyScore,
        tags:                 c.tags,
        attribution_text:     c.attributionText ?? null,
        source_capture_notes: c.captureNotes ?? null,
        source_image_url:     c.sourceImageUrl ?? null,
        media_url:            c.sourceImageUrl ?? null,
        media_type:           c.mediaType ?? null,
        curator_notes:        null,
        submitted_publicly:   false,
        created_at:           now,
        discovered_at:        now,
        approved_at:          null,
        published_thread_id:  null,
      }, ...prev]);
      setQueueToast(c.title);
      setTimeout(() => setQueueToast(null), 4000);
      router.refresh();
    }
  }

  function handleSkip(sourceUrl: string) {
    setCandStates((prev) => new Map(prev).set(sourceUrl, { action: 'skipped' }));
  }

  // ── Review handlers ──────────────────────────────────────────────────────

  async function handleStatusChange(
    signalId: string,
    newStatus: 'rebirth-ready' | 'rejected' | 'archived',
  ) {
    setStatusChanging(signalId);
    setReviewError(null);
    const result = await updateSignalStatusAction({ id: signalId, status: newStatus });
    setStatusChanging(null);
    if ('error' in result) { setReviewError(result.error); return; }
    if (newStatus === 'rebirth-ready') {
      const sig = reviewSignals.find((s) => s.id === signalId);
      if (sig) {
        setReadySignals((prev) => [{ ...sig, status: 'rebirth-ready' }, ...prev]);
        setApproveToast(sig.title);
        setTimeout(() => setApproveToast(null), 4000);
      }
    }
    setReviewSignals((prev) => prev.filter((s) => s.id !== signalId));
  }

  // ── Publish handlers ─────────────────────────────────────────────────────

  async function handlePublish(
    signalId: string,
    form: { title: string; body: string; category: string; tags: string },
  ) {
    setPublishing(signalId);
    setPublishError(null);
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const result = await rebirthSignalAsThreadAction({
      signalId,
      title:    form.title,
      body:     form.body,
      category: form.category,
      tags,
    });
    setPublishing(null);
    if ('error' in result) { setPublishError(result.error); return; }
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
      category:     form.category,
      sourceName:   sig?.source_name ?? '',
      publishedAt:  new Date().toISOString(),
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

  // ── Derived from cluster list ────────────────────────────────────────────

  const clusterMap = new Map<string, string>();
  for (const cluster of clusterList) {
    for (const url of cluster.candidateUrls) {
      clusterMap.set(url, cluster.label);
    }
  }

  // Quick lookup: sourceUrl → full SessionSourceResult (for related-signals mini-cards)
  const candidatesByUrl = new Map<string, SessionSourceResult>();
  for (const r of scanResults) {
    if (r.status !== 'error') candidatesByUrl.set(r.candidate.sourceUrl, r);
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

      {/* ── Queue toast ── */}
      {queueToast && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
          <span className="text-[22px]">✓</span>
          <div>
            <p className="text-[16px] font-bold text-emerald-300">Story queued for review</p>
            <p className="text-[14px] text-emerald-400/60 line-clamp-1">{queueToast}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <a href="/scanner/queue" className="flex min-h-[40px] items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/12 px-4 text-[13px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/22">
              Open Review Queue →
            </a>
          </div>
        </div>
      )}

      {/* ── Approve toast ── */}
      {approveToast && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-5 py-4">
          <span className="text-[22px]">✓</span>
          <div>
            <p className="text-[16px] font-bold text-purple-300">Approved — ready to publish</p>
            <p className="text-[14px] text-purple-400/60 line-clamp-1">{approveToast}</p>
          </div>
          <p className="ml-auto shrink-0 text-[13px] text-purple-400/50">moved to column 3 →</p>
        </div>
      )}

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
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-600">
                    Sources in this preset
                  </p>
                  {activeScanSources.length > 0 && (
                    <span className="text-[11px] text-slate-700">
                      max {MAX_PRESET_SOURCES} · 5 per source
                    </span>
                  )}
                </div>
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
                      const rec    = getSourceRecommendation(s);
                      const health = healthMap.get(s.id);
                      const isWeak = health?.status === 'weak' || health?.status === 'blocked';
                      return (
                        <div key={s.id}>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {s.source_type}
                            </span>
                            <span className={`text-[13px] ${isWeak ? 'text-slate-500' : 'text-slate-300'}`}>
                              {s.name}
                            </span>
                            {health && health.status !== 'unknown' && (
                              <span className={`ml-auto rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${healthBadgeCls(health.status)}`}>
                                {HEALTH_LABELS[health.status]}
                              </span>
                            )}
                          </div>
                          {isWeak && (
                            <p className="mt-0.5 text-[11px] text-amber-500/45">
                              low yield last session — deprioritised
                            </p>
                          )}
                          {rec && !isWeak && (
                            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-400/55">{rec}</p>
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

            {/* ── Source coverage panel (TASK 3) ── */}
            {activePreset !== PRESET_ALL && activePreset !== PRESET_DEBUG && (
              <div className={`rounded-xl border px-4 py-3 ${
                presetEnabledMatched.length === 0
                  ? 'border-red-500/25 bg-red-500/[0.04]'
                  : 'border-white/8 bg-white/[0.02]'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                    Source coverage
                  </span>
                  <span className="ml-auto flex items-center gap-2 text-[12px]">
                    <span className="text-slate-600">
                      {presetAllMatched.length} matched
                    </span>
                    <span className={`font-bold ${presetEnabledMatched.length > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {presetEnabledMatched.length} enabled
                    </span>
                  </span>
                </div>

                {presetEnabledMatched.length === 0 && (
                  <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                    <p className="text-[12px] font-semibold text-red-400">
                      No enabled sources for this preset
                    </p>
                    <p className="mt-0.5 text-[11px] text-red-400/60">
                      Run <code className="font-mono">seed:scanner-sources:update</code> then enable sources at{' '}
                      <a href="/scanner/sources" className="underline underline-offset-2 hover:text-red-300">
                        /scanner/sources
                      </a>
                    </p>
                  </div>
                )}

                {/* Test Preset Sources button (TASK 4) */}
                {presetEnabledMatched.length > 0 && (
                  <button
                    onClick={() => setShowPresetTest((v) => !v)}
                    className="mt-2 w-full rounded-lg border border-white/8 bg-white/[0.025] px-3 py-1.5 text-left text-[12px] text-slate-500 transition-colors hover:bg-white/[0.045] hover:text-slate-300"
                  >
                    {showPresetTest ? '▲ hide source list' : '▼ test preset sources'}
                  </button>
                )}

                {showPresetTest && presetEnabledMatched.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-emerald-500/12 bg-emerald-500/[0.03] px-3 py-2.5">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400/50">
                      Sources that will run · {Math.min(presetEnabledMatched.length, MAX_PRESET_SOURCES)} of {presetEnabledMatched.length} enabled
                    </p>
                    {presetEnabledMatched.slice(0, MAX_PRESET_SOURCES).map((s) => {
                      const health = healthMap.get(s.id);
                      return (
                        <div key={s.id} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-emerald-500/50" />
                          <span className="text-[12px] text-slate-300">{s.name}</span>
                          <span className="text-[10px] text-slate-600">{s.source_type}</span>
                          {health && health.status !== 'unknown' && (
                            <span className={`ml-auto rounded-full border px-1 py-0.5 text-[9px] font-bold ${healthBadgeCls(health.status)}`}>
                              {HEALTH_LABELS[health.status]}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {presetEnabledMatched.length > MAX_PRESET_SOURCES && (
                      <p className="text-[11px] text-slate-600">
                        +{presetEnabledMatched.length - MAX_PRESET_SOURCES} more enabled but capped — rotate via health score
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-slate-700">
                      No pages fetched — click Run Scan to begin.
                    </p>
                  </div>
                )}
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
            {(enabledSources.length > 0 || activeScanSources.length > 0 || activePreset === PRESET_DEBUG) && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleRunScan}
                  disabled={scanPhase === 'scanning' || (activeScanSources.length === 0 && activePreset !== PRESET_DEBUG)}
                  className={BTN_PRIMARY}
                >
                  {scanPhase === 'scanning'
                    ? <><Spinner /> Scanning…</>
                    : (activeScanSources.length === 0 && activePreset !== PRESET_DEBUG)
                      ? 'No sources for this preset'
                      : `Run Scan${activePreset !== PRESET_ALL && activePreset !== PRESET_DEBUG ? ` · ${activeScanSources.length} source${activeScanSources.length !== 1 ? 's' : ''}` : ''}`
                  }
                </button>
                {scanPhase === 'scanning' && scanStatus && (
                  <p className="text-center text-[14px] tracking-wide text-emerald-400/60 animate-pulse">
                    {scanStatus}
                  </p>
                )}
              </div>
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

            {/* Scan results — tabbed */}
            {scanPhase === 'done' && scanResults.length > 0 && (() => {
              // ── Dedup by URL + normalized title across all results ──────────────────
              const seenUrls   = new Set<string>();
              const seenTitles = new Set<string>();
              const dedupedResults = scanResults.filter((r) => {
                if (r.status === 'error') return true;
                const url = r.candidate.sourceUrl;
                if (seenUrls.has(url)) return false;
                seenUrls.add(url);
                const norm = normalizeTitle(r.candidate.title);
                if (seenTitles.has(norm)) return false;
                seenTitles.add(norm);
                return true;
              });

              // ── Strong candidates: filter + round-robin interleave ─────────────────
              const validResults = [...dedupedResults].filter((r) => {
                if (r.status === 'error') return false;
                if (r.candidate.badCandidateReason || r.candidate.isIndexPage) return false;
                if (r.candidate.storyScore != null && r.candidate.storyScore < 8) return false;
                return true;
              });

              const bySource = new Map<string, typeof validResults>();
              for (const r of validResults) {
                if (!bySource.has(r.sourceId)) bySource.set(r.sourceId, []);
                bySource.get(r.sourceId)!.push(r);
              }
              for (const bucket of bySource.values()) {
                bucket.sort((a, b) => {
                  if (a.status === 'error' || b.status === 'error') return 0;
                  return (b.candidate.finalPriorityScore ?? b.candidate.storyScore ?? 0)
                       - (a.candidate.finalPriorityScore ?? a.candidate.storyScore ?? 0);
                });
              }
              const buckets = [...bySource.values()];
              const goodResults: typeof validResults = [];
              let changed = true;
              while (changed) {
                changed = false;
                buckets.sort((a, b) =>
                  ((b[0]?.status !== 'error' ? (b[0]?.candidate.finalPriorityScore ?? b[0]?.candidate.storyScore ?? 0) : 0))
                  - ((a[0]?.status !== 'error' ? (a[0]?.candidate.finalPriorityScore ?? a[0]?.candidate.storyScore ?? 0) : 0))
                );
                for (const bucket of buckets) {
                  if (bucket.length > 0) { goodResults.push(bucket.shift()!); changed = true; }
                }
              }

              // ── Other categories ──────────────────────────────────────────────────
              const needsReview      = dedupedResults.filter((r) =>
                r.status !== 'error' && !r.candidate.isIndexPage && !r.candidate.badCandidateReason &&
                (r.candidate.storyScore == null || r.candidate.storyScore < 8)
              );
              const lowSignalResults = dedupedResults.filter((r) =>
                r.status !== 'error' && (r.candidate.isIndexPage || !!r.candidate.badCandidateReason)
              );
              const errorResults     = dedupedResults.filter((r) => r.status === 'error');

              // ── "Show seen" filter ────────────────────────────────────────────────
              function filterSeen<T extends SessionSourceResult>(arr: T[]): T[] {
                if (showSeen) return arr;
                return arr.filter((r) => {
                  if (r.status === 'error') return true;
                  const st = candStates.get(r.candidate.sourceUrl);
                  return !st || (st.action !== 'queued' && st.action !== 'skipped');
                });
              }
              const visibleGood   = filterSeen(goodResults);
              const visibleReview = filterSeen(needsReview);
              const visibleLow    = filterSeen(lowSignalResults);
              const visibleErrors = filterSeen(errorResults);

              // ── Derived counts ────────────────────────────────────────────────────
              const queuedCnt       = [...candStates.values()].filter((s) => s.action === 'queued').length;
              const blockedCnt      = errorResults.filter((r) => r.status === 'error' && r.error.includes('blocked')).length;
              const dupCnt          = scanResults.filter((r) => r.status === 'duplicate').length;
              const sourcesScanned  = new Set(scanResults.map((r) => r.sourceId)).size;
              const candidatesFetched = dedupedResults.filter((r) => r.status !== 'error').length;

              // Aliases for backward compat with any remaining legacy references
              const lowQualResults = [...lowSignalResults, ...errorResults, ...needsReview];
              const skippedCnt     = [...candStates.values()].filter((s) => s.action === 'skipped').length;
              void skippedCnt; // suppress unused warning

              // ── Bulk queue (runs sequentially, one at a time) ─────────────────────
              async function bulkQueue() {
                const toQueue = goodResults.filter(
                  (r) => r.status !== 'error' && selectedUrls.has(r.candidate.sourceUrl)
                );
                for (const result of toQueue) await handleQueueCandidate(result);
                setSelectedUrls(new Set());
              }

              // Tab data
              const TABS = [
                { id: 'strong'        as const, label: 'Strong',    count: goodResults.length,      color: 'emerald' },
                { id: 'needs-review'  as const, label: 'Needs Review', count: needsReview.length,   color: 'amber'   },
                { id: 'low-signal'    as const, label: 'Low Signal',count: lowSignalResults.length, color: 'slate'   },
                { id: 'blocked'       as const, label: 'Blocked',   count: errorResults.length,     color: 'red'     },
              ] as const;
              const TAB_COLOR_ACTIVE: Record<string, string> = {
                emerald: 'bg-emerald-500/18 text-emerald-300 border-emerald-500/30',
                amber:   'bg-amber-500/18   text-amber-300   border-amber-500/30',
                slate:   'bg-slate-500/18   text-slate-300   border-slate-500/30',
                red:     'bg-red-500/18     text-red-300     border-red-500/30',
              };
              const TAB_BADGE_ACTIVE: Record<string, string> = {
                emerald: 'bg-emerald-500/25 text-emerald-300',
                amber:   'bg-amber-500/25   text-amber-300',
                slate:   'bg-slate-500/20   text-slate-400',
                red:     'bg-red-500/25     text-red-300',
              };

              return (
                <div className="flex flex-col gap-4">

                  {/* ── Summary counts ── */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Sources',    value: sourcesScanned,    color: 'text-slate-400' },
                      { label: 'Fetched',    value: candidatesFetched, color: candidatesFetched > 0 ? 'text-sky-400' : 'text-slate-600' },
                      { label: 'Strong',     value: goodResults.length, color: goodResults.length > 0 ? 'text-emerald-400' : 'text-slate-600' },
                      { label: 'Queued',     value: queuedCnt,          color: queuedCnt > 0 ? 'text-emerald-400' : 'text-slate-600' },
                      { label: 'Duplicates', value: dupCnt,             color: dupCnt > 0 ? 'text-amber-400' : 'text-slate-600' },
                      { label: 'Low/Err', value: lowSignalResults.length + errorResults.length,
                                                                         color: (lowSignalResults.length + errorResults.length) > 0 ? 'text-slate-500' : 'text-slate-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl border border-white/8 bg-white/[0.02] px-2 py-2.5 text-center">
                        <div className={`font-mono text-[20px] font-bold tabular-nums ${color}`}>{value}</div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── Tab strip ── */}
                  <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-white/[0.02] p-1">
                    {TABS.map(({ id, label, count, color }) => {
                      const isActive = activeTab === id;
                      return (
                        <button
                          key={id}
                          onClick={() => setActiveTab(id)}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-semibold whitespace-nowrap transition-all ${
                            isActive ? TAB_COLOR_ACTIVE[color] : 'border-transparent text-slate-600 hover:text-slate-400'
                          }`}
                        >
                          {label}
                          {count > 0 && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                              isActive ? TAB_BADGE_ACTIVE[color] : 'bg-white/5 text-slate-700'
                            }`}>{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Bulk action bar (strong tab only) ── */}
                  {activeTab === 'strong' && goodResults.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                      <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-slate-500">
                        <input
                          type="checkbox"
                          checked={selectedUrls.size > 0 && goodResults.filter((r) => r.status !== 'error').every((r) => selectedUrls.has(r.candidate.sourceUrl))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUrls(new Set(goodResults.filter((r) => r.status !== 'error').map((r) => r.candidate.sourceUrl)));
                            } else {
                              setSelectedUrls(new Set());
                            }
                          }}
                          className="h-3.5 w-3.5 accent-emerald-400"
                        />
                        Select all
                      </label>
                      {selectedUrls.size > 0 && (
                        <>
                          <span className="text-[12px] text-slate-600">{selectedUrls.size} selected</span>
                          <button
                            onClick={bulkQueue}
                            className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/18"
                          >
                            Queue selected
                          </button>
                          <button
                            onClick={() => { for (const url of selectedUrls) handleSkip(url); setSelectedUrls(new Set()); }}
                            className="rounded-lg border border-slate-500/25 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-white/[0.06]"
                          >
                            Skip selected
                          </button>
                        </>
                      )}
                      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={showSeen}
                          onChange={(e) => setShowSeen(e.target.checked)}
                          className="h-3.5 w-3.5 accent-slate-400"
                        />
                        Show queued/skipped
                      </label>
                    </div>
                  )}

                  {/* ── STRONG TAB ── */}
                  {activeTab === 'strong' && (() => {
                    if (visibleGood.length === 0) {
                      const promoted = visibleReview.slice(0, 5);
                      if (promoted.length > 0) {
                        return (
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-2.5">
                              <span className="text-[13px] font-semibold text-amber-400/80">Human Review Required</span>
                              <span className="ml-auto text-[12px] text-amber-400/50">No strong candidates — promoting {promoted.length} low-signal results</span>
                            </div>
                            {promoted.map((result) => {
                              if (result.status === 'error') return null;
                              const st = candStates.get(result.candidate.sourceUrl) ?? { action: 'idle' as CandidateAction };
                              return (
                                <div key={result.candidate.sourceUrl} className="overflow-hidden rounded-2xl border border-amber-500/15 bg-white/[0.03]">
                                  <div className="p-5">
                                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                      {result.candidate.sourceType && (
                                        <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-bold ${sourceTypeBadgeCls(result.candidate.sourceType)}`}>
                                          {result.candidate.sourceType.toUpperCase()}
                                        </span>
                                      )}
                                      <span className="text-[13px] font-semibold text-slate-400">{result.sourceName}</span>
                                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400">low-signal</span>
                                      {result.candidate.storyScore != null && (
                                        <span className="ml-auto rounded-full bg-white/[0.04] px-2 py-0.5 text-[12px] font-bold tabular-nums text-slate-500">{result.candidate.storyScore}pts</span>
                                      )}
                                    </div>
                                    <p className="mb-2 text-[20px] font-bold leading-snug text-white">{result.candidate.title}</p>
                                    <div className="mb-3 rounded-xl border-l-2 border-amber-500/20 bg-white/[0.025] px-4 py-3">
                                      <p className="text-[17px] leading-relaxed text-slate-300 line-clamp-4">{result.candidate.summary}</p>
                                    </div>
                                    <a href={result.candidate.sourceUrl} target="_blank" rel="noopener noreferrer"
                                      className="mb-3 flex items-center gap-2 truncate rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-[13px] text-slate-500 transition-colors hover:text-slate-300">
                                      <span className="text-[10px] text-slate-600">SOURCE</span>
                                      <span className="truncate">{result.candidate.sourceUrl}</span>
                                      <span className="ml-auto shrink-0">↗</span>
                                    </a>
                                    {st.action === 'idle' && (
                                      <div className="flex gap-2">
                                        <button onClick={() => handleQueueCandidate(result)}
                                          className="flex flex-1 min-h-[52px] items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/12 text-[17px] font-bold text-amber-300 transition-colors hover:bg-amber-500/22">
                                          ⚠ Queue (low confidence)
                                        </button>
                                        <button onClick={() => handleSkip(result.candidate.sourceUrl)}
                                          className="flex min-h-[52px] items-center justify-center rounded-xl border border-white/12 bg-white/5 px-5 text-[16px] text-slate-400 hover:bg-white/10">
                                          Skip
                                        </button>
                                      </div>
                                    )}
                                    {st.action === 'queueing' && <div className="flex min-h-[52px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[16px] text-slate-400"><Spinner /> Queueing…</div>}
                                    {st.action === 'queued'   && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4 text-[17px] font-bold text-emerald-300">✓ Queued for Review</p>}
                                    {st.action === 'skipped'  && <p className="text-[14px] text-slate-700">Skipped</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return (
                        <div className="rounded-xl border border-white/8 bg-white/[0.015] px-5 py-8 text-center">
                          <p className="text-[17px] font-semibold text-slate-500">No strong story candidates found</p>
                          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">
                            {blockedCnt > 0
                              ? `${blockedCnt} source${blockedCnt !== 1 ? 's' : ''} blocked. Fix source types or use Discover Links.`
                              : 'All results were weak or index pages. Try a different preset or add more sources.'}
                          </p>
                          <a href="/scanner/sources"
                            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-4 py-2 text-[13px] font-semibold uppercase tracking-widest text-emerald-400 transition-colors hover:border-emerald-500/45 hover:bg-emerald-500/14">
                            + Add more sources
                          </a>
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-col gap-3">
                        <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">
                          Strong Candidates · {visibleGood.length}{visibleGood.length < goodResults.length ? ` of ${goodResults.length}` : ''}
                        </p>
                        {visibleGood.map((result) => {
                          if (result.status === 'error') return null;
                          const st        = candStates.get(result.candidate.sourceUrl) ?? { action: 'idle' as CandidateAction };
                          const analysis  = generateSignalAnalysis(result.candidate);
                          const isSelected = selectedUrls.has(result.candidate.sourceUrl);
                          const clusterLabel = clusterMap.get(result.candidate.sourceUrl);
                          const relatedUrls  = clusterLabel
                            ? (clusterList.find((c) => c.label === clusterLabel)?.candidateUrls ?? [])
                                .filter((u) => u !== result.candidate.sourceUrl)
                            : [];
                          const relatedResults = relatedUrls
                            .map((u) => candidatesByUrl.get(u))
                            .filter((r): r is SessionSourceResult => !!r && r.status !== 'error')
                            .slice(0, 3);
                          return (
                            <div key={result.candidate.sourceUrl} className={`overflow-hidden rounded-2xl border transition-all hover:border-white/20 hover:bg-white/[0.055] ${
                              isSelected ? 'border-emerald-500/35 bg-emerald-500/[0.04]' : 'border-white/12 bg-white/[0.04]'
                            }`}>
                              {result.candidate.sourceImageUrl && (
                                <div className="relative h-44 w-full overflow-hidden bg-slate-900/60">
                                  <img src={result.candidate.sourceImageUrl} alt="" className="h-full w-full object-cover opacity-70" />
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
                                {/* Source header + checkbox */}
                                <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => setSelectedUrls((prev) => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(result.candidate.sourceUrl);
                                      else next.delete(result.candidate.sourceUrl);
                                      return next;
                                    })}
                                    className="h-3.5 w-3.5 shrink-0 accent-emerald-400"
                                  />
                                  {result.candidate.sourceType && (
                                    <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-bold ${sourceTypeBadgeCls(result.candidate.sourceType)}`}>
                                      {result.candidate.sourceType.toUpperCase()}
                                    </span>
                                  )}
                                  <span className="text-[15px] font-semibold text-slate-400">{result.sourceName}</span>
                                  {(() => {
                                    const h = healthMap.get(result.sourceId);
                                    if (!h || h.status === 'unknown') return null;
                                    return (
                                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${healthBadgeCls(h.status)}`}>
                                        {HEALTH_LABELS[h.status]}
                                      </span>
                                    );
                                  })()}
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
                                  <div className="ml-auto flex items-center gap-1.5">
                                    {result.candidate.finalPriorityScore != null && result.candidate.finalPriorityScore !== result.candidate.storyScore && (
                                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-400/80" title="Priority score">
                                        P{result.candidate.finalPriorityScore}
                                      </span>
                                    )}
                                    {result.candidate.storyScore != null && (
                                      <span className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[12px] font-bold tabular-nums text-slate-500">
                                        {result.candidate.storyScore}pts
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Title */}
                                <p className="mb-1.5 text-[24px] font-bold leading-snug text-white">{result.candidate.title}</p>
                                {/* Why surfaced — prominent */}
                                {analysis.surfacedBecause && (
                                  <p className="mb-2 text-[13px] leading-snug text-emerald-400/65">{analysis.surfacedBecause}</p>
                                )}
                                <StoryTimeline phase="recovered" />
                                {((result.candidate.storySignals && result.candidate.storySignals.length > 0) ||
                                  clusterLabel || (result.candidate.corroborationScore ?? 0) > 0) && (
                                  <div className="mb-3 flex flex-wrap gap-1">
                                    {result.candidate.storySignals?.map((sig) => (
                                      <span key={sig} className="rounded-full border border-emerald-500/20 bg-emerald-500/6 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-400/65">{sig}</span>
                                    ))}
                                    {clusterLabel && (
                                      <span className="rounded-full border border-violet-500/25 bg-violet-500/8 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-400/75">⬡ {clusterLabel}</span>
                                    )}
                                    {result.candidate.corroborationScore != null && result.candidate.corroborationScore > 0 && (
                                      <span className="rounded-full border border-sky-500/25 bg-sky-500/8 px-2 py-0.5 text-[11px] font-bold text-sky-400/80" title={result.candidate.corroborationNotes?.join(', ')}>
                                        ⟳ {result.candidate.corroborationScore} corroboration
                                      </span>
                                    )}
                                  </div>
                                )}
                                <SignalAnalysisBlock analysis={analysis} />
                                <div className="mb-3 rounded-xl border-l-2 border-emerald-500/25 bg-white/[0.025] px-4 py-3">
                                  <p className="text-[18px] leading-relaxed text-slate-300 line-clamp-5">{result.candidate.summary}</p>
                                </div>
                                <EvidenceBlock candidate={result.candidate} />
                                {relatedResults.length > 0 && (
                                  <div className="mb-3">
                                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">Related recovered signals · cluster: {clusterLabel}</p>
                                    <div className="flex flex-col gap-1.5">
                                      {relatedResults.map((rel) => {
                                        if (rel.status === 'error') return null;
                                        return (
                                          <div key={rel.candidate.sourceUrl} className="flex items-start gap-2 rounded-lg border border-violet-500/12 bg-violet-500/[0.03] px-3 py-2">
                                            {rel.candidate.sourceType && (
                                              <span className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${sourceTypeBadgeCls(rel.candidate.sourceType)}`}>
                                                {rel.candidate.sourceType.slice(0, 3).toUpperCase()}
                                              </span>
                                            )}
                                            <div className="min-w-0">
                                              <p className="text-[13px] font-semibold leading-snug text-slate-400 line-clamp-1">{rel.candidate.title}</p>
                                              <p className="text-[11px] text-slate-600">{rel.sourceName}</p>
                                            </div>
                                            {rel.candidate.storyScore != null && (
                                              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-700">{rel.candidate.storyScore}pts</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                <a href={result.candidate.sourceUrl} target="_blank" rel="noopener noreferrer"
                                  className="mb-3 flex items-center gap-2 truncate rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-[13px] text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300">
                                  <span className="text-[10px] text-slate-600">SOURCE</span>
                                  <span className="truncate">{result.candidate.sourceUrl}</span>
                                  <span className="ml-auto shrink-0 text-[14px]">↗</span>
                                </a>
                                {result.candidate.extractionConfidence !== 'high' && st.action === 'idle' && (
                                  <div className={`mb-3 rounded-lg px-3 py-2 text-[13px] ${
                                    result.candidate.extractionConfidence === 'low' ? 'bg-red-500/8 text-red-400/65' : 'bg-amber-500/8 text-amber-400/65'
                                  }`}>
                                    {result.candidate.extractionConfidence} confidence{result.candidate.extractionConfidence === 'low' && ' — edit before queueing'}
                                  </div>
                                )}
                                {st.action === 'idle' && (
                                  <div className="flex flex-wrap gap-2">
                                    <button onClick={() => handleQueueCandidate(result)}
                                      className="flex flex-1 min-h-[56px] items-center justify-center rounded-xl bg-emerald-500 text-[18px] font-bold text-black transition-colors hover:bg-emerald-400">
                                      Queue This Story
                                    </button>
                                    <button onClick={() => handleSkip(result.candidate.sourceUrl)}
                                      className="flex min-h-[56px] items-center justify-center rounded-xl border border-white/12 bg-white/5 px-5 text-[16px] font-semibold text-slate-400 transition-colors hover:bg-white/10">
                                      Skip
                                    </button>
                                  </div>
                                )}
                                {st.action === 'queueing' && (
                                  <div className="flex min-h-[56px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[16px] text-slate-400">
                                    <Spinner /> Queueing…
                                  </div>
                                )}
                                {st.action === 'queued' && (
                                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4">
                                    <p className="mb-1 text-[18px] font-bold text-emerald-300">✓ Queued for Review</p>
                                    <p className="mb-3 text-[14px] text-emerald-400/60">Review it in column 2 → approve to publish.</p>
                                    <div className="flex flex-wrap gap-2">
                                      <a href="/scanner/queue" className="flex min-h-[46px] items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/12 px-4 text-[14px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/22">
                                        Open Review Queue →
                                      </a>
                                      <button onClick={() => setCandStates((prev) => { const next = new Map(prev); next.delete(result.candidate.sourceUrl); return next; })}
                                        className="flex min-h-[46px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[14px] text-slate-400 transition-colors hover:bg-white/[0.07]">
                                        Continue Scanning
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {st.action === 'skipped' && <p className="text-[14px] text-slate-700">Skipped — story hidden</p>}
                                {st.action === 'error' && (
                                  <div className="rounded-xl border border-red-500/35 bg-red-500/10 p-4">
                                    <p className="mb-1 text-[16px] font-bold text-red-300">Queue Failed</p>
                                    <p className="text-[15px] text-red-200">{st.error}</p>
                                    {st.error?.includes('Missing Supabase column') && (
                                      <p className="mt-2 text-[13px] text-red-400/55">Run the recovered_signals migration to add the missing column.</p>
                                    )}
                                    {st.error?.includes('index or navigation page') && (
                                      <p className="mt-2 text-[13px] text-red-400/55">Use Discover Links to find specific story URLs.</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* ── NEEDS REVIEW TAB ── */}
                  {activeTab === 'needs-review' && (
                    visibleReview.length === 0 ? (
                      <div className="rounded-xl border border-white/8 bg-white/[0.015] px-5 py-6 text-center">
                        <p className="text-[15px] text-slate-500">No items needing review.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-600">Low score — valid posts · {visibleReview.length}</p>
                        {visibleReview.map((result) => {
                          if (result.status === 'error') return null;
                          const st = candStates.get(result.candidate.sourceUrl) ?? { action: 'idle' as CandidateAction };
                          return (
                            <div key={result.candidate.sourceUrl} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <p className="text-[15px] font-semibold leading-snug text-slate-300">{result.candidate.title}</p>
                                {result.candidate.storyScore != null && (
                                  <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[12px] font-bold text-amber-400">{result.candidate.storyScore}pts</span>
                                )}
                              </div>
                              <p className="mb-2 text-[13px] text-slate-600">{result.sourceName} · {result.candidate.sourceType}</p>
                              <p className="mb-3 text-[14px] leading-relaxed text-slate-500 line-clamp-2">{result.candidate.summary}</p>
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={st.action === 'queueing' || st.action === 'queued'}
                                  onClick={() => handleQueueCandidate(result)}
                                  className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-400 disabled:opacity-40 hover:border-amber-500/50"
                                >
                                  {st.action === 'queueing' ? 'Queueing…' : st.action === 'queued' ? '✓ Queued' : '⚠ Queue (low confidence)'}
                                </button>
                                <a href={result.candidate.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-600 hover:text-slate-400">
                                  source ↗
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* ── LOW SIGNAL TAB ── */}
                  {activeTab === 'low-signal' && (
                    visibleLow.length === 0 ? (
                      <div className="rounded-xl border border-white/8 bg-white/[0.015] px-5 py-6 text-center">
                        <p className="text-[15px] text-slate-500">No low-signal results.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-600">Low Signal · {visibleLow.length}</p>
                        {visibleLow.map((result) => {
                          if (result.status === 'error') return null;
                          const debugReason = result.candidate.badCandidateReason
                            ?? (result.candidate.isIndexPage ? 'Homepage or index page — no story links found' : 'Did not pass quality filter');
                          return (
                            <div key={result.candidate.sourceUrl} className="rounded-xl border border-white/8 bg-white/[0.015] px-4 py-3">
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <p className="text-[13px] font-semibold leading-snug text-slate-500">
                                  {result.candidate.title.slice(0, 70)}{result.candidate.title.length > 70 ? '…' : ''}
                                </p>
                                {result.candidate.isIndexPage && (
                                  <span className="shrink-0 rounded-full border border-amber-500/18 bg-amber-500/7 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400/60">index</span>
                                )}
                              </div>
                              <p className="text-[12px] text-amber-400/50">{debugReason}</p>
                              <p className="mt-0.5 text-[11px] text-slate-700">
                                {result.candidate.storyScore != null ? `score: ${result.candidate.storyScore}pts · ` : ''}{result.sourceName}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* ── BLOCKED/FAILED TAB ── */}
                  {activeTab === 'blocked' && (
                    visibleErrors.length === 0 ? (
                      <div className="rounded-xl border border-white/8 bg-white/[0.015] px-5 py-6 text-center">
                        <p className="text-[15px] text-slate-500">No blocked or failed sources.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-600">Blocked / Failed · {visibleErrors.length}</p>
                        {visibleErrors.map((result, idx) => {
                          if (result.status !== 'error') return null;
                          const isBlocked = result.error.includes('blocked direct fetch');
                          return (
                            <div key={`${result.sourceId}-err-${idx}`} className="rounded-xl border border-white/8 bg-white/[0.015] px-4 py-3">
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
                        })}
                      </div>
                    )
                  )}



                  {/* ── Scan Diagnostics ── */}
                  {diagnostics.length > 0 && (
                    <div className="rounded-xl border border-white/6 bg-white/[0.018]">
                      <button
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                        onClick={() => setShowDiagnostics((v) => !v)}
                      >
                        <span className="text-[13px] font-semibold uppercase tracking-widest text-slate-600">
                          Scan Diagnostics · {diagnostics.length} sources
                        </span>
                        <span className="text-[12px] text-slate-700">{showDiagnostics ? '▲ hide' : '▼ show'}</span>
                      </button>
                      {showDiagnostics && (
                        <div className="border-t border-white/6 px-4 pb-4 pt-3">
                          <div className="mb-3 flex items-center gap-3">
                            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-500">
                              <input
                                type="checkbox"
                                checked={showRejected}
                                onChange={(e) => setShowRejected(e.target.checked)}
                                className="h-4 w-4 accent-amber-400"
                              />
                              Show rejected posts (re-scan to apply)
                            </label>
                          </div>
                          <div className="flex flex-col gap-3">
                            {diagnostics.map((d) => (
                              <div key={d.sourceId} className="rounded-lg border border-white/6 bg-white/[0.02] p-3">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <span className="text-[14px] font-semibold text-slate-400">{d.sourceName}</span>
                                  <span className="rounded border border-white/8 px-1.5 py-0.5 text-[12px] font-mono text-slate-600">{d.routeUsed}</span>
                                  {d.subreddit && <span className="text-[12px] text-slate-600">r/{d.subreddit}</span>}
                                  {d.searchQuery && <span className="text-[12px] text-slate-600">q: &quot;{d.searchQuery}&quot;</span>}
                                  {d.errorMessage && <span className="rounded border border-red-500/20 bg-red-500/8 px-2 py-0.5 text-[12px] text-red-400">error</span>}
                                </div>
                                <div className="mb-2 grid grid-cols-4 gap-1 text-center">
                                  {[
                                    { label: 'discovered', val: d.linksDiscovered },
                                    { label: 'fetched',    val: d.pagesFetched },
                                    { label: 'passed',     val: d.candidatesPassed,   green: true },
                                    { label: 'rejected',   val: d.candidatesRejected, red: d.candidatesRejected > 0 },
                                  ].map(({ label, val, green, red }) => (
                                    <div key={label} className="rounded border border-white/5 bg-white/[0.015] px-1 py-2">
                                      <div className={`font-mono text-[18px] font-bold ${green ? 'text-emerald-400' : red ? 'text-red-400' : 'text-slate-500'}`}>{val}</div>
                                      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-700">{label}</div>
                                    </div>
                                  ))}
                                </div>
                                {d.errorMessage && (
                                  <p className="mb-1.5 rounded bg-red-500/5 px-2 py-1.5 text-[13px] leading-relaxed text-red-400/80">{d.errorMessage}</p>
                                )}
                                {d.rejectReasons.length > 0 && (
                                  <p className="text-[12px] text-slate-600">
                                    Reject reasons: {d.rejectReasons.slice(0, 4).join(' · ')}
                                  </p>
                                )}
                                {d.endpointResults && d.endpointResults.length > 0 && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-[12px] text-slate-600 hover:text-slate-400">
                                      {d.endpointResults.length} endpoint{d.endpointResults.length !== 1 ? 's' : ''} tried
                                    </summary>
                                    <div className="mt-1.5 flex flex-col gap-1 pl-2">
                                      {d.endpointResults.map((ep, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[12px]">
                                          <span className={ep.ok ? 'text-emerald-400' : 'text-red-400/70'}>{ep.ok ? '✓' : '✗'}</span>
                                          <span className="text-slate-500 font-mono">{ep.endpoint}</span>
                                          <span className="text-slate-600">{ep.status > 0 ? `HTTP ${ep.status}` : ''}</span>
                                          {ep.childCount > 0 && <span className="text-slate-600">{ep.childCount} posts</span>}
                                          {ep.timing && <span className="text-slate-700">{ep.timing}ms</span>}
                                          {ep.error && <span className="text-red-400/60">{ep.error}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                                {d.rejectedCandidates && d.rejectedCandidates.length > 0 && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-[12px] text-slate-600 hover:text-slate-400">
                                      {d.rejectedCandidates.length} rejected posts
                                    </summary>
                                    <div className="mt-1.5 flex flex-col gap-1.5 pl-2">
                                      {d.rejectedCandidates.slice(0, 8).map((rp, i) => (
                                        <div key={i} className="text-[12px]">
                                          <span className="text-slate-500">{rp.title}</span>
                                          <span className="ml-1.5 text-slate-600">— {rp.rejectReason}</span>
                                          {rp.redditScore != null && <span className="ml-1 text-slate-600">{rp.redditScore}↑</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            ))}
                          </div>
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
                  {reviewSignals.length} queued
                </span>
              )}
            </div>
            <p className="text-[16px] font-bold text-amber-300/90">
              Queued Stories
            </p>
            <p className="mt-0.5 text-[14px] text-slate-500">Approve for Publishing moves story to column 3</p>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">

            {/* Review error panel */}
            {reviewError && (
              <div className="rounded-2xl border border-red-500/35 bg-red-500/10 p-5">
                <p className="mb-1 text-[17px] font-bold text-red-300">Action Failed</p>
                <p className="text-[15px] text-red-200">{reviewError}</p>
                <button onClick={() => setReviewError(null)} className="mt-3 text-[13px] text-red-400/60 underline-offset-2 hover:underline">
                  Dismiss
                </button>
              </div>
            )}

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
                      <p className="mb-1 text-[22px] font-bold leading-snug text-white">{sig.title}</p>

                      {/* Attribution line */}
                      <p className="mb-3 text-[14px] text-emerald-400/55">
                        {sig.attribution_text ?? sig.source_name}
                      </p>

                      {/* Summary — quote panel */}
                      <div className="mb-3 rounded-xl border-l-2 border-amber-500/20 bg-white/[0.02] px-4 py-3">
                        <p className="text-[16px] leading-relaxed text-slate-300 line-clamp-4">
                          {sig.summary}
                        </p>
                      </div>

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
                          {isChanging ? <Spinner /> : 'Approve for Publishing'}
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

            {/* ── Publish error panel (TASK 7) ── */}
            {publishError && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/12 p-6">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[20px]">✗</span>
                  <p className="text-[20px] font-bold text-red-300">Publish Failed</p>
                </div>
                <p className="mb-1 text-[15px] leading-relaxed text-red-200">{publishError}</p>
                <p className="mb-4 text-[13px] text-red-400/55">Check the error above, fix and retry — no changes were made to SWIM.</p>
                <button
                  onClick={() => setPublishError(null)}
                  className="flex min-h-[44px] items-center justify-center rounded-xl border border-red-500/30 bg-red-500/8 px-5 text-[14px] font-semibold text-red-300 transition-colors hover:bg-red-500/18"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* ── Publish success panel (TASKS 1–5) ── */}
            {lastPublished && (
              <div className="overflow-hidden rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.07]">

                {/* Header */}
                <div className="border-b border-emerald-500/20 bg-emerald-500/[0.08] px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/25 text-[15px] font-bold text-emerald-400">✓</span>
                    <p className="text-[18px] font-bold uppercase tracking-[0.12em] text-emerald-400">
                      LIVE THREAD CREATED
                    </p>
                  </div>
                </div>

                <div className="p-6">
                  {/* Title */}
                  <p className="mb-3 text-[20px] font-bold leading-snug text-white">
                    {lastPublished.title}
                  </p>

                  {/* Meta — category, source, timestamp */}
                  <div className="mb-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[12px] font-semibold text-emerald-300">
                      {lastPublished.category}
                    </span>
                    {lastPublished.sourceName && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-slate-400">
                        {lastPublished.sourceName}
                      </span>
                    )}
                    <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[12px] tabular-nums text-slate-500" suppressHydrationWarning>
                      {new Date(lastPublished.publishedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Primary action — Open Thread */}
                  {lastPublished.threadSlug ? (
                    <a
                      href={`/threads/${lastPublished.threadSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500/22 border border-emerald-500/45 text-[17px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/35"
                    >
                      Open Thread ↗
                    </a>
                  ) : (
                    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-[14px] text-amber-300">
                      Thread created but slug was not returned — check /threads for the new post.
                    </div>
                  )}

                  {/* X Post preview + copy */}
                  <div className="mb-3">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.20em] text-slate-500">X POST</p>
                    <div className="mb-2 overflow-hidden rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                      <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-300 line-clamp-4">
                        {lastPublished.xText}
                      </pre>
                    </div>
                    <button
                      onClick={() => handleCopy(lastPublished.xText, 'x')}
                      className={`flex min-h-[44px] w-full items-center justify-center rounded-xl border text-[14px] font-semibold transition-all ${
                        copied === 'x'
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : 'border-white/12 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      {copied === 'x' ? '✓ Copied to clipboard' : 'Copy X Post'}
                    </button>
                  </div>

                  {/* Telegram preview + copy */}
                  <div className="mb-5">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.20em] text-slate-500">TELEGRAM POST</p>
                    <div className="mb-2 overflow-hidden rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                      <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-300 line-clamp-5">
                        {lastPublished.telegramText}
                      </pre>
                    </div>
                    <button
                      onClick={() => handleCopy(lastPublished.telegramText, 'tg')}
                      className={`flex min-h-[44px] w-full items-center justify-center rounded-xl border text-[14px] font-semibold transition-all ${
                        copied === 'tg'
                          ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                          : 'border-white/12 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      {copied === 'tg' ? '✓ Copied to clipboard' : 'Copy Telegram Post'}
                    </button>
                  </div>

                  {/* Continue reviewing */}
                  <button
                    onClick={() => { setLastPublished(null); setCopied(null); }}
                    className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[15px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-200"
                  >
                    Continue Reviewing
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
