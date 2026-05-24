'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

import { AmbientGrid } from '@/components/AmbientGrid';
import { TerminalWindow } from '@/components/TerminalWindow';
import { mockDb } from '@/lib/mock-db';

const MAP_ASCII = `
    . . . . . . . . . . . . . . . . . . . . . . .
    .         * [40.7N]                          .
    .           THE PAYPHONE                     .
    . . . . . . . . . . . . . . . . . . . . . . .
    .                   * [51.5N]               .
    .                   SIGNAL TOWER            .
    . . . . . . . . . . . . . . . . . . . . . . .
    .                      * [48.8N]            .
    .                      TRANSIT NODE         .
    . . . . . . . . . . . . . . . . . . . . . . .
`;

export default function MapPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const encounters = mockDb.getEncounters();

  return (
    <div className="relative min-h-screen pt-16">
      <AmbientGrid className="pointer-events-none fixed inset-0 opacity-40" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="mb-2 text-xs tracking-[.3em] text-crt/25 uppercase">
            SWIM NETWORK // MAP MODE
          </div>
          <h1 className="crt-text text-5xl tracking-wide uppercase">THE MAP</h1>
          <p className="mt-2 text-sm tracking-widest text-crt/40">
            Anonymous coordinates. Shared encounters. Nobody verified them.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <TerminalWindow title="Global Coordinate Grid" animate={false}>
              <pre className="overflow-x-auto whitespace-pre text-sm leading-relaxed text-crt/55">
                {MAP_ASCII}
              </pre>
              <div className="mt-4 border-t border-crt/12 pt-3 text-xs tracking-widest text-crt/25">
                * = ACTIVE PIN | SELECT ENTRY TO REVIEW FIELD NOTES
              </div>
            </TerminalWindow>
          </div>

          <aside>
            <TerminalWindow title="Pinned Locations" animate={false}>
              <div className="space-y-3">
                {encounters.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.07 }}
                    onClick={() => setSelected(selected === index ? null : index)}
                    className={`cursor-pointer border p-3 transition-all ${
                      selected === index
                        ? 'border-crt/50 bg-crt/5'
                        : 'border-crt/15 hover:border-crt/30'
                    }`}
                  >
                    <div className="font-ibm-plex text-[10px] tracking-widest text-crt/30">
                      {entry.coordinates}
                    </div>
                    <div className="mt-1 text-sm tracking-widest text-crt/70">{entry.locationName}</div>
                    <div className="mt-1 text-xs text-crt/42">{entry.title}</div>
                    {selected === index && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 text-xs leading-relaxed text-crt/45"
                      >
                        {entry.body}
                      </motion.p>
                    )}
                  </motion.div>
                ))}
              </div>
            </TerminalWindow>
          </aside>
        </div>
      </div>
    </div>
  );
}
