'use client';

import { motion } from 'framer-motion';
import { ArchiveCard } from '@/components/ArchiveCard';
import { TerminalWindow } from '@/components/TerminalWindow';
import { AmbientGrid } from '@/components/AmbientGrid';
import { ARCHIVE_ENTRIES } from '@/lib/sampleContent';

const CATEGORIES = [
  'ALL', 'CONFESSIONS', 'DREAMS', 'PARANORMAL',
  'THEORIES', 'GLITCHES', 'TRIP REPORTS', 'SURVIVAL', 'RELATIONSHIPS', 'CRYPTO',
];

export default function ArchivePage() {
  return (
    <div className="relative min-h-screen pt-16">
      <AmbientGrid className="pointer-events-none fixed inset-0 opacity-60" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="mb-2 text-xs tracking-[.3em] text-crt/30 uppercase">
            SWIM NETWORK // ARCHIVE
          </div>
          <h1 className="crt-text font-terminal text-5xl tracking-wide uppercase">
            THE ARCHIVE
          </h1>
          <p className="mt-2 text-sm text-crt/45 tracking-widest">
            Everything submitted. Nothing deleted. Nothing identified.
          </p>
        </motion.div>

        {/* Stats bar */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'TOTAL ENTRIES', value: '14,892' },
            { label: 'CATEGORIES', value: '9' },
            { label: 'OLDEST ENTRY', value: '05/15/01' },
            { label: 'AVG SIGNAL', value: '3.7 / 5' },
          ].map(({ label, value }) => (
            <div key={label} className="panel px-4 py-3 text-center">
              <div className="text-xl text-crt crt-text-dim">{value}</div>
              <div className="mt-1 text-[10px] tracking-widest text-crt/30 uppercase">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <aside>
            <TerminalWindow title="FILTER BY">
              <ul className="space-y-1 text-sm">
                {CATEGORIES.map((cat, i) => (
                  <li key={cat}>
                    <button className="w-full text-left px-2 py-1.5 text-crt/60 hover:text-crt hover:bg-crt/5 transition-colors tracking-widest">
                      {i === 0 ? (
                        <span className="text-crt crt-text-dim">&gt; {cat}</span>
                      ) : (
                        <span>› {cat}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </TerminalWindow>

            <div className="mt-4">
              <TerminalWindow title="SEARCH">
                <div className="flex items-center gap-2 border border-crt/25 px-3 py-2">
                  <span className="text-crt/40 text-sm">›</span>
                  <span className="text-sm text-crt/30 tracking-widest">TYPE TO SEARCH</span>
                  <span className="ml-auto blink text-crt">_</span>
                </div>
              </TerminalWindow>
            </div>
          </aside>

          {/* Main grid */}
          <main>
            <div className="mb-4 flex items-center justify-between text-xs text-crt/30 tracking-widest">
              <span>SHOWING {ARCHIVE_ENTRIES.length} ENTRIES</span>
              <span>SORTED: SIGNAL STRENGTH</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {ARCHIVE_ENTRIES.map((entry, i) => (
                <ArchiveCard key={entry.id} {...entry} index={i} />
              ))}
            </div>

            <div className="mt-8 border border-crt/15 p-5 text-center">
              <p className="text-sm text-crt/35 tracking-widest">
                — ARCHIVE CONTINUES BELOW —
              </p>
              <p className="mt-2 text-xs text-crt/20 tracking-widest">
                SUBMIT YOUR OWN: COMING IN PHASE 2
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
