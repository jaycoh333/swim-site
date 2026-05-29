'use client';

import { useEffect, useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Public data type — populated from TerminalEntry or SignalEntry
// ---------------------------------------------------------------------------

export interface ArchiveModalData {
  type?:          string;    // 'SIGNAL RECOVERED' | 'THREAD REBORN' etc.
  title:          string;
  excerpt?:       string;    // summary / body text
  source:         string;    // source name
  sourceType?:    string;    // 'reddit' | 'wayback' | 'bbs' etc.
  category:       string;
  categoryColor?: string;
  timestamp?:     string;    // ISO date
  threadUrl?:     string;    // /threads/<slug>  → Open Thread button
  sourceUrl?:     string;    // external URL     → View Source button
  isReborn?:      boolean;
  tags?:          string[];
  severity?:      string;
}

interface Props {
  data:    ArchiveModalData | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  'SIGNAL RECOVERED':  '#86d46e',
  'THREAD REBORN':     '#d7a85c',
  'SOURCE DISCOVERED': '#6da8ff',
  'READY FOR REBIRTH': '#d7a85c',
  'PUBLIC SUBMISSION': '#6da8ff',
  'SIGNAL ARCHIVED':   'rgba(134,212,110,0.4)',
};

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso.slice(0, 10); }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArchiveTerminalModal({ data, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!data) return;
    document.addEventListener('keydown', handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prev;
    };
  }, [data, handleKey]);

  if (!mounted || !data) return null;

  const typeColor = data.type ? (TYPE_COLORS[data.type] ?? '#86d46e') : '#86d46e';
  const catColor  = data.categoryColor ?? '#86d46e';

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Archive terminal viewer"
    >
      {/* Backdrop — stronger blur + darker overlay */}
      <div
        className="absolute inset-0 bg-black/88"
        style={{ backdropFilter: 'blur(6px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Terminal window */}
      <div
        className="relative z-10 flex w-full max-h-[92vh] flex-col overflow-hidden rounded-xl sm:max-w-2xl lg:max-w-3xl"
        style={{
          background: 'rgba(2, 6, 3, 0.99)',
          border:     '2px solid rgba(134,212,110,0.38)',
          boxShadow:  [
            '0 0 0 1px rgba(134,212,110,0.08)',
            '0 0 60px rgba(134,212,110,0.18)',
            '0 0 140px rgba(134,212,110,0.07)',
            '0 24px 100px rgba(0,0,0,0.96)',
          ].join(', '),
        }}
      >
        {/* CRT scan-line texture */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          aria-hidden="true"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(134,212,110,0.022) 0px, transparent 1px, transparent 2px)',
            backgroundSize:  '100% 3px',
          }}
        />
        {/* Radar glow — top */}
        <div
          className="pointer-events-none absolute top-0 left-1/2 z-[2] h-48 w-full -translate-x-1/2"
          aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse at top, rgba(134,212,110,0.07), transparent 65%)' }}
        />
        {/* Radar glow — bottom */}
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 z-[2] h-48 w-full -translate-x-1/2"
          aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse at bottom, rgba(134,212,110,0.06), transparent 65%)' }}
        />

        {/* ── Titlebar ── */}
        <div
          className="relative z-10 flex shrink-0 items-center gap-3 border-b px-5 py-3.5"
          style={{
            background:   'rgba(134,212,110,0.048)',
            borderColor:  'rgba(134,212,110,0.18)',
            boxShadow:    '0 1px 0 rgba(134,212,110,0.06)',
          }}
        >
          <div className="flex items-center gap-2" aria-hidden="true">
            <span className="h-3.5 w-3.5 rounded-full" style={{ background: 'rgba(215,168,92,0.70)', boxShadow: '0 0 6px rgba(215,168,92,0.30)' }} />
            <span className="h-3.5 w-3.5 rounded-full" style={{ background: 'rgba(134,212,110,0.55)', boxShadow: '0 0 6px rgba(134,212,110,0.22)' }} />
            <span className="h-3.5 w-3.5 rounded-full" style={{ background: 'rgba(134,212,110,0.30)' }} />
          </div>
          <span className="flex-1 truncate font-mono text-[11px] font-semibold uppercase tracking-[0.26em] text-crt/60 select-none">
            SWIM ARCHIVE TERMINAL
          </span>
          {data.sourceType && (
            <span
              className="shrink-0 rounded-sm px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em]"
              style={{
                color:      'rgba(109,168,255,0.85)',
                background: 'rgba(109,168,255,0.12)',
                border:     '1px solid rgba(109,168,255,0.28)',
              }}
            >
              {data.sourceType}
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Close artifact viewer"
            className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded font-mono text-[20px] leading-none text-crt/45 transition-colors hover:bg-crt/10 hover:text-crt/80"
          >
            ×
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain">

          {/* Type + category + date row */}
          <div
            className="border-b px-5 py-4"
            style={{ borderColor: 'rgba(134,212,110,0.10)', background: 'rgba(134,212,110,0.014)' }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {data.type && (
                <span
                  className="rounded px-2.5 py-[4px] font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    color:      typeColor,
                    background: `${typeColor}1a`,
                    border:     `1px solid ${typeColor}40`,
                    boxShadow:  `0 0 10px ${typeColor}12`,
                  }}
                >
                  {data.type}
                </span>
              )}
              <span
                className="rounded border px-2 py-[4px] font-mono text-[11px] uppercase tracking-[0.10em]"
                style={{ color: `${catColor}90`, borderColor: `${catColor}30` }}
              >
                {data.category}
              </span>
              {data.isReborn && (
                <span
                  className="rounded px-2.5 py-[4px] font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: '#d7a85c', background: 'rgba(215,168,92,0.12)', border: '1px solid rgba(215,168,92,0.32)' }}
                >
                  ◈ REBORN
                </span>
              )}
              {data.timestamp && (
                <span className="ml-auto shrink-0 font-mono text-[12px] tabular-nums text-crt/38">
                  {formatDate(data.timestamp)}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <div
            className="border-b px-5 py-6"
            style={{ borderColor: 'rgba(134,212,110,0.08)' }}
          >
            <h2
              className="font-mono text-[1.5rem] font-bold leading-snug tracking-[0.02em] text-crt sm:text-[1.8rem]"
              style={{ textShadow: `0 0 28px ${catColor}22, 0 0 60px ${catColor}0a` }}
            >
              {data.title}
            </h2>
          </div>

          {/* Excerpt */}
          {data.excerpt && (
            <div
              className="border-b px-5 py-5"
              style={{ borderColor: 'rgba(134,212,110,0.08)', background: 'rgba(134,212,110,0.009)' }}
            >
              <div
                className="border-l-2 pl-4"
                style={{ borderColor: `${catColor}35` }}
              >
                <p className="text-[15px] leading-relaxed tracking-[0.022em] text-crt/70 sm:text-[16px]">
                  {data.excerpt}
                </p>
              </div>
            </div>
          )}

          {/* Source metadata */}
          <div
            className="border-b px-5 py-4"
            style={{ borderColor: 'rgba(134,212,110,0.08)' }}
          >
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.26em] text-crt/30">source</div>
                <p className="font-mono text-[13px] text-crt/62">↳ {data.source}</p>
              </div>
              {data.tags && data.tags.length > 0 && (
                <div>
                  <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.26em] text-crt/30">tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.tags.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        className="rounded border px-2 py-0.5 font-mono text-[10px] text-crt/40"
                        style={{ borderColor: 'rgba(134,212,110,0.18)', background: 'rgba(134,212,110,0.04)' }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-5 pb-6 pt-5">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              {data.threadUrl && (
                <a
                  href={data.threadUrl}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-5 py-4 font-mono text-[13px] font-bold uppercase tracking-[0.16em] transition-all"
                  style={{
                    color:       '#86d46e',
                    borderColor: 'rgba(134,212,110,0.40)',
                    background:  'rgba(134,212,110,0.08)',
                    boxShadow:   '0 0 20px rgba(134,212,110,0.08)',
                  }}
                  aria-label={`Open thread: ${data.title}`}
                >
                  ▶ Open Thread
                </a>
              )}
              {data.sourceUrl && (
                <a
                  href={data.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-5 py-4 font-mono text-[13px] font-bold uppercase tracking-[0.16em] transition-all"
                  style={{
                    color:       'rgba(109,168,255,0.88)',
                    borderColor: 'rgba(109,168,255,0.32)',
                    background:  'rgba(109,168,255,0.07)',
                    boxShadow:   '0 0 20px rgba(109,168,255,0.06)',
                  }}
                  aria-label="View original source"
                >
                  ◈ View Source ↗
                </a>
              )}
              <button
                onClick={onClose}
                className="flex items-center justify-center rounded-lg border px-5 py-4 font-mono text-[13px] font-bold uppercase tracking-[0.16em] text-crt/42 transition-all hover:bg-crt/[0.06] hover:text-crt/65 sm:flex-none"
                style={{ borderColor: 'rgba(134,212,110,0.14)' }}
                aria-label="Close artifact viewer"
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
