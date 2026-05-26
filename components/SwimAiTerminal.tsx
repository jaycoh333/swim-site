'use client';

import { useState, useEffect } from 'react';
import type { TerminalEntry } from '@/lib/terminal-feed';

// ---------------------------------------------------------------------------
// Entry-type → color scheme
// ---------------------------------------------------------------------------

const TYPE_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  'SIGNAL RECOVERED':  { text: '#86d46e', bg: 'rgba(134,212,110,0.055)', border: 'rgba(134,212,110,0.18)' },
  'THREAD REBORN':     { text: '#d7a85c', bg: 'rgba(215,168,92,0.065)',  border: 'rgba(215,168,92,0.22)'  },
  'SOURCE DISCOVERED': { text: '#6da8ff', bg: 'rgba(109,168,255,0.055)', border: 'rgba(109,168,255,0.18)' },
  'READY FOR REBIRTH': { text: '#d7a85c', bg: 'rgba(215,168,92,0.055)',  border: 'rgba(215,168,92,0.18)'  },
  'PUBLIC SUBMISSION': { text: '#6da8ff', bg: 'rgba(109,168,255,0.045)', border: 'rgba(109,168,255,0.15)' },
  'SIGNAL ARCHIVED':   { text: 'rgba(134,212,110,0.38)', bg: 'rgba(134,212,110,0.02)', border: 'rgba(134,212,110,0.08)' },
};

function formatRel(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d < 1)   return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30)  return `${d} days ago`;
  return `${Math.floor(d / 30)}mo ago`;
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
  entries:   TerminalEntry[];
  stats?:    SwimAiTerminalStats;
  compact?:  boolean;
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
  const PAGE = compact ? 4 : 6;

  const [page,   setPage]   = useState(0);
  const [cursor, setCursor] = useState(true);
  const [paused, setPaused] = useState(false);

  // Blinking cursor
  useEffect(() => {
    const id = setInterval(() => setCursor((v) => !v), 650);
    return () => clearInterval(id);
  }, []);

  // Auto-advance
  const maxPage = Math.max(0, entries.length - PAGE);
  useEffect(() => {
    if (paused || entries.length <= PAGE) return;
    const id = setInterval(() => setPage((p) => (p >= maxPage ? 0 : p + 1)), 3800);
    return () => clearInterval(id);
  }, [paused, entries.length, PAGE, maxPage]);

  const visible     = entries.slice(page, page + PAGE);
  const pageCount   = Math.min(Math.ceil(entries.length / PAGE), 8);
  const activePage  = Math.floor(page / PAGE);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-crt/10 font-mono ${className}`}
      style={{ background: 'rgba(0,0,0,0.52)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Header bar ── */}
      <div
        className="flex items-center justify-between border-b border-crt/10 px-4 py-2.5"
        style={{ background: 'rgba(134,212,110,0.025)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="h-[7px] w-[7px] animate-pulse-glow bg-crt/55" aria-hidden="true" />
          <span className="text-[11px] uppercase tracking-[0.28em] text-crt/52">
            SWIM AI · SIGNAL MONITOR
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[13px] text-crt/60 transition-opacity duration-100"
            aria-hidden="true"
            style={{ opacity: cursor ? 1 : 0 }}
          >
            ▋
          </span>
          <span className="text-[9px] uppercase tracking-[0.22em] text-crt/25">
            {paused ? 'PAUSED' : 'LIVE'}
          </span>
        </div>
      </div>

      {/* ── Feed ── */}
      <div style={{ minHeight: compact ? 220 : 340 }}>
        {entries.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-[14px] tracking-[0.06em] text-crt/22">
              awaiting signal data_
            </span>
          </div>
        ) : (
          visible.map((entry) => {
            const style = TYPE_STYLE[entry.type] ?? TYPE_STYLE['SIGNAL RECOVERED'];
            return (
              <div
                key={entry.id}
                className="border-b border-crt/[0.05] px-4 py-3 transition-colors duration-300"
                style={{ borderLeft: `2px solid ${style.border}`, background: style.bg }}
              >
                {/* Type + category + timestamp */}
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                  <span
                    className="text-[12px] font-bold uppercase tracking-[0.10em]"
                    style={{ color: style.text }}
                  >
                    [ {entry.type} ]
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.08em] text-crt/38">
                    {entry.category}
                  </span>
                  <span
                    className="ml-auto shrink-0 text-[11px] tabular-nums text-crt/25"
                    suppressHydrationWarning
                  >
                    {formatRel(entry.timestamp)}
                  </span>
                </div>

                {/* Title */}
                {entry.url ? (
                  <a
                    href={entry.url}
                    className="mt-0.5 block text-[16px] leading-snug tracking-[0.01em] text-crt/82 transition-colors hover:text-crt"
                  >
                    {entry.title}
                  </a>
                ) : (
                  <p className="mt-0.5 text-[16px] leading-snug tracking-[0.01em] text-crt/82">
                    {entry.title}
                  </p>
                )}

                {/* Source */}
                <p className="mt-0.5 text-[12px] tracking-[0.04em] text-crt/30">
                  {entry.source}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* ── Scroll indicator ── */}
      {pageCount > 1 && (
        <div
          className="flex items-center justify-center gap-1.5 border-t border-crt/8 py-1.5"
          style={{ background: 'rgba(0,0,0,0.28)' }}
        >
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i * PAGE)}
              aria-label={`Page ${i + 1}`}
              className={`h-1 rounded-full transition-all ${
                i === activePage ? 'w-5 bg-crt/45' : 'w-1.5 bg-crt/12 hover:bg-crt/25'
              }`}
            />
          ))}
        </div>
      )}

      {/* ── Status bar ── */}
      {stats && (
        <div
          className="border-t border-crt/10 px-4 py-3"
          style={{ background: 'rgba(134,212,110,0.018)' }}
        >
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.32em] text-crt/22">
            LIVE STATUS
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 sm:grid-cols-4">
            {[
              { label: 'RECOVERED', value: stats.recoveredToday   },
              { label: 'SOURCES',   value: stats.sourcesMonitored },
              { label: 'REBORN',    value: stats.threadsReborn    },
              { label: 'PENDING',   value: stats.pendingReview    },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <span className="text-[20px] font-bold tabular-nums text-crt/78">{value}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-crt/28">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
