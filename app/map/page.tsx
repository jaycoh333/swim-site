'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AmbientGrid } from '@/components/AmbientGrid';
import { TerminalWindow } from '@/components/TerminalWindow';
import { MAP_ENTRIES } from '@/lib/sampleContent';

const MAP_ASCII = `
    . . . . . . . . . . . . . . . . . . . . . . .
    .         ◆ [40.7N]                          .
    .           THE PAYPHONE                     .
    . . . . . . . . . . . . . . . .  . . . . . . .
    .                   ◆ [51.5N]               .
    .                   SIGNAL TOWER            .
    . . . . . . . . . . . . . . . . . . . . . .  .
    .  ◆ [19.4N]              ◆ [48.8N]         .
    .  THE STATION            TRANSIT NODE      .
    . . . . . . . . . . . . . . . . . . . . . . .
    .                                ◆ [55.7N]  .
    .                    ◆ [35.6N]  ARCHIVE     .
    .                    DOOR 4F    MIRROR      .
    . . . . . . . . . . . . . . . . . . . . . . .
`;

export default function MapPage() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="relative min-h-screen pt-16">
      <AmbientGrid className="pointer-events-none fixed inset-0 opacity-40" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="mb-2 text-xs tracking-[.3em] text-crt/25 uppercase">
            SWIM NETWORK // MAP MODE
          </div>
          <h1 className="crt-text font-terminal text-5xl tracking-wide uppercase">
            THE MAP
          </h1>
          <p className="mt-2 text-sm text-crt/40 tracking-widest">
            Anonymous coordinates. Verified by nobody. Real to someone.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* ASCII Map */}
          <div>
            <TerminalWindow title="GLOBAL COORDINATE GRID" animate={false}>
              <pre className="overflow-x-auto text-sm leading-relaxed text-crt/55 whitespace-pre">
                {MAP_ASCII}
              </pre>
              <div className="mt-4 border-t border-crt/12 pt-3 text-xs text-crt/25 tracking-widest">
                ◆ = ACTIVE PIN &nbsp;|&nbsp; CLICK ENTRY BELOW TO LOCATE
              </div>
            </TerminalWindow>

            {/* Legend */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { symbol: '◆', label: 'CONFIRMED PIN' },
                { symbol: '◇', label: 'UNVERIFIED' },
                { symbol: '∿', label: 'SIGNAL ANOMALY' },
                { symbol: '?', label: 'DISPUTED' },
              ].map(({ symbol, label }) => (
                <div key={label} className="panel px-3 py-2 flex items-center gap-3 text-xs">
                  <span className="text-crt text-base">{symbol}</span>
                  <span className="text-crt/40 tracking-widest">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Entry list */}
          <aside>
            <TerminalWindow title="PINNED LOCATIONS" animate={false}>
              <div className="space-y-3">
                {MAP_ENTRIES.map((entry, i) => (
                  <motion.div
                    key={entry.coords}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.07 }}
                    onClick={() => setSelected(selected === i ? null : i)}
                    className={`cursor-pointer border p-3 transition-all ${
                      selected === i
                        ? 'border-crt/50 bg-crt/5'
                        : 'border-crt/15 hover:border-crt/30'
                    }`}
                  >
                    <div className="text-[10px] text-crt/30 tracking-widest font-ibm-plex">
                      {entry.coords}
                    </div>
                    <div className="mt-1 text-sm text-crt/70 tracking-widest">{entry.label}</div>
                    {selected === i && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 text-xs text-crt/45 leading-relaxed"
                      >
                        {entry.note}
                      </motion.p>
                    )}
                  </motion.div>
                ))}
              </div>
            </TerminalWindow>

            <div className="mt-4 border border-crt/12 p-4 text-center text-xs text-crt/20 tracking-widest">
              PIN YOUR OWN LOCATION<br />
              <span className="text-[10px]">COMING IN PHASE 5</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
