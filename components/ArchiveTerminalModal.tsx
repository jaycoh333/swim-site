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
      className="fixed inset-0 z-[9998] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Archive terminal viewer"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/78"
        style={{ backdropFilter: 'blur(2px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Terminal window */}
      <div
        className="relative z-10 flex w-full max-h-[90vh] flex-col overflow-hidden sm:rounded-xl sm:max-w-xl lg:max-w-2xl"
        style={{
          background: 'rgba(3, 7, 4, 0.98)',
          border:     '1px solid rgba(134,212,110,0.18)',
          boxShadow:  '0 0 0 1px rgba(134,212,110,0.05), 0 12px 70px rgba(0,0,0,0.90), 0 0 100px rgba(134,212,110,0.05)',
        }}
      >
        {/* CRT scan-line texture */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          aria-hidden="true"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(134,212,110,0.012) 0px, transparent 1px, transparent 2px)',
            backgroundSize:  '100% 3px',
          }}
        />
        {/* Radar glow — bottom */}
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 z-[2] h-40 w-80 -translate-x-1/2"
          aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse at bottom, rgba(134,212,110,0.045), transparent 70%)' }}
        />

        {/* ── Titlebar ── */}
        <div
          className="relative z-10 flex shrink-0 items-center gap-2.5 border-b px-4 py-2.5"
          style={{ background: 'rgba(134,212,110,0.028)', borderColor: 'rgba(134,212,110,0.10)' }}
        >
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-3 w-3 rounded-full" style={{ background: 'rgba(215,168,92,0.55)' }} />
            <span className="h-3 w-3 rounded-full" style={{ background: 'rgba(134,212,110,0.38)' }} />
            <span className="h-3 w-3 rounded-full" style={{ background: 'rgba(134,212,110,0.22)' }} />
          </div>
          <span className="flex-1 truncate font-mono text-[10px] uppercase tracking-[0.22em] text-crt/28 select-none">
            SWIM ARCHIVE — RECOVERED ARTIFACT
          </span>
          {data.sourceType && (
            <span
              className="shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em]"
              style={{
                color:      'rgba(109,168,255,0.70)',
                background: 'rgba(109,168,255,0.08)',
                border:     '1px solid rgba(109,168,255,0.18)',
              }}
            >
              {data.sourceType}
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Close artifact viewer"
            className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded font-mono text-[18px] leading-none text-crt/35 transition-colors hover:bg-crt/8 hover:text-crt/70"
          >
            ×
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain">

          {/* Type + category + date row */}
          <div
            className="border-b px-5 py-3.5"
            style={{ borderColor: 'rgba(134,212,110,0.07)', background: 'rgba(134,212,110,0.010)' }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {data.type && (
                <span
                  className="rounded-sm px-2 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    color:      typeColor,
                    background: `${typeColor}15`,
                    border:     `1px solid ${typeColor}30`,
                  }}
                >
                  {data.type}
                </span>
              )}
              <span
                className="rounded-sm border px-1.5 py-[3px] font-mono text-[10px] uppercase tracking-[0.10em]"
                style={{ color: `${catColor}80`, borderColor: `${catColor}20` }}
              >
                {data.category}
              </span>
              {data.isReborn && (
                <span
                  className="rounded-sm px-2 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: '#d7a85c', background: 'rgba(215,168,92,0.10)', border: '1px solid rgba(215,168,92,0.25)' }}
                >
                  ◈ REBORN
                </span>
              )}
              {data.timestamp && (
                <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-crt/28">
                  {formatDate(data.timestamp)}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <div
            className="border-b px-5 py-5"
            style={{ borderColor: 'rgba(134,212,110,0.07)' }}
          >
            <h2
              className="font-mono text-[1.25rem] font-bold leading-snug tracking-[0.02em] text-crt/90 sm:text-[1.4rem]"
              style={{ textShadow: `0 0 22px ${catColor}1a` }}
            >
              {data.title}
            </h2>
          </div>

          {/* Excerpt */}
          {data.excerpt && (
            <div
              className="border-b px-5 py-5"
              style={{ borderColor: 'rgba(134,212,110,0.07)', background: 'rgba(134,212,110,0.007)' }}
            >
              <p className="text-[15px] leading-relaxed tracking-[0.022em] text-crt/58 sm:text-[16px]">
                {data.excerpt}
              </p>
            </div>
          )}

          {/* Source metadata */}
          <div
            className="border-b px-5 py-4"
            style={{ borderColor: 'rgba(134,212,110,0.07)' }}
          >
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <div className="mb-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-crt/22">source</div>
                <p className="font-mono text-[13px] text-crt/52">↳ {data.source}</p>
              </div>
              {data.tags && data.tags.length > 0 && (
                <div>
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-crt/22">tags</div>
                  <div className="flex flex-wrap gap-1">
                    {data.tags.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-crt/30"
                        style={{ borderColor: 'rgba(134,212,110,0.12)' }}
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
          <div className="px-5 pb-5 pt-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              {data.threadUrl && (
                <a
                  href={data.threadUrl}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.14em] transition-colors"
                  style={{
                    color:       '#86d46e',
                    borderColor: 'rgba(134,212,110,0.30)',
                    background:  'rgba(134,212,110,0.06)',
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
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.14em] transition-colors"
                  style={{
                    color:       'rgba(109,168,255,0.75)',
                    borderColor: 'rgba(109,168,255,0.22)',
                    background:  'rgba(109,168,255,0.05)',
                  }}
                  aria-label="View original source"
                >
                  ◈ View Source ↗
                </a>
              )}
              <button
                onClick={onClose}
                className="flex items-center justify-center rounded-lg border px-4 py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-crt/35 transition-colors hover:bg-crt/[0.05] hover:text-crt/55 sm:flex-none"
                style={{ borderColor: 'rgba(134,212,110,0.10)' }}
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
