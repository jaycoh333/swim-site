'use client';

import { useState, useEffect } from 'react';
import type { TerminalEntry } from '@/lib/terminal-feed';

// ---------------------------------------------------------------------------
// Entry-type → color scheme
// ---------------------------------------------------------------------------

const TYPE_STYLE: Record<string, {
  text: string; bg: string; border: string; glow: string;
  badgeBg: string; badgeBorder: string;
}> = {
  'SIGNAL RECOVERED':  {
    text: '#86d46e',
    bg: 'rgba(134,212,110,0.042)',  border: 'rgba(134,212,110,0.20)', glow: 'rgba(134,212,110,0.10)',
    badgeBg: 'rgba(134,212,110,0.10)', badgeBorder: 'rgba(134,212,110,0.28)',
  },
  'THREAD REBORN':     {
    text: '#d7a85c',
    bg: 'rgba(215,168,92,0.060)',   border: 'rgba(215,168,92,0.26)',  glow: 'rgba(215,168,92,0.12)',
    badgeBg: 'rgba(215,168,92,0.12)',  badgeBorder: 'rgba(215,168,92,0.30)',
  },
  'SOURCE DISCOVERED': {
    text: '#6da8ff',
    bg: 'rgba(109,168,255,0.042)', border: 'rgba(109,168,255,0.20)', glow: 'rgba(109,168,255,0.10)',
    badgeBg: 'rgba(109,168,255,0.10)', badgeBorder: 'rgba(109,168,255,0.26)',
  },
  'READY FOR REBIRTH': {
    text: '#d7a85c',
    bg: 'rgba(215,168,92,0.050)',   border: 'rgba(215,168,92,0.22)',  glow: 'rgba(215,168,92,0.10)',
    badgeBg: 'rgba(215,168,92,0.10)',  badgeBorder: 'rgba(215,168,92,0.26)',
  },
  'PUBLIC SUBMISSION': {
    text: '#6da8ff',
    bg: 'rgba(109,168,255,0.038)', border: 'rgba(109,168,255,0.16)', glow: 'rgba(109,168,255,0.08)',
    badgeBg: 'rgba(109,168,255,0.08)', badgeBorder: 'rgba(109,168,255,0.22)',
  },
  'SIGNAL ARCHIVED':   {
    text: 'rgba(134,212,110,0.38)',
    bg: 'rgba(134,212,110,0.016)',  border: 'rgba(134,212,110,0.07)', glow: 'transparent',
    badgeBg: 'rgba(134,212,110,0.05)', badgeBorder: 'rgba(134,212,110,0.12)',
  },
};

// ---------------------------------------------------------------------------
// Scan phrases — primary rotating status line
// ---------------------------------------------------------------------------

const SCAN_PHRASES = [
  'scanning forgotten forums…',
  'parsing archived fragments…',
  'checking signal anomalies…',
  'ranking recovered stories…',
  'waiting for curator approval…',
  'indexing lost internet edges…',
  'detecting orphaned threads…',
];

// Secondary "currently analyzing" phrases — rotates faster
const ANALYZING_PHRASES = [
  'analyzing r/HighStrangeness…',
  'scoring anomaly vectors…',
  'checking corroboration…',
  'querying Wayback CDX…',
  'filtering duplicate signals…',
  'extracting narrative fragments…',
  'probing archived domains…',
  'running quality heuristics…',
  'analyzing r/Glitch_in_the_Matrix…',
  'cross-referencing source data…',
];

function formatRel(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d < 1)   return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30)  return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ---------------------------------------------------------------------------
// Status modules — 4 animated scan state tiles
// ---------------------------------------------------------------------------

