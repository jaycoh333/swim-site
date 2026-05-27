'use client';

import React, { useState, useEffect, useRef } from 'react';
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

// PostedResult is defined near the PostedCard component above.

export interface ScannerConsoleClientProps {
  sources:              DbScannerSource[];
  enabledSources:       DbScannerSource[];
  initialReviewSignals: DbRecoveredSignal[];
  initialReadySignals:  DbRecoveredSignal[];
  stats:                ConsoleStats;
}

type CandidateAction = 'idle' | 'queueing' | 'queued' | 'skipped' | 'error' | 'posting' | 'posted';
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
  if (!isoDate) return 'date unknown';
  const ts = new Date(isoDate).getTime();
  if (isNaN(ts)) return 'date unknown';
  // Reddit launched 2005; anything earlier is a corrupt/zero timestamp
  const year = new Date(ts).getFullYear();
  if (year < 2004 || year > new Date().getFullYear() + 1) return 'date unknown';
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0)   return 'today';
  if (days === 1)  return '1d ago';
  if (days < 30)   return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
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

// Era badge — Phase O origin scan display
const ERA_BADGE_MAP: Record<string, { label: string; cls: string }> = {
  '1990s web':          { label: '1990s WEB',     cls: 'border-amber-500/45 bg-amber-500/12 text-amber-300' },
  'early 2000s':        { label: 'EARLY 2000s',   cls: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
  'pre-social archive': { label: 'PRE-SOCIAL',    cls: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
  'bbs archive':        { label: 'BBS ARCHIVE',   cls: 'border-violet-500/45 bg-violet-500/12 text-violet-300' },
};
const ERA_GROUP_ORDER = ['1990s web', 'bbs archive', 'early 2000s', 'pre-social archive', 'modern source'];

// Phase W: archive-first source type priority for origin scan results.
// Lower number = surfaces earlier. BBS/Wayback dominate; Reddit appears last.
const ORIGIN_SOURCE_TYPE_RANK: Record<string, number> = {
  'bbs':        0,
  'wayback':    1,
  'archive':    2,
  'mediawiki':  3,
  'forum':      4,
  'imageboard': 5,
  'reddit':     99,
};
const ERA_GROUP_DISPLAY: Record<string, { label: string; cls: string }> = {
  '1990s web':          { label: '1990s Web',           cls: 'border-amber-500/25 bg-amber-500/[0.06] text-amber-300' },
  'bbs archive':        { label: 'BBS / Text Archives', cls: 'border-violet-500/25 bg-violet-500/[0.06] text-violet-300' },
  'early 2000s':        { label: 'Early 2000s Forums',  cls: 'border-orange-500/22 bg-orange-500/[0.05] text-orange-300' },
  'pre-social archive': { label: 'Pre-Social Archive',  cls: 'border-sky-500/22 bg-sky-500/[0.05] text-sky-300' },
  'modern source':      { label: 'Unknown Era',         cls: 'border-white/10 bg-white/[0.025] text-slate-400' },
};

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
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70">Archived Snapshot</span>
          {candidate.archivedAt && (
            <span className="text-[12px] text-violet-300/55">{candidate.archivedAt.slice(0, 10)}</span>
          )}
          {candidate.firstSeenYear && (
            <span className="rounded-sm bg-violet-900/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-400/60">
              {candidate.firstSeenYear}
            </span>
          )}
        </div>
        {candidate.originalDomain && (
          <p className="text-[12px] text-slate-400">
            Original: <span className="text-slate-300">{candidate.originalDomain}</span>
          </p>
        )}
        {candidate.topicGroupName && (
          <p className="mt-0.5 text-[11px] text-slate-600">{candidate.topicGroupName} · internet artifact</p>
        )}
        {!candidate.topicGroupName && (
          <p className="mt-0.5 text-[11px] text-slate-600">Snapshot via Wayback Machine</p>
        )}
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
// SourcePreviewCard — source-native preview layout (Phase L, TASK 1)
//
// Reconstructs the look of the original source from available metadata.
// No screenshots or remote fetches are performed here.
//
// TODO (future): integrate a screenshot service, browser render capture,
// and social card generation to show real page thumbnails.
// ---------------------------------------------------------------------------

function SourcePreviewCard({
  candidate,
  sourceName,
}: {
  candidate: FetchedCandidate;
  sourceName: string;
}) {
  const { sourceType, title, summary, sourceUrl } = candidate;
  const excerpt = summary ? summary.slice(0, 320) : '';

  // ── Reddit ─────────────────────────────────────────────────────────────────
  if (sourceType === 'reddit') {
    const age = candidate.redditPostedAt ? relativeAge(candidate.redditPostedAt) : null;
    return (
      <div className="overflow-hidden rounded-xl border border-orange-500/22 bg-orange-500/[0.05]">
        {/* Top row: subreddit · author · age */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-orange-500/14 bg-orange-500/[0.07] px-4 py-2.5">
          {candidate.redditSubreddit && (
            <span className="text-[13px] font-bold text-orange-400">r/{candidate.redditSubreddit}</span>
          )}
          {candidate.redditSubreddit && (candidate.redditAuthor || age) && (
            <span className="text-orange-500/30 text-[11px]">·</span>
          )}
          {candidate.redditAuthor && (
            <span className="text-[12px] text-slate-500">u/{candidate.redditAuthor}</span>
          )}
          {age && (
            <>
              <span className="text-orange-500/30 text-[11px]">·</span>
              <span className="text-[12px] text-slate-600">{age}</span>
            </>
          )}
        </div>
        <div className="px-4 py-3">
          {/* Big title */}
          <p className="mb-2.5 text-[19px] font-bold leading-snug text-white">{title}</p>
          {/* Excerpt */}
          {excerpt && (
            <p className="mb-3 text-[15px] leading-relaxed text-slate-300 line-clamp-6">{excerpt}</p>
          )}
          {/* Score / comments row */}
          <div className="flex items-center gap-3">
            {candidate.redditScore != null && (
              <span className="text-[13px] font-semibold text-orange-400/70">▲ {candidate.redditScore}</span>
            )}
            {candidate.redditComments != null && (
              <span className="text-[13px] text-slate-600">{candidate.redditComments} comments</span>
            )}
          </div>
        </div>
        <div className="border-t border-orange-500/12 px-4 py-2.5">
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
            className="text-[13px] font-semibold text-orange-400/70 transition-colors hover:text-orange-400">
            Open Original Post ↗
          </a>
        </div>
      </div>
    );
  }

  // ── MediaWiki ──────────────────────────────────────────────────────────────
  if (sourceType === 'mediawiki') {
    let domain = '';
    try { domain = new URL(sourceUrl).hostname; } catch { /* ignore */ }
    return (
      <div className="overflow-hidden rounded-xl border border-sky-500/22 bg-sky-500/[0.05]">
        <div className="flex items-center gap-2 border-b border-sky-500/14 bg-sky-500/[0.07] px-4 py-2.5">
          <span className="text-[13px] font-bold text-sky-400/70">⚬ wiki</span>
          {domain && <span className="text-[14px] text-sky-300/70">{domain}</span>}
          <span className="ml-auto text-[12px] text-slate-600">{sourceName}</span>
        </div>
        <div className="flex gap-3 px-4 pt-3">
          {candidate.sourceImageUrl && (
            <img src={candidate.sourceImageUrl} alt=""
              className="h-24 w-24 shrink-0 rounded-lg object-cover opacity-75" />
          )}
          <div className="min-w-0">
            <p className="mb-2 text-[20px] font-bold leading-snug text-white">{title}</p>
            {excerpt && (
              <p className="text-[18px] leading-relaxed text-slate-300 line-clamp-4">{excerpt}</p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 border-t border-sky-500/12 px-4 py-2.5">
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
            className="text-[14px] font-semibold text-sky-400/70 transition-colors hover:text-sky-400">
            Open Article ↗
          </a>
          <span className="ml-auto text-[11px] text-slate-700">MediaWiki · plain-text extract</span>
        </div>
      </div>
    );
  }

  // ── Wayback / archived ─────────────────────────────────────────────────────
  if (sourceType === 'wayback' || candidate.isArchived) {
    return (
      <div className="overflow-hidden rounded-xl border border-violet-500/22 bg-violet-500/[0.05]">
        <div className="flex flex-wrap items-center gap-2 border-b border-violet-500/14 bg-violet-500/[0.08] px-4 py-2.5">
          <span className="text-[13px] font-bold text-violet-400/70">📦 Wayback Machine</span>
          {candidate.archivedAt && (
            <span className="text-[13px] text-violet-300/60">archived {candidate.archivedAt.slice(0, 10)}</span>
          )}
          {candidate.sourceEra && candidate.sourceEra !== 'modern source' && (
            <span className="ml-auto rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-400/70">
              {candidate.sourceEra}
            </span>
          )}
        </div>
        {/* Phase W: dominant archaeology data block */}
        <div className="border-b border-violet-500/14 bg-violet-500/[0.06] px-4 py-3">
          <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
            {candidate.firstSeenYear && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-500/60 mb-0.5">First Seen</p>
                <p className="text-[22px] font-black leading-none text-violet-300">{candidate.firstSeenYear}</p>
              </div>
            )}
            {candidate.sourceEra && candidate.sourceEra !== 'modern source' && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-500/60 mb-0.5">Archive Era</p>
                <p className="text-[14px] font-bold leading-tight text-violet-200/80 uppercase">{candidate.sourceEra}</p>
              </div>
            )}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-500/60 mb-0.5">Recovered From</p>
              <p className="text-[13px] font-semibold leading-tight text-violet-300/70 uppercase">
                {candidate.originalDomain ?? 'Wayback Snapshot'}
              </p>
            </div>
            {candidate.topicGroupName && (
              <div className="ml-auto self-end">
                <span className="rounded-sm bg-violet-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-400/60">
                  {candidate.topicGroupName}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="px-4 pt-3">
          <p className="mb-2 text-[20px] font-bold leading-snug text-white">{title}</p>
          {excerpt && (
            <p className="mb-3 text-[16px] leading-relaxed text-slate-300">{excerpt}</p>
          )}
        </div>
        <div className="flex items-center border-t border-violet-500/12 px-4 py-2.5">
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
            className="text-[14px] font-semibold text-violet-400/70 transition-colors hover:text-violet-400">
            Open Snapshot ↗
          </a>
          <span className="ml-auto text-[11px] text-slate-700">internet artifact · unverified</span>
        </div>
      </div>
    );
  }

  // ── Erowid experience report ───────────────────────────────────────────────
  if (sourceUrl.includes('erowid.org')) {
    return (
      <div className="overflow-hidden rounded-xl border border-amber-500/22 bg-amber-500/[0.05]">
        <div className="flex items-center gap-2 border-b border-amber-500/14 bg-amber-500/[0.07] px-4 py-2.5">
          <span className="text-[13px] font-bold text-amber-400/70">⬡ Erowid</span>
          <span className="text-[13px] text-amber-300/60">experience report</span>
        </div>
        <div className="px-4 pt-3">
          <p className="mb-2 text-[20px] font-bold leading-snug text-white">{title}</p>
          {excerpt && (
            <p className="mb-3 text-[18px] leading-relaxed text-slate-300">{excerpt}</p>
          )}
        </div>
        <div className="flex items-center border-t border-amber-500/12 px-4 py-2.5">
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
            className="text-[14px] font-semibold text-amber-400/70 transition-colors hover:text-amber-400">
            Open Erowid Report ↗
          </a>
        </div>
      </div>
    );
  }

  // ── Generic forum / BBS / other ────────────────────────────────────────────
  const isBbs = sourceType === 'bbs';
  return (
    <div className={`overflow-hidden rounded-xl border ${isBbs ? 'border-amber-500/20 bg-amber-500/[0.03]' : 'border-slate-500/20 bg-slate-500/[0.04]'}`}>
      <div className={`flex flex-wrap items-center gap-2 border-b px-4 py-2.5 ${isBbs ? 'border-amber-500/14 bg-amber-500/[0.06]' : 'border-white/8 bg-white/[0.03]'}`}>
        <span className={`text-[13px] font-bold ${isBbs ? 'text-amber-400/70' : 'text-slate-500'}`}>
          {sourceType === 'forum' ? '⬡ forum' : isBbs ? '⬡ BBS TEXT ARTIFACT' : '⬡ source'}
        </span>
        <span className="text-[14px] text-slate-400">{sourceName}</span>
        {candidate.topicGroupName && (
          <span className={`ml-auto rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${isBbs ? 'bg-amber-900/30 text-amber-400/60' : 'bg-slate-800/50 text-slate-500'}`}>
            {candidate.topicGroupName}
          </span>
        )}
      </div>
      <div className="px-4 pt-3">
        <p className="mb-2 text-[20px] font-bold leading-snug text-white">{title}</p>
        {excerpt && (
          <p className="mb-3 text-[17px] leading-relaxed text-slate-300">{excerpt}</p>
        )}
      </div>
      <div className="flex items-center border-t border-white/8 px-4 py-2.5">
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
          className={`text-[14px] font-semibold transition-colors ${isBbs ? 'text-amber-400/70 hover:text-amber-400' : 'text-slate-400/70 hover:text-slate-300'}`}>
          Open Source ↗
        </a>
        {isBbs && <span className="ml-auto text-[11px] text-slate-700">internet artifact · unverified</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OriginTrailPanel — Phase Y: TASK 3
// Shows a chronological trail of appearances across the internet for a
// candidate that has lineage data.  Framed as "internet mythology archaeology"
// — no truth claims, no factual endorsement.
// ---------------------------------------------------------------------------

function OriginTrailPanel({ candidate }: { candidate: FetchedCandidate }) {
  const trail = candidate.originTrail;
  if (!trail || trail.length === 0) return null;

  const statusLabel: Record<string, { label: string; cls: string }> = {
    'possible-origin':  { label: '◈ POSSIBLE ORIGIN SIGNAL',  cls: 'border-amber-500/40 bg-amber-500/12 text-amber-300' },
    'related-signal':   { label: '⟳ RELATED SIGNAL',          cls: 'border-violet-500/30 bg-violet-500/8 text-violet-300' },
    'mirror':           { label: '⬡ MIRROR SIGNAL',            cls: 'border-sky-500/30 bg-sky-500/8 text-sky-300' },
    'earlier-variant':  { label: '↯ EARLIER VARIANT FOUND',   cls: 'border-emerald-500/35 bg-emerald-500/8 text-emerald-300' },
  };
  const badge = candidate.originStatus ? statusLabel[candidate.originStatus] : null;

  return (
    <div className="mb-3 rounded-xl border border-amber-500/18 bg-amber-500/[0.04] overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/14 bg-amber-500/[0.07] px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-500/70">Origin Trail</span>
        {badge && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}>
            {badge.label}
          </span>
        )}
        {candidate.lineageConfidence != null && (
          <span className="ml-auto text-[10px] text-slate-700">
            {Math.round(candidate.lineageConfidence * 100)}% confidence
          </span>
        )}
        {candidate.relatedSignalCount != null && candidate.relatedSignalCount > 0 && (
          <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-600">
            +{candidate.relatedSignalCount} related
          </span>
        )}
      </div>
      <div className="px-4 py-3 flex flex-col gap-1.5">
        {trail.map((entry, idx) => (
          <div key={`${entry.url}-${idx}`} className="flex items-start gap-2.5">
            <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
              <div className={`h-2 w-2 rounded-full ${entry.isCurrentSession ? 'bg-amber-400/70' : 'bg-amber-600/40'}`} />
              {idx < trail.length - 1 && (
                <div className="w-px grow bg-amber-600/20" style={{ height: 12 }} />
              )}
            </div>
            <div className="min-w-0">
              <p className={`text-[13px] font-semibold leading-tight ${entry.isCurrentSession ? 'text-amber-200/80' : 'text-slate-500'}`}>
                {entry.label}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-700">{entry.sourceType}</span>
                {entry.isCurrentSession && (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600/50">this scan</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-amber-500/12 px-4 py-1.5">
        <p className="text-[9px] leading-relaxed text-slate-700">
          Internet mythology archaeology · appearance trail only · not a factual claim
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostedCard — session-posted story with social copy buttons
// ---------------------------------------------------------------------------

interface PostedResult {
  threadSlug:   string;
  title:        string;
  category:     string;
  sourceName:   string;
  publishedAt:  string;
  telegramText: string;
  xText:        string;
}

function PostedCard({ result, isNew }: { result: PostedResult; isNew?: boolean }) {
  const [copied, setCopied] = useState<'tg' | 'x' | null>(null);

  async function handleCopyLocal(text: string, which: 'tg' | 'x') {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-all ${isNew ? 'border-emerald-400/55 bg-emerald-500/[0.09]' : 'border-emerald-500/30 bg-emerald-500/[0.06]'}`}
      style={isNew ? { animation: 'postedPulse 2s ease-out both' } : undefined}
    >
      <div className="border-b border-emerald-500/15 bg-emerald-500/[0.09] px-5 py-3">
        <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Posted</p>
        <p className="text-[19px] font-bold leading-snug text-white">{result.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[12px] font-semibold text-emerald-300">{result.category}</span>
          {result.sourceName && (
            <span className="text-[12px] text-slate-600">{result.sourceName}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {result.threadSlug ? (
          <a href={`/threads/${result.threadSlug}`} target="_blank" rel="noopener noreferrer"
            className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-[17px] font-bold text-black transition-colors hover:bg-emerald-400">
            Open Thread ↗
          </a>
        ) : (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-[14px] text-amber-300">
            Thread created — check /threads for the new post.
          </div>
        )}
        <button
          onClick={() => handleCopyLocal(result.xText, 'x')}
          className={`flex w-full min-h-[48px] items-center justify-center rounded-2xl border text-[15px] font-semibold transition-all ${
            copied === 'x' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-white/12 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
          }`}>
          {copied === 'x' ? '✓ Copied X Post' : 'Copy X Post'}
        </button>
        <button
          onClick={() => handleCopyLocal(result.telegramText, 'tg')}
          className={`flex w-full min-h-[48px] items-center justify-center rounded-2xl border text-[15px] font-semibold transition-all ${
            copied === 'tg' ? 'border-sky-500/40 bg-sky-500/15 text-sky-300' : 'border-white/12 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
          }`}>
          {copied === 'tg' ? '✓ Copied Telegram' : 'Copy Telegram Post'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineScanEdit — compact edit form embedded in a scan result card
// ---------------------------------------------------------------------------

function InlineScanEdit({
  candidate,
  onPost,
  onCancel,
}: {
  candidate: FetchedCandidate;
  onPost: (form: { title: string; body: string; category: string; tags: string }) => void;
  onCancel: () => void;
}) {
  const [title,    setTitle]    = useState(candidate.title);
  const [body,     setBody]     = useState(candidate.summary);
  const [category, setCategory] = useState(candidate.category ?? 'Internet Lore');
  const [tags,     setTags]     = useState((candidate.tags ?? []).join(', '));

  const inp = 'w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-[15px] leading-normal text-white placeholder:text-slate-600 focus:border-sky-500/40 focus:outline-none transition-colors';

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-500/25 bg-sky-500/[0.04]">
      <div className="border-b border-sky-500/14 bg-sky-500/[0.06] px-5 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-sky-500/70">Edit Before Posting</p>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} placeholder="Thread title" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={`${inp} resize-y`} placeholder="Thread body" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inp} bg-[#0a1520]`}>
          {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className={inp} placeholder="tag1, tag2, tag3" />
        <div className="flex gap-2">
          <button
            onClick={() => onPost({ title, body, category, tags })}
            disabled={!title.trim() || !body.trim()}
            className="flex flex-1 min-h-[52px] items-center justify-center rounded-xl bg-emerald-500 text-[17px] font-bold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Post to SWIM
          </button>
          <button
            onClick={onCancel}
            className="flex min-h-[52px] items-center justify-center rounded-xl border border-white/12 bg-white/5 px-5 text-[15px] font-semibold text-slate-400 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// buildRichThreadBody — structured thread body for one-click publish
// ---------------------------------------------------------------------------

function buildRichThreadBody(candidate: FetchedCandidate, sourceName: string): string {
  const analysis = generateSignalAnalysis(candidate);
  const lines: string[] = [];

  lines.push(candidate.summary);
  lines.push('');
  lines.push('────────────────────────');
  lines.push('');
  lines.push('> SCANNER ANALYSIS');
  lines.push(`> ${analysis.surfacedBecause}`);
  if (analysis.anomalyMarkers.length > 0) {
    lines.push(`> Anomaly markers: ${analysis.anomalyMarkers.slice(0, 5).join(' · ')}`);
  }
  lines.push(`> Corroboration: ${analysis.corroborationLevel}  ·  Rarity: ${analysis.rarityLevel}`);
  if (candidate.sourceEra && candidate.sourceEra !== 'modern source') {
    lines.push(`> Archive era: ${candidate.sourceEra}${candidate.archiveYear ? ` (${candidate.archiveYear})` : ''}`);
  }
  if (candidate.firstSeenYear) {
    lines.push(`> First seen: ${candidate.firstSeenYear}`);
  }
  if (candidate.topicGroupName) {
    lines.push(`> Topic group: ${candidate.topicGroupName}`);
  }
  lines.push('');
  lines.push('> SOURCE ATTRIBUTION');
  lines.push(`> Source: ${sourceName}`);
  if (candidate.attributionText) lines.push(`> ${candidate.attributionText}`);
  lines.push(`> URL: ${candidate.sourceUrl}`);

  return lines.join('\n');
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
  const [lastPublished, setLastPublished] = useState<PostedResult | null>(null);
  const [copied,        setCopied]        = useState<'tg' | 'x' | null>(null);
  const [lastApprovedId, setLastApprovedId] = useState<string | null>(null);
  const scanColRef        = useRef<HTMLDivElement>(null);
  const reviewColRef      = useRef<HTMLDivElement>(null);
  const publishColRef     = useRef<HTMLDivElement>(null);
  const undoSkipTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase N: one-click approve+post
  const [postedResults,       setPostedResults]       = useState<PostedResult[]>([]);
  const [editOpenUrl,         setEditOpenUrl]         = useState<string | null>(null);

  // Phase N: fresh scan rotation
  const [seenUrlsThisSession, setSeenUrlsThisSession] = useState<Set<string>>(new Set());
  const [prevScanResults,     setPrevScanResults]     = useState<SessionSourceResult[]>([]);
  const [showPrevResults,     setShowPrevResults]     = useState(false);

  // Phase P: collapsed complexity
  const [showMoreResults, setShowMoreResults] = useState(false);
  const [moreTab,         setMoreTab]         = useState<'needs-review' | 'low-signal' | 'blocked'>('needs-review');
  const [showReviewQueue, setShowReviewQueue] = useState(false);

  // Phase Q: live scan feel + animation
  const [liveCount,              setLiveCount]              = useState(0);
  const [liveScanningSource,     setLiveScanningSource]     = useState('');
  const [liveScanningSourceType, setLiveScanningSourceType] = useState('');
  const [newPostedSlug,          setNewPostedSlug]          = useState<string | null>(null);
  const activeScanSourcesRef = useRef<typeof enabledSources>([]);

  // Phase S: chaos mode toggle
  const [chaosMode, setChaosMode] = useState(false);

  // Phase U: origin bias — boosts old-web/BBS/Wayback, penalizes recent Reddit
  const [originBias, setOriginBias] = useState(false);

  // Phase T: feed sort + filter + quick review
  const [feedSort,    setFeedSort]    = useState<'best' | 'newest' | 'oldest' | 'weirdest' | 'unseen'>(
    activePreset === 'origin-scan' ? 'oldest' : 'best'
  );
  const [feedFilters, setFeedFilters] = useState<Set<string>>(new Set());
  const [quickReview, setQuickReview] = useState(false);

  // Phase T: undo skip
  const [undoSkipUrl,   setUndoSkipUrl]   = useState<string | null>(null);
  const [undoSkipTitle, setUndoSkipTitle] = useState('');

  // Phase T: source preview open per card (Map<sourceUrl, boolean>)
  const [previewOpen, setPreviewOpen] = useState<Map<string, boolean>>(new Map());

  // Phase U: per-card details panel open
  const [detailsOpen, setDetailsOpen] = useState<Map<string, boolean>>(new Map());

  // ── Scan status message cycling (source-type aware) ─────────────────────

  const SCAN_STATUS_BY_TYPE: Record<string, string[]> = {
    reddit: [
      'querying subreddit endpoints...',
      'shuffling sort windows...',
      'scoring story quality...',
      'checking corroboration threads...',
      'extracting narrative signal...',
      'filtering noise...',
    ],
    wayback: [
      'probing archive.org CDX...',
      'rotating era window...',
      'recovering old-web fragment...',
      'classifying source era...',
      'deep archive ping received...',
      'filtering homepage captures...',
    ],
    bbs: [
      'connecting to BBS node...',
      'scanning thread index...',
      'recovering archived post...',
      'classifying forum era...',
      'extracting board signal...',
      'filtering noise...',
    ],
    mediawiki: [
      'querying wiki index...',
      'scanning article space...',
      'recovering documented signal...',
      'classifying entry...',
      'extracting narrative...',
      'filtering noise...',
    ],
    default: [
      'recovered signal found...',
      'analyzing archived fragment...',
      'origin candidate detected...',
      'querying archive endpoints...',
      'scoring anomaly markers...',
      'checking corroboration layers...',
      'extracting narrative signal...',
      'deep archive ping received...',
      'classifying source era...',
      'filtering noise...',
      'signal recovered...',
      'scanning archive...',
    ],
  };

  useEffect(() => {
    if (scanPhase !== 'scanning') { setScanStatus(''); return; }
    scanStatusIdx.current = 0;
    const getMessages = () =>
      SCAN_STATUS_BY_TYPE[liveScanningSourceType] ?? SCAN_STATUS_BY_TYPE.default;
    setScanStatus(getMessages()[0]);
    const id = window.setInterval(() => {
      const msgs = getMessages();
      scanStatusIdx.current = (scanStatusIdx.current + 1) % msgs.length;
      setScanStatus(msgs[scanStatusIdx.current]);
    }, 1600);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanPhase, liveScanningSourceType]);

  // ── Live counter animation during scan ───────────────────────────────────
  useEffect(() => {
    if (scanPhase !== 'scanning') { setLiveCount(0); return; }
    const id = window.setInterval(() => {
      setLiveCount((prev) => prev + Math.floor(Math.random() * 3));
    }, 500);
    return () => window.clearInterval(id);
  }, [scanPhase]);

  // ── Source cycling indicator during scan ─────────────────────────────────
  useEffect(() => {
    activeScanSourcesRef.current = activeScanSources;
  });
  useEffect(() => {
    if (scanPhase !== 'scanning') { setLiveScanningSource(''); setLiveScanningSourceType(''); return; }
    const sources = activeScanSourcesRef.current;
    if (!sources.length) return;
    let idx = 0;
    setLiveScanningSource(sources[0]?.name ?? '');
    setLiveScanningSourceType(sources[0]?.source_type ?? '');
    const id = window.setInterval(() => {
      idx = (idx + 1) % sources.length;
      setLiveScanningSource(sources[idx]?.name ?? '');
      setLiveScanningSourceType(sources[idx]?.source_type ?? '');
    }, 2400);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanPhase]);

  useEffect(() => {
    if (scanPhase === 'done') {
      setSelectedUrls(new Set());
      // TASK 4: smart default — Strong → Needs Review → Low Signal
      const good = scanResults.filter((r) => {
        if (r.status === 'error') return false;
        if (r.candidate.badCandidateReason || r.candidate.isIndexPage) return false;
        return r.candidate.storyScore == null || r.candidate.storyScore >= 8;
      });
      const review = scanResults.filter((r) =>
        r.status !== 'error' && !r.candidate.isIndexPage && !r.candidate.badCandidateReason &&
        (r.candidate.storyScore == null || r.candidate.storyScore < 8)
      );
      if (good.length > 0) setActiveTab('strong');
      else if (review.length > 0) setActiveTab('needs-review');
      else setActiveTab('low-signal');
    }
  }, [scanPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Feed sort default: switch to 'oldest' for origin-scan ───────────────
  useEffect(() => {
    setFeedSort(activePreset === 'origin-scan' ? 'oldest' : 'best');
  }, [activePreset]);

  // ── Preset helpers ───────────────────────────────────────────────────────

  // Sources whose base_url is a root/homepage are excluded from Run Scan —
  // they produce index pages, not stories. Use Discover Links on these instead.
  function isHomepageSource(s: DbScannerSource): boolean {
    if (!s.base_url) return false;
    try { const { pathname } = new URL(s.base_url); return pathname === '/' || pathname === ''; }
    catch { return false; }
  }

  function sourcesForPreset(presetId: string) {
    const isOriginPreset = presetId === 'origin-scan';
    const pool = (() => {
      if (presetId === PRESET_ALL) return enabledSources;
      const preset = SCAN_PRESETS.find((p) => p.id === presetId);
      if (!preset) return enabledSources;
      // Phase W: origin scan is locked to archive-only types.
      // Reddit, imageboard, and live forum sources are completely excluded.
      const ORIGIN_ALLOWED_TYPES = new Set(['wayback', 'bbs', 'archive', 'mediawiki']);
      return enabledSources.filter((s) => {
        if (isOriginPreset) {
          // Hard lock — only archival source types, no exceptions
          return ORIGIN_ALLOWED_TYPES.has(s.source_type);
        }
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

    // Fisher-Yates shuffle before health sort so equal-ranked sources rotate between runs.
    const shuffled = [...nonHomepage];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const sorted = [...shuffled].sort((a, b) => {
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

    const sliced = sorted.slice(0, MAX_PRESET_SOURCES);
    // Origin bias: cap Reddit to 2 sources so old-web sources dominate
    if (originBias) {
      let redditCount = 0;
      return sliced.filter((s) => {
        if (s.source_type === 'reddit') { if (redditCount >= 2) return false; redditCount++; }
        return true;
      });
    }
    return sliced;
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

    // Save current results as "previous" and move their URLs into the seen set
    if (scanPhase === 'done' && scanResults.length > 0) {
      setPrevScanResults(scanResults);
      setShowPrevResults(false);
      setSeenUrlsThisSession((prev) => {
        const next = new Set(prev);
        for (const r of scanResults) {
          if (r.status !== 'error') next.add(r.candidate.sourceUrl);
        }
        return next;
      });
    }

    setScanPhase('scanning');
    setScanError(null);
    setScanResults([]);
    setCandStates(new Map());
    setLowQualityOpen(false);
    setShowDiagnostics(false);
    const sourceIdsToRun = isDebugRun
      ? ['__debug_test__']
      : activeScanSources.map((s) => s.id);
    const res = await runFetchSessionAction(sourceIdsToRun, {
      includeRejected: showRejected,
      excludeUrls:     [...seenUrlsThisSession],
      chaosMode,
      originBias,
    });
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
    // Find the title for undo display
    const found = scanResults.find((r) => r.status !== 'error' && r.candidate.sourceUrl === sourceUrl);
    const title = (found && found.status !== 'error') ? found.candidate.title : sourceUrl;
    setUndoSkipUrl(sourceUrl);
    setUndoSkipTitle(title);
    if (undoSkipTimerRef.current) clearTimeout(undoSkipTimerRef.current);
    undoSkipTimerRef.current = setTimeout(() => setUndoSkipUrl(null), 5000);
  }

  function undoSkip(sourceUrl: string) {
    setCandStates((prev) => new Map(prev).set(sourceUrl, { action: 'idle' }));
    setUndoSkipUrl(null);
    if (undoSkipTimerRef.current) { clearTimeout(undoSkipTimerRef.current); undoSkipTimerRef.current = null; }
  }

  async function handleApproveAndPost(
    result: SessionSourceResult,
    editedForm?: { title: string; body: string; category: string; tags: string },
  ) {
    if (result.status === 'error') return;
    const key = result.candidate.sourceUrl;
    setCandStates((prev) => new Map(prev).set(key, { action: 'posting' }));
    const c = result.candidate;
    const title    = editedForm?.title    ?? c.title;
    const body     = editedForm?.body     ?? buildRichThreadBody(c, result.sourceName);
    const category = editedForm?.category ?? (c.category ?? 'Internet Lore');
    const tags     = editedForm
      ? editedForm.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : (c.tags ?? []);

    // Step 1: queue the candidate
    const qr = await queueFetchedCandidateAction({
      sourceId:          result.sourceId,
      title,
      summary:           body,
      sourceUrl:         key,
      category,
      tags,
      anomalyScore:      c.anomalyScore,
      overrideDuplicate: true,
      sourceImageUrl:    c.sourceImageUrl,
      mediaType:         c.mediaType,
      attributionText:   c.attributionText,
      captureNotes:      c.captureNotes,
    });

    if ('error' in qr) {
      setCandStates((prev) => new Map(prev).set(key, { action: 'error', error: qr.error }));
      return;
    }
    if (!('signalId' in qr)) {
      setCandStates((prev) => new Map(prev).set(key, { action: 'error', error: 'Queue failed — no signal ID returned' }));
      return;
    }

    // Step 2: immediately publish (rebirthSignalAsThreadAction does not require
    // the signal to be in rebirth-ready status — it only guards against double-publish)
    const pr = await rebirthSignalAsThreadAction({ signalId: qr.signalId, title, body, category, tags });

    if ('error' in pr) {
      setCandStates((prev) => new Map(prev).set(key, { action: 'error', error: pr.error }));
      return;
    }

    setCandStates((prev) => new Map(prev).set(key, { action: 'posted' }));
    setEditOpenUrl(null);

    // Task 7: prevent re-scanning this URL
    setSeenUrlsThisSession((prev) => new Set([...prev, key]));

    const shareData = {
      title, category,
      summary:     body.slice(0, 200),
      threadSlug:  pr.threadSlug,
      sourceName:  result.sourceName,
      anomalyScore: c.anomalyScore,
      tags,
    };
    const slug = pr.threadSlug;
    setPostedResults((prev) => [{
      title, category,
      sourceName:   result.sourceName,
      threadSlug:   slug,
      telegramText: formatTelegramPost(shareData),
      xText:        formatXPost(shareData),
      publishedAt:  new Date().toISOString(),
    }, ...prev]);

    // Task 6: pulse animation on new posted card
    setNewPostedSlug(slug ?? null);
    setTimeout(() => setNewPostedSlug(null), 2800);
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
        setLastApprovedId(signalId);
        setApproveToast(sig.title);
        setTimeout(() => setApproveToast(null), 8000);
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
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-emerald-300">Story queued</p>
            <p className="text-[14px] text-emerald-400/60 line-clamp-1">{queueToast}</p>
          </div>
          <div className="ml-auto shrink-0">
            <button
              onClick={() => reviewColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="flex min-h-[40px] items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/12 px-4 text-[13px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/22">
              Review Now →
            </button>
          </div>
        </div>
      )}

      {/* ── TASK 3: Approve → READY TO PUBLISH banner ── */}
      {approveToast && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-purple-500/35 bg-purple-500/[0.07]">
          <div className="border-b border-purple-500/20 bg-purple-500/[0.10] px-5 py-4">
            <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.25em] text-purple-600">Story approved</p>
            <p className="text-[26px] font-bold leading-tight text-purple-300">READY TO PUBLISH</p>
          </div>
          <div className="p-5">
            <p className="mb-4 text-[16px] leading-snug text-white line-clamp-2">{approveToast}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setApproveToast(null);
                  if (lastApprovedId) setPrepareOpenId(lastApprovedId);
                  publishColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="flex w-full min-h-[56px] items-center justify-center rounded-2xl bg-purple-500 text-[18px] font-bold text-white transition-colors hover:bg-purple-400"
              >
                Open Publish Editor →
              </button>
              <button
                onClick={() => setApproveToast(null)}
                className="flex w-full min-h-[52px] items-center justify-center rounded-2xl border border-white/12 bg-white/[0.03] text-[16px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.06]"
              >
                Keep Reviewing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2-column grid: Live Scan | Live Threads ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">

        {/* ══ 1 · LIVE SCAN ══ */}
        <div ref={scanColRef} className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">

          {/* Column header */}
          <div className="border-b border-white/8 px-6 py-5">
            <div className="mb-1 flex items-center gap-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${scanPhase === 'scanning' ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500/50'}`} />
              <h2 className="text-[22px] font-bold text-white">Live Scan</h2>
              {scanPhase === 'done' && scanResults.length > 0 && (
                <span className="ml-auto rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[13px] font-bold text-emerald-400">
                  {scanResults.filter(r => r.status !== 'error').length} candidates
                </span>
              )}
            </div>
            <p className="text-[13px] text-slate-500">
              Select a preset · approve candidates · threads go live instantly.
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

            {/* Chaos mode + Origin Bias toggles */}
            {(enabledSources.length > 0 || activeScanSources.length > 0) && (
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setChaosMode((v) => !v)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[12px] transition-colors ${
                    chaosMode
                      ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400'
                      : 'border-white/8 bg-white/[0.02] text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <span className="font-bold uppercase tracking-[0.14em]">
                    {chaosMode ? '↯ CHAOS MODE ON' : '↯ chaos mode'}
                  </span>
                  <span className="text-[10px] opacity-60">
                    {chaosMode ? 'relaxed thresholds · wider pool · ±20 jitter' : 'off'}
                  </span>
                </button>
                <button
                  onClick={() => setOriginBias((v) => !v)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[12px] transition-colors ${
                    originBias
                      ? 'border-violet-500/35 bg-violet-500/[0.07] text-violet-300'
                      : 'border-white/8 bg-white/[0.02] text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <span className="font-bold uppercase tracking-[0.14em]">
                    {originBias ? '◈ ORIGIN BIAS ON' : '◈ origin bias'}
                  </span>
                  <span className="text-[10px] opacity-60">
                    {originBias ? 'old-web boost · recent Reddit penalized' : 'off'}
                  </span>
                </button>
              </div>
            )}

            {/* Run scan button */}
            {(enabledSources.length > 0 || activeScanSources.length > 0 || activePreset === PRESET_DEBUG) && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleRunScan}
                  disabled={scanPhase === 'scanning' || (activeScanSources.length === 0 && activePreset !== PRESET_DEBUG)}
                  className={`${BTN_PRIMARY} ${scanPhase === 'scanning' ? 'ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-black' : ''}`}
                >
                  {scanPhase === 'scanning'
                    ? <><Spinner /> Scanning…</>
                    : scanPhase === 'done'
                      ? `↺ Rescan${activePreset !== PRESET_ALL && activePreset !== PRESET_DEBUG ? ` · ${activeScanSources.length} source${activeScanSources.length !== 1 ? 's' : ''}` : ''}`
                      : (activeScanSources.length === 0 && activePreset !== PRESET_DEBUG)
                        ? 'No sources for this preset'
                        : `Scan${activePreset !== PRESET_ALL && activePreset !== PRESET_DEBUG ? ` · ${activeScanSources.length} source${activeScanSources.length !== 1 ? 's' : ''}` : ''}`
                  }
                </button>
                {scanPhase === 'scanning' && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-mono text-[13px] tabular-nums text-emerald-400/70">
                        {liveCount} fragments scanned
                      </span>
                    </div>
                    {liveScanningSource && (
                      <p className="font-mono text-[11px] text-slate-600 tracking-wide">
                        ↯ {liveScanningSource}
                      </p>
                    )}
                    {scanStatus && (
                      <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-400/45 animate-pulse">
                        {scanStatus}
                      </p>
                    )}
                  </div>
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

            {/* Previous scan results — collapsed */}
            {prevScanResults.length > 0 && (
              <div className="rounded-xl border border-white/6 bg-white/[0.015]">
                <button
                  onClick={() => setShowPrevResults((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-700">
                    Previous Scan · {prevScanResults.filter((r) => r.status !== 'error').length} candidates
                  </span>
                  <span className="text-[12px] text-slate-700">{showPrevResults ? '▲ hide' : '▼ show'}</span>
                </button>
                {showPrevResults && (
                  <div className="border-t border-white/6 px-4 pb-3 pt-2.5">
                    <div className="flex flex-col gap-1.5">
                      {prevScanResults.filter((r) => r.status !== 'error').slice(0, 12).map((r) => (
                        <div key={r.candidate.sourceUrl} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.015] px-3 py-2">
                          {r.candidate.sourceType && (
                            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${sourceTypeBadgeCls(r.candidate.sourceType)}`}>
                              {r.candidate.sourceType.slice(0, 3).toUpperCase()}
                            </span>
                          )}
                          <p className="min-w-0 truncate text-[13px] text-slate-600">{r.candidate.title}</p>
                          {r.candidate.storyScore != null && (
                            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-700">{r.candidate.storyScore}pts</span>
                          )}
                        </div>
                      ))}
                      {prevScanResults.filter((r) => r.status !== 'error').length > 12 && (
                        <p className="text-[11px] text-slate-700">
                          +{prevScanResults.filter((r) => r.status !== 'error').length - 12} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
                  const url = r.candidate.sourceUrl;
                  const st  = candStates.get(url);
                  if (st && (st.action === 'queued' || st.action === 'skipped' || st.action === 'posted')) return false;
                  if (seenUrlsThisSession.has(url)) return false;
                  return true;
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

              // ── Bulk approve+post (runs sequentially, one at a time) ──────────────
              async function bulkApprovePost() {
                const toPost = goodResults.filter(
                  (r) => r.status !== 'error' && selectedUrls.has(r.candidate.sourceUrl)
                );
                for (const result of toPost) await handleApproveAndPost(result);
                setSelectedUrls(new Set());
              }

              // Tab data — TASK 2
              const TABS = [
                { id: 'strong'       as const, label: 'Strong Candidates', count: goodResults.length,      color: 'emerald' },
                { id: 'needs-review' as const, label: 'Needs Review',      count: needsReview.length,      color: 'amber'   },
                { id: 'low-signal'   as const, label: 'Low Signal',        count: lowSignalResults.length, color: 'slate'   },
                { id: 'blocked'      as const, label: 'Blocked / Failed',  count: errorResults.length,     color: 'red'     },
              ] as const;
              const TAB_ACTIVE_CLS: Record<string, string> = {
                emerald: 'border-emerald-400/70 bg-emerald-500/18 text-emerald-300',
                amber:   'border-amber-400/70   bg-amber-500/18   text-amber-300',
                slate:   'border-slate-400/50   bg-slate-500/16   text-slate-200',
                red:     'border-red-400/70     bg-red-500/18     text-red-300',
              };
              const TAB_IDLE_CLS: Record<string, string> = {
                emerald: 'border-white/8 bg-white/[0.02] text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400/60',
                amber:   'border-white/8 bg-white/[0.02] text-slate-500 hover:border-amber-500/30   hover:text-amber-400/60',
                slate:   'border-white/8 bg-white/[0.02] text-slate-500 hover:border-slate-400/25   hover:text-slate-300',
                red:     'border-white/8 bg-white/[0.02] text-slate-500 hover:border-red-500/30     hover:text-red-400/60',
              };
              const TAB_BADGE_CLS: Record<string, string> = {
                emerald: 'bg-emerald-500/28 text-emerald-200',
                amber:   'bg-amber-500/28   text-amber-200',
                slate:   'bg-slate-500/25   text-slate-300',
                red:     'bg-red-500/28     text-red-200',
              };
              const TAB_DESC: Record<string, string> = {
                'strong':       'Best scanner finds. Queue these first.',
                'needs-review': 'Possible stories. Human check recommended.',
                'low-signal':   'Weak or generic results. Usually skip.',
                'blocked':      'Sources that failed, timed out, or were blocked.',
              };
              const TAB_DESC_CLS: Record<string, string> = {
                'strong':       'text-emerald-400/65',
                'needs-review': 'text-amber-400/65',
                'low-signal':   'text-slate-500',
                'blocked':      'text-red-400/55',
              };

              return (
                <div className="flex flex-col gap-4">

                  {/* ── Scan results header ── */}
                  <div className="rounded-2xl border border-white/14 bg-white/[0.05] px-5 py-5">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600/70">Scan Complete</p>
                    <h2 className="mb-3 text-[28px] font-bold tracking-tight text-white">
                      {goodResults.length > 0
                        ? `${goodResults.length} strong signal${goodResults.length !== 1 ? 's' : ''} recovered`
                        : candidatesFetched > 0 ? `${candidatesFetched} fetched — no strong candidates` : 'Scan complete'}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[14px] font-bold tabular-nums text-sky-300">
                        {candidatesFetched} fetched
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-[14px] font-bold tabular-nums ${goodResults.length > 0 ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300' : 'border-white/10 bg-white/[0.02] text-slate-600'}`}>
                        {goodResults.length} strong
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-[14px] font-bold tabular-nums ${needsReview.length > 0 ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-white/[0.02] text-slate-600'}`}>
                        {needsReview.length} needs review
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-[14px] font-bold tabular-nums ${lowSignalResults.length > 0 ? 'border-slate-500/25 bg-slate-500/8 text-slate-400' : 'border-white/8 bg-white/[0.015] text-slate-700'}`}>
                        {lowSignalResults.length} low signal
                      </span>
                      {errorResults.length > 0 && (
                        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[14px] font-bold tabular-nums text-red-300">
                          {errorResults.length} blocked
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Summary counts ── */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Sources',    value: sourcesScanned,    color: 'text-slate-400' },
                      { label: 'Fetched',    value: candidatesFetched, color: candidatesFetched > 0 ? 'text-sky-400' : 'text-slate-600' },
                      { label: 'Strong',     value: goodResults.length, color: goodResults.length > 0 ? 'text-emerald-400' : 'text-slate-600' },
                      { label: 'Posted',     value: postedResults.length, color: postedResults.length > 0 ? 'text-emerald-400' : 'text-slate-600' },
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

                  {/* Bulk action bar */}
                  {goodResults.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-slate-400">
                          <input
                            type="checkbox"
                            checked={
                              selectedUrls.size > 0 &&
                              goodResults
                                .filter((r) => r.status !== 'error')
                                .every((r) => selectedUrls.has(r.candidate.sourceUrl))
                            }
                            onChange={(e) => {
                              const pool = goodResults.filter((r) => r.status !== 'error');
                              setSelectedUrls(e.target.checked ? new Set(pool.map((r) => r.candidate.sourceUrl)) : new Set());
                            }}
                            className="h-3.5 w-3.5 accent-emerald-400"
                          />
                          Select All
                        </label>
                        {selectedUrls.size > 0 && (
                          <>
                            <span className="text-[13px] text-slate-500">{selectedUrls.size} selected</span>
                            <button
                              onClick={bulkApprovePost}
                              className="ml-auto rounded-xl bg-emerald-500 px-4 py-2 text-[13px] font-bold text-black transition-colors hover:bg-emerald-400"
                            >
                              Approve + Post {selectedUrls.size}
                            </button>
                            <button
                              onClick={() => { for (const url of selectedUrls) handleSkip(url); setSelectedUrls(new Set()); }}
                              className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.08]"
                            >
                              Skip
                            </button>
                          </>
                        )}
                        <label className={`${selectedUrls.size > 0 ? 'hidden' : 'flex'} ml-auto cursor-pointer items-center gap-1.5 text-[11px] text-slate-700`}>
                          <input
                            type="checkbox"
                            checked={showSeen}
                            onChange={(e) => setShowSeen(e.target.checked)}
                            className="h-3 w-3 accent-slate-500"
                          />
                          Show all
                        </label>
                      </div>
                    </div>
                  )}

                  {/* ── STRONG CANDIDATES — always visible ── */}
                  {(() => {
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
                                        <button onClick={() => handleApproveAndPost(result)}
                                          className="flex flex-1 min-h-[52px] items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/12 text-[16px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/22">
                                          Approve + Post
                                        </button>
                                        <button onClick={() => handleSkip(result.candidate.sourceUrl)}
                                          className="flex min-h-[52px] items-center justify-center rounded-xl border border-white/12 bg-white/5 px-5 text-[16px] text-slate-400 hover:bg-white/10">
                                          Skip
                                        </button>
                                      </div>
                                    )}
                                    {st.action === 'posting' && <div className="flex min-h-[52px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[16px] text-slate-400"><Spinner /> Posting…</div>}
                                    {st.action === 'posted'  && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4 text-[17px] font-bold text-emerald-300">✓ Posted to SWIM</p>}
                                    {st.action === 'skipped'  && <p className="text-[14px] text-slate-700">Skipped</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                          <p className="text-[36px] font-bold text-slate-700">—</p>
                          <p className="mt-2 text-[22px] font-bold text-slate-400">
                            {seenUrlsThisSession.size > 0 || [...candStates.values()].some(s => s.action === 'skipped')
                              ? 'No fresh unseen candidates found.'
                              : 'No strong candidates this scan'}
                          </p>
                          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                            {blockedCnt > 0
                              ? `${blockedCnt} source${blockedCnt !== 1 ? 's' : ''} blocked — fix source types or use Discover Links.`
                              : 'Try Chaos Mode for wider discovery, or check the Needs Review tab.'}
                          </p>
                          <div className="mt-5 flex flex-wrap justify-center gap-2">
                            <button
                              onClick={() => { setChaosMode(true); handleRunScan(); }}
                              className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-5 py-2.5 text-[14px] font-bold text-amber-300 transition-colors hover:bg-amber-500/18"
                            >
                              ↯ Run Chaos Scan
                            </button>
                            <button
                              onClick={() => setShowSeen(true)}
                              className="rounded-xl border border-white/12 bg-white/5 px-5 py-2.5 text-[14px] font-semibold text-slate-400 transition-colors hover:bg-white/10"
                            >
                              Show Seen Results
                            </button>
                            <a href="/scanner/sources"
                              className="rounded-xl border border-white/12 bg-white/5 px-5 py-2.5 text-[14px] font-semibold text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200">
                              Change Preset
                            </a>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-col gap-3">
                        {/* ── Undo skip banner ── */}
                        {undoSkipUrl !== null && (
                          <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
                            <span className="min-w-0 truncate text-[14px] text-slate-400">
                              <span className="text-amber-400">skipped</span> — {undoSkipTitle}
                            </span>
                            <button onClick={() => undoSkip(undoSkipUrl!)}
                              className="ml-auto shrink-0 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[13px] font-bold text-amber-300 hover:bg-amber-500/20">
                              Undo Skip
                            </button>
                          </div>
                        )}
                        {/* ── Sort + filter + quick review strip ── */}
                        <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-3">
                          {/* Sort buttons */}
                          <div className="flex flex-wrap gap-1.5">
                            {([
                              { key: 'best',     label: 'Best' },
                              { key: 'newest',   label: 'Newest' },
                              { key: 'oldest',   label: activePreset === 'origin-scan' ? 'Origin' : 'Oldest' },
                              { key: 'weirdest', label: 'Weirdest' },
                              { key: 'unseen',   label: 'Unseen' },
                            ] as const).map(({ key, label }) => (
                              <button key={key} onClick={() => setFeedSort(key)}
                                className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
                                  feedSort === key
                                    ? 'border-emerald-500/55 bg-emerald-500/15 text-emerald-300'
                                    : 'border-white/10 bg-white/[0.03] text-slate-500 hover:border-white/20 hover:text-slate-300'
                                }`}>
                                {label}
                              </button>
                            ))}
                            <button onClick={() => setQuickReview((v) => !v)}
                              className={`ml-auto rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
                                quickReview
                                  ? 'border-amber-500/55 bg-amber-500/15 text-amber-300'
                                  : 'border-white/10 bg-white/[0.03] text-slate-500 hover:border-amber-500/30 hover:text-amber-400/70'
                              }`}>
                              ⚡ Quick Review
                            </button>
                          </div>
                          {/* Filter chips */}
                          <div className="flex flex-wrap gap-1.5">
                            {([
                              { key: 'origin',       label: 'Origin Signal',    color: 'amber'   },
                              { key: 'reddit',       label: 'Reddit',           color: 'orange'  },
                              { key: 'archive',      label: 'Archive',          color: 'violet'  },
                              { key: 'needs-review', label: 'Needs Review',     color: 'amber'   },
                              { key: 'high-priority',label: 'High Priority',    color: 'emerald' },
                              { key: 'corroboration',label: 'Has Corroboration',color: 'sky'     },
                            ] as const).map(({ key, label, color }) => {
                              const isOn = feedFilters.has(key);
                              const activeCls: Record<string, string> = {
                                amber:   'border-amber-500/50 bg-amber-500/12 text-amber-300',
                                orange:  'border-orange-500/50 bg-orange-500/12 text-orange-300',
                                violet:  'border-violet-500/50 bg-violet-500/12 text-violet-300',
                                emerald: 'border-emerald-500/50 bg-emerald-500/12 text-emerald-300',
                                sky:     'border-sky-500/50 bg-sky-500/12 text-sky-300',
                              };
                              return (
                                <button key={key} onClick={() => setFeedFilters((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(key)) next.delete(key); else next.add(key);
                                  return next;
                                })}
                                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                                    isOn ? activeCls[color] : 'border-white/8 bg-white/[0.02] text-slate-600 hover:border-white/16 hover:text-slate-400'
                                  }`}>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {/* Strong Candidates header */}
                        <div className="rounded-xl border border-emerald-500/18 bg-emerald-500/[0.05] px-4 py-3">
                          <p className="text-[17px] font-bold text-emerald-300">
                            Strong Candidates
                            {visibleGood.length < goodResults.length && (
                              <span className="ml-2 text-[14px] font-semibold text-emerald-400/55">· showing {visibleGood.length} of {goodResults.length}</span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[13px] text-emerald-400/55">Queue the best stories for review.</p>
                        </div>
                        {/* Sort + filter + render */}
                        {(() => {
                          const isOriginScan = activePreset === 'origin-scan';
                          // ── Sort ──
                          const sortedGood = [...visibleGood].sort((a, b) => {
                            if (a.status === 'error') return 1;
                            if (b.status === 'error') return -1;
                            switch (feedSort) {
                              case 'newest': {
                                const da = a.candidate.redditPostedAt ? new Date(a.candidate.redditPostedAt).getTime() : null;
                                const db = b.candidate.redditPostedAt ? new Date(b.candidate.redditPostedAt).getTime() : null;
                                if (da !== null && db !== null) return db - da;
                                if (da !== null) return -1;
                                if (db !== null) return 1;
                                const ya = a.candidate.archiveYear ?? 0;
                                const yb = b.candidate.archiveYear ?? 0;
                                if (ya !== yb) return (yb || -1) - (ya || -1);
                                return (b.candidate.finalPriorityScore ?? b.candidate.storyScore ?? 0) - (a.candidate.finalPriorityScore ?? a.candidate.storyScore ?? 0);
                              }
                              case 'oldest': {
                                // Phase W: for origin scan, archive-first by source type before year
                                if (isOriginScan) {
                                  const ta = ORIGIN_SOURCE_TYPE_RANK[a.candidate.sourceType ?? ''] ?? 10;
                                  const tb = ORIGIN_SOURCE_TYPE_RANK[b.candidate.sourceType ?? ''] ?? 10;
                                  if (ta !== tb) return ta - tb;
                                }
                                const ya = a.candidate.archiveYear;
                                const yb = b.candidate.archiveYear;
                                if (ya != null && yb != null) {
                                  if (ya !== yb) return ya - yb;
                                } else if (ya != null) return -1;
                                else if (yb != null) return 1;
                                const ea = ERA_GROUP_ORDER.indexOf(a.candidate.sourceEra ?? 'modern source');
                                const eb = ERA_GROUP_ORDER.indexOf(b.candidate.sourceEra ?? 'modern source');
                                return (ea === -1 ? 99 : ea) - (eb === -1 ? 99 : eb);
                              }
                              case 'weirdest': {
                                const wa = (a.candidate.corroborationScore ?? 0) + (a.candidate.storySignals?.length ?? 0);
                                const wb = (b.candidate.corroborationScore ?? 0) + (b.candidate.storySignals?.length ?? 0);
                                return wb - wa;
                              }
                              case 'unseen': {
                                const ua = seenUrlsThisSession.has(a.candidate.sourceUrl) ? 1 : 0;
                                const ub = seenUrlsThisSession.has(b.candidate.sourceUrl) ? 1 : 0;
                                if (ua !== ub) return ua - ub;
                                return (b.candidate.finalPriorityScore ?? b.candidate.storyScore ?? 0) - (a.candidate.finalPriorityScore ?? a.candidate.storyScore ?? 0);
                              }
                              default: { // 'best'
                                if (isOriginScan) {
                                  // Phase W: archive-first → era → origin score
                                  const ta = ORIGIN_SOURCE_TYPE_RANK[a.candidate.sourceType ?? ''] ?? 10;
                                  const tb = ORIGIN_SOURCE_TYPE_RANK[b.candidate.sourceType ?? ''] ?? 10;
                                  if (ta !== tb) return ta - tb;
                                  const oa = ERA_GROUP_ORDER.indexOf(a.candidate.sourceEra ?? 'modern source');
                                  const ob = ERA_GROUP_ORDER.indexOf(b.candidate.sourceEra ?? 'modern source');
                                  if (oa !== ob) return (oa === -1 ? 99 : oa) - (ob === -1 ? 99 : ob);
                                }
                                const sa = a.candidate.originPriorityScore ?? a.candidate.finalPriorityScore ?? a.candidate.storyScore ?? 0;
                                const sb = b.candidate.originPriorityScore ?? b.candidate.finalPriorityScore ?? b.candidate.storyScore ?? 0;
                                return sb - sa;
                              }
                            }
                          });
                          // ── Filter ──
                          const filterFn = (r: SessionSourceResult): boolean => {
                            if (r.status === 'error') return true;
                            if (feedFilters.size === 0) return true;
                            const c = r.candidate;
                            if (feedFilters.has('origin')        && c.sourceEra && c.sourceEra !== 'modern source') return true;
                            if (feedFilters.has('reddit')        && c.sourceType === 'reddit') return true;
                            if (feedFilters.has('archive')       && (c.sourceType === 'wayback' || c.isArchived)) return true;
                            if (feedFilters.has('needs-review')  && (c.extractionConfidence !== 'high' || (c.storyScore ?? 0) < 15)) return true;
                            if (feedFilters.has('high-priority') && (c.finalPriorityScore ?? c.storyScore ?? 0) >= 20) return true;
                            if (feedFilters.has('corroboration') && (c.corroborationScore ?? 0) > 0) return true;
                            return false;
                          };
                          const filteredGood = sortedGood.filter(filterFn);

                          return filteredGood.map((result, idx) => {
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

                          // Era group header — only for origin-scan / oldest sort, when era changes
                          const era     = result.candidate.sourceEra ?? 'modern source';
                          const prevEra = (() => {
                            for (let i = idx - 1; i >= 0; i--) {
                              const r = filteredGood[i];
                              if (r.status !== 'error') return r.candidate.sourceEra ?? 'modern source';
                            }
                            return null;
                          })();
                          const showEraHeader = isOriginScan && era !== prevEra;
                          const eraDisplay = ERA_GROUP_DISPLAY[era];

                          const isOriginCard = era !== 'modern source';
                          const originBorderCls = isOriginCard ? {
                            '1990s web':          'border-amber-500/30 bg-amber-500/[0.03]',
                            'bbs archive':        'border-violet-500/28 bg-violet-500/[0.03]',
                            'early 2000s':        'border-orange-500/25 bg-orange-500/[0.025]',
                            'pre-social archive': 'border-sky-500/22 bg-sky-500/[0.025]',
                          }[era] ?? 'border-white/12 bg-white/[0.04]' : '';

                          const isSkipped = st.action === 'skipped';

                          return (
                            <React.Fragment key={result.candidate.sourceUrl}>
                            {showEraHeader && eraDisplay && (
                              <div className={`mt-1 rounded-xl border px-4 py-2.5 ${eraDisplay.cls}`}>
                                <p className="text-[12px] font-bold uppercase tracking-[0.18em] opacity-80">{eraDisplay.label}</p>
                              </div>
                            )}
                            <div
                              className={`overflow-hidden rounded-2xl border transition-all hover:brightness-110 ${isSkipped ? 'opacity-30' : ''} ${
                                isSelected ? 'border-emerald-500/35 bg-emerald-500/[0.04]'
                                : isOriginCard ? originBorderCls
                                : 'border-white/12 bg-white/[0.04]'
                              }`}
                              style={{ animationDelay: `${idx * 55}ms`, animation: 'scanReveal 0.35s ease both' }}
                            >
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
                                  {/* Era badge */}
                                  {result.candidate.sourceEra && ERA_BADGE_MAP[result.candidate.sourceEra] && (
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ERA_BADGE_MAP[result.candidate.sourceEra].cls}`}>
                                      {ERA_BADGE_MAP[result.candidate.sourceEra].label}
                                    </span>
                                  )}
                                  {/* Archive year badge */}
                                  {result.candidate.archiveYear && (
                                    <span className="rounded-full border border-amber-500/28 bg-amber-500/8 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-400/80">
                                      {result.candidate.archiveYear}
                                    </span>
                                  )}
                                  {result.status === 'duplicate' && (
                                    <span className="rounded-full border border-amber-500/25 bg-amber-500/12 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                                      ⚠ duplicate
                                    </span>
                                  )}
                                  {/* Phase Y: compact lineage status in header */}
                                  {result.candidate.originStatus === 'possible-origin' && (
                                    <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300/80">
                                      ◈ origin
                                    </span>
                                  )}
                                  {result.candidate.originStatus === 'earlier-variant' && (
                                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/7 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400/70">
                                      ↯ earlier
                                    </span>
                                  )}
                                  <div className="ml-auto flex items-center gap-1.5">
                                    {/* Score summary — tappable to open details */}
                                    <button
                                      onClick={() => setDetailsOpen((prev) => {
                                        const next = new Map(prev);
                                        next.set(result.candidate.sourceUrl, !prev.get(result.candidate.sourceUrl));
                                        return next;
                                      })}
                                      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 transition-colors hover:text-slate-400"
                                      title="Show / hide analysis details"
                                    >
                                      {result.candidate.storyScore != null ? `${Math.round(result.candidate.storyScore)}` : '—'}
                                      {detailsOpen.get(result.candidate.sourceUrl) ? ' ▲' : ' ▼'}
                                    </button>
                                  </div>
                                </div>
                                {/* Origin artifact line */}
                                {isOriginCard && (
                                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400/55">
                                    ↯ Recovered from early web archive{result.candidate.archiveYear ? ` · ${result.candidate.archiveYear}` : ''}
                                  </p>
                                )}
                                {/* Title */}
                                <p className="mb-1.5 text-[24px] font-bold leading-snug text-white">{result.candidate.title}</p>
                                {/* Why surfaced — prominent */}
                                {analysis.surfacedBecause && (
                                  <p className="mb-2 text-[13px] leading-snug text-emerald-400/65">{analysis.surfacedBecause}</p>
                                )}
                                {/* Collapsible details: signals, cluster, analysis block */}
                                {detailsOpen.get(result.candidate.sourceUrl) && !quickReview && (
                                  <div className="mb-3">
                                    {<StoryTimeline phase="recovered" />}
                                    {((result.candidate.storySignals && result.candidate.storySignals.length > 0) ||
                                      clusterLabel || (result.candidate.corroborationScore ?? 0) > 0 ||
                                      result.candidate.originPriorityScore != null) && (
                                      <div className="mb-3 flex flex-wrap gap-1">
                                        {/* Phase Y: lineage status badges */}
                                        {result.candidate.originStatus === 'possible-origin' && (
                                          <span className="rounded-full border border-amber-500/40 bg-amber-500/12 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                                            ◈ POSSIBLE ORIGIN
                                          </span>
                                        )}
                                        {result.candidate.originStatus === 'earlier-variant' && (
                                          <span className="rounded-full border border-emerald-500/35 bg-emerald-500/8 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                                            ↯ EARLIER VARIANT
                                          </span>
                                        )}
                                        {result.candidate.originStatus === 'mirror' && (
                                          <span className="rounded-full border border-sky-500/30 bg-sky-500/8 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-sky-300">
                                            ⬡ MIRROR SIGNAL
                                          </span>
                                        )}
                                        {result.candidate.originStatus === 'related-signal' && (
                                          <span className="rounded-full border border-violet-500/30 bg-violet-500/8 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-300">
                                            ⟳ RELATED SIGNAL
                                          </span>
                                        )}
                                        {result.candidate.originPriorityScore != null && result.candidate.originPriorityScore > (result.candidate.storyScore ?? 0) && (
                                          <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                                            ◈ ORIGIN SIGNAL
                                          </span>
                                        )}
                                        {result.candidate.sourceEra && result.candidate.sourceEra !== 'modern source' && (
                                          <span className="rounded-full border border-amber-500/22 bg-amber-500/6 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-400/70">
                                            EARLY WEB
                                          </span>
                                        )}
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
                                        {result.candidate.originPriorityScore != null && (
                                          <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-300/80">
                                            O{result.candidate.originPriorityScore}
                                          </span>
                                        )}
                                        {result.candidate.finalPriorityScore != null && result.candidate.finalPriorityScore !== result.candidate.storyScore && (
                                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-400/80">
                                            P{result.candidate.finalPriorityScore}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    <SignalAnalysisBlock analysis={analysis} />
                                    {/* Phase Y: Origin trail — shown inside details */}
                                    <OriginTrailPanel candidate={result.candidate} />
                                  </div>
                                )}
                                <div className="mb-3 rounded-xl border-l-2 border-emerald-500/25 bg-white/[0.025] px-4 py-3">
                                  <p className={`text-[18px] leading-relaxed text-slate-300 ${quickReview ? 'line-clamp-2' : 'line-clamp-5'}`}>{result.candidate.summary}</p>
                                </div>
                                {/* ── Original Source Preview — collapsible (Phase T, TASK 1) ── */}
                                {!quickReview && (
                                  <div className="mb-3">
                                    <button
                                      onClick={() => setPreviewOpen((prev) => {
                                        const next = new Map(prev);
                                        next.set(result.candidate.sourceUrl, !prev.get(result.candidate.sourceUrl));
                                        return next;
                                      })}
                                      className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors"
                                    >
                                      {previewOpen.get(result.candidate.sourceUrl) ? '▲ hide source preview' : '▼ show source preview'}
                                    </button>
                                    {previewOpen.get(result.candidate.sourceUrl) && (
                                      <SourcePreviewCard candidate={result.candidate} sourceName={result.sourceName} />
                                    )}
                                  </div>
                                )}

                                {!quickReview && relatedResults.length > 0 && (
                                  <div className="mb-3">
                                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-600">Related signals · cluster: {clusterLabel}</p>
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
                                              <p className="text-[14px] font-semibold leading-snug text-slate-400 line-clamp-1">{rel.candidate.title}</p>
                                              <p className="text-[12px] text-slate-600">{rel.sourceName}</p>
                                            </div>
                                            {rel.candidate.storyScore != null && (
                                              <span className="ml-auto shrink-0 text-[12px] tabular-nums text-slate-700">{rel.candidate.storyScore}pts</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {result.candidate.extractionConfidence !== 'high' && st.action === 'idle' && (
                                  <div className={`mb-3 rounded-lg px-3 py-2 text-[14px] ${
                                    result.candidate.extractionConfidence === 'low' ? 'bg-red-500/8 text-red-400/65' : 'bg-amber-500/8 text-amber-400/65'
                                  }`}>
                                    {result.candidate.extractionConfidence} extraction confidence{result.candidate.extractionConfidence === 'low' && ' — edit before queueing'}
                                  </div>
                                )}

                                {/* ── Phase N: action area ── */}
                                {st.action === 'idle' && (
                                  editOpenUrl === result.candidate.sourceUrl ? (
                                    <InlineScanEdit
                                      candidate={result.candidate}
                                      onPost={(form) => handleApproveAndPost(result, form)}
                                      onCancel={() => setEditOpenUrl(null)}
                                    />
                                  ) : (
                                    <div className="mt-2">
                                      <p className="mb-2.5 text-[14px] leading-snug text-slate-500">
                                        Approve to post instantly. Edit to refine first.
                                      </p>
                                      <div className="flex flex-col gap-2">
                                        <button
                                          onClick={() => handleApproveAndPost(result)}
                                          className="flex w-full min-h-[56px] items-center justify-center rounded-xl bg-emerald-500 text-[18px] font-bold text-black transition-colors hover:bg-emerald-400"
                                        >
                                          Approve + Post to SWIM
                                        </button>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => setEditOpenUrl(result.candidate.sourceUrl)}
                                            className="flex flex-1 min-h-[48px] items-center justify-center rounded-xl border border-sky-500/35 bg-sky-500/8 text-[15px] font-semibold text-sky-300 transition-colors hover:bg-sky-500/14"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleSkip(result.candidate.sourceUrl)}
                                            className="flex flex-1 min-h-[48px] items-center justify-center rounded-xl border border-white/12 bg-white/5 text-[15px] font-semibold text-slate-400 transition-colors hover:bg-white/10"
                                          >
                                            Skip
                                          </button>
                                          <a href={result.candidate.sourceUrl} target="_blank" rel="noopener noreferrer"
                                            className="flex min-h-[48px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[14px] font-semibold text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300">
                                            Source ↗
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                )}
                                {st.action === 'posting' && (
                                  <div className="flex min-h-[56px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[16px] text-slate-400">
                                    <Spinner /> Posting to SWIM…
                                  </div>
                                )}
                                {st.action === 'posted' && (
                                  <div className="overflow-hidden rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.07]">
                                    <div className="border-b border-emerald-500/20 bg-emerald-500/[0.10] px-5 py-3">
                                      <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Live</p>
                                      <p className="text-[26px] font-bold leading-tight text-emerald-300">POSTED TO SWIM</p>
                                    </div>
                                    <div className="p-4">
                                      <button
                                        onClick={() => publishColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                        className="flex w-full min-h-[52px] items-center justify-center rounded-2xl bg-emerald-500 text-[17px] font-bold text-black transition-colors hover:bg-emerald-400"
                                      >
                                        See in Posted Column →
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {st.action === 'queueing' && (
                                  <div className="flex min-h-[56px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[16px] text-slate-400">
                                    <Spinner /> Queueing…
                                  </div>
                                )}
                                {st.action === 'queued' && (
                                  <div className="overflow-hidden rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.07]">
                                    <div className="border-b border-emerald-500/20 bg-emerald-500/[0.10] px-5 py-3">
                                      <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Queued</p>
                                      <p className="text-[26px] font-bold leading-tight text-emerald-300">STORY QUEUED</p>
                                    </div>
                                    <div className="flex flex-col gap-2 p-4">
                                      <button
                                        onClick={() => reviewColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                        className="flex w-full min-h-[56px] items-center justify-center rounded-2xl bg-emerald-500 text-[18px] font-bold text-black transition-colors hover:bg-emerald-400"
                                      >
                                        Review Now →
                                      </button>
                                      <button
                                        onClick={() => setCandStates((prev) => { const next = new Map(prev); next.delete(result.candidate.sourceUrl); return next; })}
                                        className="flex w-full min-h-[52px] items-center justify-center rounded-2xl border border-white/12 bg-white/[0.03] text-[16px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.06]"
                                      >
                                        Keep Scanning
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {st.action === 'skipped' && (
                                  <div className="flex items-center gap-3">
                                    <p className="text-[14px] text-slate-700">skipped</p>
                                    {undoSkipUrl === result.candidate.sourceUrl && (
                                      <button onClick={() => undoSkip(result.candidate.sourceUrl)}
                                        style={{ pointerEvents: 'auto' }}
                                        className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-1 text-[13px] font-bold text-amber-300 hover:bg-amber-500/16">
                                        Undo
                                      </button>
                                    )}
                                  </div>
                                )}
                                {st.action === 'error' && (
                                  <div className="rounded-xl border border-red-500/35 bg-red-500/10 p-4">
                                    <p className="mb-1 text-[16px] font-bold text-red-300">Failed</p>
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
                            </React.Fragment>
                          );
                        });
                        })()}
                      </div>
                    );
                  })()}

                  {/* ── MORE RESULTS — collapsed by default ── */}
                  {(needsReview.length > 0 || lowSignalResults.length > 0 || errorResults.length > 0) && (
                    <div className="rounded-xl border border-white/8 bg-white/[0.02]">
                      <button
                        onClick={() => setShowMoreResults((v) => !v)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                      >
                        <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-600">
                          More
                          {needsReview.length > 0 && ` · ${needsReview.length} needs review`}
                          {lowSignalResults.length > 0 && ` · ${lowSignalResults.length} low signal`}
                          {errorResults.length > 0 && ` · ${errorResults.length} blocked`}
                        </span>
                        <span className="text-[11px] text-slate-700">{showMoreResults ? '▲' : '▼'}</span>
                      </button>
                      {showMoreResults && (
                        <div className="border-t border-white/6 p-3">
                          {/* Mini tab strip */}
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {needsReview.length > 0 && (
                              <button onClick={() => setMoreTab('needs-review')} className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${moreTab === 'needs-review' ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-white/10 bg-white/[0.03] text-slate-500 hover:border-white/20'}`}>
                                Needs Review · {needsReview.length}
                              </button>
                            )}
                            {lowSignalResults.length > 0 && (
                              <button onClick={() => setMoreTab('low-signal')} className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${moreTab === 'low-signal' ? 'border-white/25 bg-white/[0.06] text-slate-300' : 'border-white/10 bg-white/[0.03] text-slate-500 hover:border-white/20'}`}>
                                Low Signal · {lowSignalResults.length}
                              </button>
                            )}
                            {errorResults.length > 0 && (
                              <button onClick={() => setMoreTab('blocked')} className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${moreTab === 'blocked' ? 'border-red-500/35 bg-red-500/10 text-red-300' : 'border-white/10 bg-white/[0.03] text-slate-500 hover:border-white/20'}`}>
                                Blocked · {errorResults.length}
                              </button>
                            )}
                          </div>

                  {/* ── NEEDS REVIEW ── */}
                  {moreTab === 'needs-review' && (
                    visibleReview.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                        <p className="text-[32px] font-bold text-slate-700">—</p>
                        <p className="mt-2 text-[20px] font-bold text-slate-400">Nothing needs manual review</p>
                        <p className="mt-2 text-[14px] text-slate-600">All scored results are either strong or low signal.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="rounded-xl border border-amber-500/18 bg-amber-500/[0.05] px-4 py-3">
                          <p className="text-[17px] font-bold text-amber-300">Needs Review</p>
                          <p className="mt-0.5 text-[13px] text-amber-400/55">Check these manually — may be worth queueing.</p>
                        </div>
                        {visibleReview.map((result) => {
                          if (result.status === 'error') return null;
                          const st = candStates.get(result.candidate.sourceUrl) ?? { action: 'idle' as CandidateAction };
                          return (
                            <div key={result.candidate.sourceUrl} className="overflow-hidden rounded-xl border border-amber-500/14 bg-white/[0.025]">
                              {/* Header */}
                              <div className="flex items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
                                {result.candidate.sourceType && (
                                  <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-bold ${sourceTypeBadgeCls(result.candidate.sourceType)}`}>
                                    {result.candidate.sourceType.toUpperCase()}
                                  </span>
                                )}
                                <span className="text-[14px] text-slate-500">{result.sourceName}</span>
                                {result.candidate.storyScore != null && (
                                  <span className="ml-auto shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[13px] font-bold text-amber-400">{result.candidate.storyScore}pts</span>
                                )}
                              </div>
                              {/* Source preview */}
                              <div className="p-4">
                                <SourcePreviewCard candidate={result.candidate} sourceName={result.sourceName} />
                              </div>
                              {/* Queue decision */}
                              <div className="border-t border-white/8 px-4 py-3">
                                <p className="mb-2.5 text-[14px] leading-snug text-slate-600">
                                  Queue this if the source preview looks like a real story worth reviewing.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    disabled={st.action === 'queueing' || st.action === 'queued'}
                                    onClick={() => handleQueueCandidate(result)}
                                    className="flex flex-1 min-h-[52px] items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10 text-[16px] font-bold text-amber-300 transition-colors disabled:opacity-40 hover:bg-amber-500/18"
                                  >
                                    {st.action === 'queueing' ? 'Queueing…' : st.action === 'queued' ? '✓ Queued' : 'Queue Story'}
                                  </button>
                                  <a href={result.candidate.sourceUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex min-h-[52px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[15px] font-semibold text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300">
                                    Open Source ↗
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* ── LOW SIGNAL ── */}
                  {moreTab === 'low-signal' && (
                    visibleLow.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                        <p className="text-[32px] font-bold text-slate-700">—</p>
                        <p className="mt-2 text-[20px] font-bold text-slate-400">No low-signal results</p>
                        <p className="mt-2 text-[14px] text-slate-600">All fetched results passed quality filters.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
                          <p className="text-[17px] font-bold text-slate-400">Low Signal</p>
                          <p className="mt-0.5 text-[13px] text-slate-600">Weak or index results. Usually safe to skip.</p>
                        </div>
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
                  {moreTab === 'blocked' && (
                    visibleErrors.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                        <p className="text-[32px] font-bold text-emerald-700">✓</p>
                        <p className="mt-2 text-[20px] font-bold text-emerald-400/70">No blocked sources</p>
                        <p className="mt-2 text-[14px] text-slate-600">All sources fetched successfully this scan.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] px-4 py-3">
                          <p className="text-[17px] font-bold text-red-300">Blocked / Failed</p>
                          <p className="mt-0.5 text-[13px] text-red-400/55">Fix source types or use Discover Links for these.</p>
                        </div>
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
                        </div>
                      )}
                    </div>
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

        {/* ══ 2 · LIVE THREADS ══ */}
        <div ref={publishColRef} className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">

          <div className="border-b border-white/8 px-6 py-5">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="text-[22px] font-bold text-white">Live Threads</h2>
              {postedResults.length > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[14px] font-bold text-emerald-300">
                  {postedResults.length}
                </span>
              )}
            </div>
            <p className="text-[14px] text-slate-500">Posted this session. Open thread, copy X or Telegram.</p>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">

            {/* Publish error */}
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

            {/* One-click posted results */}
            {postedResults.map((p, i) => (
              <PostedCard key={`posted-${i}-${p.threadSlug}`} result={p} isNew={p.threadSlug === newPostedSlug} />
            ))}

            {/* Traditional ReadyCard publish success */}
            {lastPublished && (
              <div className="overflow-hidden rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.07]">
                <div className="border-b border-emerald-500/20 bg-emerald-500/[0.10] px-6 py-5">
                  <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Published</p>
                  <p className="text-[30px] font-bold leading-tight text-emerald-300">LIVE THREAD CREATED</p>
                </div>
                <div className="flex flex-col gap-3 p-5">
                  <p className="text-[20px] font-bold leading-snug text-white">{lastPublished.title}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[13px] font-semibold text-emerald-300">{lastPublished.category}</span>
                    {lastPublished.sourceName && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] text-slate-400">{lastPublished.sourceName}</span>
                    )}
                  </div>
                  {lastPublished.threadSlug ? (
                    <a href={`/threads/${lastPublished.threadSlug}`} target="_blank" rel="noopener noreferrer"
                      className="flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-[18px] font-bold text-black transition-colors hover:bg-emerald-400">
                      Open Thread ↗
                    </a>
                  ) : (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-[14px] text-amber-300">
                      Thread created — check /threads for the new post.
                    </div>
                  )}
                  <div>
                    <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-slate-500">X Post</p>
                    <div className="mb-2 overflow-hidden rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                      <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-slate-300 line-clamp-4">{lastPublished.xText}</pre>
                    </div>
                    <button onClick={() => handleCopy(lastPublished.xText, 'x')}
                      className={`flex w-full min-h-[52px] items-center justify-center rounded-2xl border text-[16px] font-semibold transition-all ${
                        copied === 'x' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-white/12 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                      }`}>
                      {copied === 'x' ? '✓ Copied' : 'Copy X Post'}
                    </button>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-slate-500">Telegram Post</p>
                    <div className="mb-2 overflow-hidden rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                      <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-slate-300 line-clamp-5">{lastPublished.telegramText}</pre>
                    </div>
                    <button onClick={() => handleCopy(lastPublished.telegramText, 'tg')}
                      className={`flex w-full min-h-[52px] items-center justify-center rounded-2xl border text-[16px] font-semibold transition-all ${
                        copied === 'tg' ? 'border-sky-500/40 bg-sky-500/15 text-sky-300' : 'border-white/12 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                      }`}>
                      {copied === 'tg' ? '✓ Copied' : 'Copy Telegram Post'}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setLastPublished(null);
                      setCopied(null);
                      scanColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="flex w-full min-h-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-[16px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-200"
                  >
                    Continue Scanning
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {postedResults.length === 0 && readySignals.length === 0 && !lastPublished && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-[20px] font-bold text-slate-600">—</p>
                <p className="mt-2 text-[18px] font-semibold text-slate-500">No live threads yet</p>
                <p className="mt-2 text-[14px] text-slate-600">
                  Approve a scan result to post a thread instantly.
                </p>
              </div>
            )}

            {/* Ready signals — approved via traditional review flow, need editing */}
            {readySignals.length > 0 && (
              <div>
                <p className="mb-3 text-[12px] font-bold uppercase tracking-widest text-slate-600">
                  Approved — Edit &amp; Publish
                </p>
                <div className="flex flex-col gap-4">
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
            )}

            {/* Collapsible review queue */}
            {reviewSignals.length > 0 && (
              <div className="rounded-xl border border-white/8 bg-white/[0.02]">
                <button
                  onClick={() => setShowReviewQueue((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-600">
                    Queue · {reviewSignals.length}
                  </span>
                  <span className="text-[11px] text-slate-700">{showReviewQueue ? '▲' : '▼'}</span>
                </button>
                {showReviewQueue && (
                  <div className="border-t border-white/6 p-3">
                    {reviewError && (
                      <div className="mb-3 rounded-xl border border-red-500/35 bg-red-500/10 p-3">
                        <p className="text-[14px] font-bold text-red-300">Action Failed</p>
                        <p className="text-[13px] text-red-200">{reviewError}</p>
                        <button onClick={() => setReviewError(null)} className="mt-2 text-[12px] text-red-400/60 underline-offset-2 hover:underline">Dismiss</button>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      {reviewSignals.map((sig) => {
                        const isChanging = statusChanging === sig.id;
                        return (
                          <div key={sig.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                            <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${sourceTypeBadgeCls(sig.source_type)}`}>{sig.source_type.toUpperCase()}</span>
                              <span className="text-[13px] text-slate-500 truncate">{sig.source_name}</span>
                              <span className="ml-auto shrink-0 text-[11px] text-slate-600">{sig.category}</span>
                            </div>
                            <div className="px-4 py-3">
                              <p className="mb-1.5 text-[16px] font-bold leading-snug text-white">{sig.title}</p>
                              <p className="text-[13px] leading-relaxed text-slate-400 line-clamp-3">{sig.summary}</p>
                            </div>
                            <div className="flex gap-2 border-t border-white/8 p-3">
                              <button onClick={() => handleStatusChange(sig.id, 'rebirth-ready')} disabled={isChanging}
                                className="flex flex-1 min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 text-[15px] font-bold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50">
                                {isChanging ? <Spinner /> : 'Approve'}
                              </button>
                              <button onClick={() => handleStatusChange(sig.id, 'rejected')} disabled={isChanging}
                                className="flex flex-1 min-h-[44px] items-center justify-center rounded-xl border border-red-500/30 bg-red-500/8 text-[14px] font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-40">
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
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

  const inputCls = 'w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3.5 text-[16px] leading-normal text-white placeholder:text-slate-600 focus:border-white/28 focus:outline-none transition-colors';

  return (
    <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03]">

      {/* Collapsed summary */}
      <div className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-white/6 px-2.5 py-0.5 text-[12px] text-slate-500">{signal.category}</span>
          <span className="text-[13px] text-slate-600">{signal.source_name}</span>
        </div>
        <p className="mb-4 text-[19px] font-bold leading-snug text-white">{signal.title}</p>
        <button
          onClick={onToggle}
          className="flex w-full min-h-[56px] items-center justify-center rounded-2xl border border-purple-500/40 bg-purple-500/12 text-[18px] font-bold text-purple-200 transition-colors hover:bg-purple-500/22"
        >
          {isOpen ? 'Close Editor' : 'Open Publish Editor'}
        </button>
      </div>

      {/* Thread composer — TASK 4 */}
      {isOpen && (
        <div className="border-t border-white/8 p-5">
          <div className="flex flex-col gap-5">

            <div>
              <label className="mb-2 block text-[15px] font-semibold text-slate-300">Public Thread Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className="mb-2 block text-[15px] font-semibold text-slate-300">Public Thread Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className={`${inputCls} resize-y`}
              />
            </div>

            <div>
              <label className="mb-2 block text-[15px] font-semibold text-slate-300">Category</label>
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
              <label className="mb-2 block text-[15px] font-semibold text-slate-300">
                Tags <span className="font-normal text-slate-600">comma separated</span>
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className={inputCls}
              />
            </div>

            {/* Phase Y TASK 6: Internet origin context — shown for archaeological sources */}
            {['wayback', 'bbs', 'archive', 'mediawiki'].includes(signal.source_type) && (
              <div className="rounded-xl border border-amber-500/18 bg-amber-500/[0.04] px-4 py-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-500/60">Internet Origin Context</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-2">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-700">Source Type</p>
                    <p className="text-[13px] font-bold uppercase text-amber-400/80">{signal.source_type}</p>
                  </div>
                  {signal.attribution_text && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-700">Recovered From</p>
                      <p className="text-[12px] text-slate-400">{signal.attribution_text}</p>
                    </div>
                  )}
                </div>
                {signal.source_capture_notes && (
                  <p className="text-[12px] leading-relaxed text-slate-600">{signal.source_capture_notes}</p>
                )}
                <p className="mt-2 text-[9px] text-slate-700">
                  Internet mythology archaeology · archived claim · not a verified fact
                </p>
              </div>
            )}

            {/* Evidence / source attribution — read-only */}
            {(signal.attribution_text || signal.source_url) && !['wayback', 'bbs', 'archive', 'mediawiki'].includes(signal.source_type) && (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                <p className="mb-1.5 text-[12px] font-bold uppercase tracking-widest text-slate-600">Source Attribution</p>
                {signal.attribution_text && (
                  <p className="text-[15px] text-slate-400">{signal.attribution_text}</p>
                )}
                {signal.source_url && (
                  <a href={signal.source_url} target="_blank" rel="noopener noreferrer"
                    className="mt-1 block truncate text-[13px] text-slate-600 transition-colors hover:text-slate-400">
                    {signal.source_url} ↗
                  </a>
                )}
              </div>
            )}

            {/* Live public preview */}
            <div>
              <p className="mb-2 text-[14px] font-semibold text-slate-400">
                This is what the public thread will look like:
              </p>
              <div className="rounded-xl border border-white/8 bg-black/25 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-sm bg-emerald-500/18 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">RECOVERED</span>
                  <span className="rounded-sm bg-white/6 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{category}</span>
                </div>
                <p className="mb-1.5 text-[16px] font-bold leading-snug text-white">{title || 'Untitled Thread'}</p>
                <p className="mb-2.5 text-[14px] leading-relaxed text-slate-400 line-clamp-3">{body || 'No body text yet.'}</p>
                {tags.trim() && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-500">#{tag}</span>
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
              className="flex w-full min-h-[60px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-[20px] font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPublishing ? <><Spinner /> Publishing…</> : 'Publish to SWIM'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