interface StatusModule {
  label:   string;
  value:   string;
  barDuration: string;  // CSS animation-duration for the progress bar
  accent:  string;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface SwimAiTerminalStats {
  recoveredToday:   number;
  sourcesMonitored: number;
  threadsReborn:    number;
  pendingReview:    number;
}

export interface SwimAiTerminalProps {
  entries:    TerminalEntry[];
  stats?:     SwimAiTerminalStats;
  compact?:   boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SwimAiTerminal({
  entries,
  stats,
  compact    = false,
  className  = '',
}: SwimAiTerminalProps) {
  const PAGE = compact ? 4 : 5;

  const [page,           setPage]           = useState(0);
  const [cursor,         setCursor]         = useState(true);
  const [paused,         setPaused]         = useState(false);
  const [phraseIdx,      setPhraseIdx]      = useState(0);
  const [phraseFading,   setPhraseFading]   = useState(false);
  const [analyzeIdx,     setAnalyzeIdx]     = useState(0);
  const [analyzeFading,  setAnalyzeFading]  = useState(false);

  // Blinking cursor
  useEffect(() => {
    const id = setInterval(() => setCursor((v) => !v), 650);
    return () => clearInterval(id);
  }, []);

  // Auto-advance pages
  const maxPage = Math.max(0, entries.length - PAGE);
  useEffect(() => {
    if (paused || entries.length <= PAGE) return;
    const id = setInterval(() => setPage((p) => (p >= maxPage ? 0 : p + 1)), 3800);
    return () => clearInterval(id);
  }, [paused, entries.length, PAGE, maxPage]);

  // Cycle primary scan phrase
  useEffect(() => {
    const id = setInterval(() => {
      setPhraseFading(true);
      setTimeout(() => {
        setPhraseIdx((i) => (i + 1) % SCAN_PHRASES.length);
        setPhraseFading(false);
      }, 380);
    }, 3600);
    return () => clearInterval(id);
  }, []);

  // Cycle "analyzing" phrase — faster
  useEffect(() => {
    const id = setInterval(() => {
      setAnalyzeFading(true);
      setTimeout(() => {
        setAnalyzeIdx((i) => (i + 1) % ANALYZING_PHRASES.length);
        setAnalyzeFading(false);
      }, 300);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const visible    = entries.slice(page, page + PAGE);
  const pageCount  = Math.min(Math.ceil(entries.length / PAGE), 8);
  const activePage = Math.floor(page / PAGE);

  // Build status modules from stats or use atmospheric defaults
  const statusModules: StatusModule[] = [
    {
      label:       'SOURCE SWEEP',
      value:       `${stats?.sourcesMonitored ?? 8} active`,
      barDuration: '7s',
      accent:      'rgba(134,212,110,0.55)',
    },
    {
      label:       'ANOMALY CHECK',
      value:       'RUNNING',
      barDuration: '11.4s',
      accent:      'rgba(134,212,110,0.42)',
    },
    {
      label:       'DUP. FILTER',
      value:       'ACTIVE',
      barDuration: '5.2s',
      accent:      'rgba(109,168,255,0.50)',
    },
    {
      label:       'REVIEW QUEUE',
      value:       stats?.pendingReview != null ? `${stats.pendingReview} pending` : 'LIVE',
      barDuration: '14s',
      accent:      stats?.pendingReview ? 'rgba(215,168,92,0.65)' : 'rgba(134,212,110,0.35)',
    },
  ];

  return (
    <div
      className={`swim-ai-terminal relative overflow-hidden rounded-2xl font-mono ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Ambient overlays (behind all content) ── */}
      <div className="terminal-scan-sweep pointer-events-none absolute inset-x-0 top-0" aria-hidden="true" />
      <div className="terminal-grid-overlay pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* ── All content — sits above overlays via DOM order ── */}
      <div className="relative">

        {/* ── Header ── */}
        <div
          className="border-b border-crt/12 px-5 pb-3.5 pt-4"
          style={{ background: 'rgba(134,212,110,0.022)' }}
        >
          {/* Title row */}
          <div className="mb-2.5 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* Radar pulse ring */}
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                <span className="terminal-radar-ring absolute inset-0 rounded-full border border-crt/30" />
                <span className="h-1.5 w-1.5 rounded-full bg-crt/70" />
              </span>
              <span className="terminal-title-main text-[13px] font-bold uppercase tracking-[0.24em] text-crt/88">
                SWIM AI // SIGNAL SCANNER
              </span>
            </div>
            {/* Live / paused indicator */}
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              {paused ? (
                <span className="text-[9px] uppercase tracking-[0.22em] text-crt/28">PAUSED</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="terminal-live-dot h-[6px] w-[6px] rounded-full" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-crt/55">LIVE</span>
                </div>
              )}
              <span
                className="text-[14px] text-crt/50 transition-opacity duration-100"
                aria-hidden="true"
                style={{ opacity: cursor ? 1 : 0 }}
              >
                ▋
              </span>
            </div>
          </div>

          {/* System metadata row */}
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {[
              { label: 'status', value: 'LIVE',              color: '#86d46e' },
              { label: 'mode',   value: 'deep web recovery', color: 'rgba(134,212,110,0.52)' },
              { label: 'review', value: 'human-gated',       color: 'rgba(109,168,255,0.62)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.20em] text-crt/25">{label}:</span>
                <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Status modules row ── */}
        <div
          className="grid grid-cols-2 gap-px border-b border-crt/[0.07] sm:grid-cols-4"
          style={{ background: 'rgba(134,212,110,0.006)' }}
        >
          {statusModules.map((mod) => (
            <div
              key={mod.label}
              className="relative overflow-hidden px-3 py-2.5"
              style={{ borderRight: '1px solid rgba(134,212,110,0.06)' }}
            >
              <div className="mb-1 text-[9px] uppercase tracking-[0.22em] text-crt/22">
                {mod.label}
              </div>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.10em]"
                style={{ color: mod.accent }}
              >
                {mod.value}
              </div>
              {/* Animated progress bar */}
              <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full" style={{ background: 'rgba(134,212,110,0.06)' }}>
                <div
                  className="terminal-status-bar h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${mod.accent}, transparent)`,
                    animationDuration: mod.barDuration,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ── Active scan lines ── */}
        <div
          className="border-b border-crt/[0.06] px-5 py-2"
          style={{ background: 'rgba(134,212,110,0.014)' }}
        >
          {/* Primary scan phrase */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] text-crt/22 select-none" aria-hidden="true">▶</span>
            <span
              className="text-[11px] tracking-[0.06em]"
              style={{
                color:      'rgba(134,212,110,0.45)',
                opacity:    phraseFading ? 0 : 1,
                transition: 'opacity 0.38s ease',
              }}
            >
              {SCAN_PHRASES[phraseIdx]}
            </span>
            <span
              className="text-[11px] text-crt/28 transition-opacity duration-100"
              style={{ opacity: cursor ? 1 : 0 }}
              aria-hidden="true"
            >
              _
            </span>
          </div>
          {/* Secondary "currently analyzing" phrase */}
          <div className="mt-0.5 flex items-center gap-2">
            <span className="shrink-0 text-[10px] text-crt/12 select-none" aria-hidden="true">◈</span>
            <span
              className="text-[10px] tracking-[0.04em]"
              style={{
                color:      'rgba(134,212,110,0.28)',
                opacity:    analyzeFading ? 0 : 1,
                transition: 'opacity 0.3s ease',
              }}
            >
              {ANALYZING_PHRASES[analyzeIdx]}
            </span>
          </div>
        </div>

        {/* ── Feed ── */}
        <div style={{ minHeight: compact ? 220 : 380 }}>
          {entries.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <span className="text-[14px] tracking-[0.06em] text-crt/22">
                awaiting signal data_
              </span>
            </div>
          ) : (
            visible.map((entry) => {
              const style       = TYPE_STYLE[entry.type] ?? TYPE_STYLE['SIGNAL RECOVERED'];
              const isHighlight = entry.severity === 'highlight';
              const isWarning   = entry.severity === 'warning';
              return (
                <div
                  key={entry.id}
                  className="border-b border-crt/[0.055] px-4 py-4 transition-all duration-300 sm:px-5 sm:py-5"
                  style={{
                    borderLeft: `3px solid ${style.border}`,
                    background: style.bg,
                    boxShadow:  isHighlight || isWarning
                      ? `inset 0 0 20px ${style.glow}`
                      : 'none',
                  }}
                >
                  {/* Badge row: type + category + timestamp */}
                  <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span
                      className="rounded-sm px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.12em]"
                      style={{
                        color:      style.text,
                        background: style.badgeBg,
                        border:     `1px solid ${style.badgeBorder}`,
                      }}
                    >
                      {entry.type}
                    </span>
                    <span
                      className="rounded-sm border px-1.5 py-[3px] text-[10px] uppercase tracking-[0.10em]"
                      style={{ color: 'rgba(134,212,110,0.40)', borderColor: 'rgba(134,212,110,0.10)' }}
                    >
                      {entry.category}
                    </span>
                    <span
                      className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-crt/22"
                      suppressHydrationWarning
                    >
                      {formatRel(entry.timestamp)}
                    </span>
                  </div>

                  {/* Title — slightly larger on mobile */}
                  {entry.url ? (
                    <a
                      href={entry.url}
                      className="mb-2 block text-[18px] font-bold leading-snug tracking-[0.01em] text-crt/88 transition-colors hover:text-crt sm:text-[19px]"
                      style={{ textShadow: isHighlight ? `0 0 14px ${style.glow}` : 'none' }}
                    >
                      {entry.title}
                    </a>
                  ) : (
                    <p
                      className="mb-2 text-[18px] font-bold leading-snug tracking-[0.01em] text-crt/88 sm:text-[19px]"
                      style={{ textShadow: isHighlight ? `0 0 14px ${style.glow}` : 'none' }}
                    >
                      {entry.title}
                    </p>
                  )}

                  {/* Source */}
                  <p className="text-[12px] tracking-[0.05em] text-crt/30">
                    ↳ {entry.source}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* ── Pagination dots ── */}
        {pageCount > 1 && (
          <div
            className="flex items-center justify-center gap-2 border-t border-crt/[0.07] py-2.5"
            style={{ background: 'rgba(0,0,0,0.30)' }}
          >
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i * PAGE)}
                aria-label={`Page ${i + 1}`}
                className={`h-[3px] rounded-full transition-all ${
                  i === activePage ? 'w-6 bg-crt/48' : 'w-2 bg-crt/12 hover:bg-crt/25'
                }`}
              />
            ))}
          </div>
        )}

        {/* ── Telemetry bar ── */}
        {stats && (
          <div
            className="border-t border-crt/12 px-5 pb-6 pt-4"
            style={{ background: 'rgba(134,212,110,0.014)' }}
          >
            <div className="mb-3 text-[9px] uppercase tracking-[0.36em] text-crt/20">
              ◈ SYSTEM TELEMETRY
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
              {[
                { label: 'SIGNALS RECOVERED', value: stats.recoveredToday,   accent: '#86d46e' },
                { label: 'PENDING REVIEW',    value: stats.pendingReview,    accent: '#d7a85c' },
                { label: 'THREADS REBORN',    value: stats.threadsReborn,    accent: '#d7a85c' },
                { label: 'SOURCES MONITORED', value: stats.sourcesMonitored, accent: '#6da8ff' },
              ].map(({ label, value, accent }) => (
                <div key={label}>
                  <div
                    className="font-mono text-[30px] font-bold leading-none tabular-nums md:text-[34px]"
                    style={{ color: accent, textShadow: `0 0 12px ${accent}44` }}
                  >
                    {value}
                  </div>
                  <div className="mt-1.5 text-[9px] uppercase tracking-[0.20em] text-crt/28">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>{/* /relative content wrapper */}
    </div>
  );
}
