'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { AmbientGrid } from '@/components/AmbientGrid';
import { TerminalWindow } from '@/components/TerminalWindow';
import { mockDb } from '@/lib/mock-db';

export default function SignalPage() {
  const signals = mockDb.getSignals();
  const worldEvents = mockDb.getWorldEvents();
  const sequence = [...signals, ...signals.slice().reverse()];
  const [feed, setFeed] = useState(sequence.slice(0, 4));

  useEffect(() => {
    let cursor = 0;
    const id = setInterval(() => {
      cursor = (cursor + 1) % sequence.length;
      setFeed((previous) => [sequence[cursor], ...previous].slice(0, 8));
    }, 4200);
    return () => clearInterval(id);
  }, [sequence]);

  return (
    <div className="relative min-h-screen pt-16">
      <AmbientGrid className="pointer-events-none fixed inset-0 opacity-45" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="mb-2 text-xs tracking-[.3em] text-crt/25 uppercase">
            SWIM NETWORK // SIGNAL
          </div>
          <h1 className="crt-text text-5xl tracking-wide uppercase">SIGNAL</h1>
          <p className="mt-2 text-sm tracking-widest text-crt/40">
            Incoming transmissions. New nodes. Recovered system notices.
          </p>
        </motion.div>

        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs tracking-widest text-crt/40">
            <span className="h-2 w-2 rounded-full bg-crt animate-pulse-glow" />
            <span>SIGNAL LIVE</span>
          </div>
          <div className="h-px flex-1 bg-crt/10" />
          <div className="text-xs tracking-widest text-crt/25">SCANNING ALL FREQUENCIES</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-crt/15 px-4 py-2.5">
              <span className="text-xs tracking-widest text-phosphor/65">// INCOMING FEED</span>
              <span className="text-xs tracking-widest text-crt/20">AUTO-REFRESH: 4.2s</span>
            </div>
            <div className="space-y-0 p-4 min-h-[380px]">
              <AnimatePresence>
                {feed.map((item, index) => (
                  <motion.div
                    key={`${item.id}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: Math.max(0.15, 1 - index * 0.08), x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-4 border-b border-crt/8 py-2.5 last:border-0"
                  >
                    <span className="min-w-[86px] shrink-0 pt-0.5 font-mono text-xs tracking-widest text-crt/35">
                      {item.frequency}
                    </span>
                    <span className="text-sm leading-relaxed text-crt/65">&gt; {item.body}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <aside className="space-y-4">
            <TerminalWindow title="System Notifications" version="watch.04" animate={false}>
              <div className="space-y-2 text-[1.08rem] leading-tight text-crt/62">
                {worldEvents.map((event) => (
                  <div key={event.id} className="border-b border-crt/10 pb-2 last:border-b-0">
                    <div className="text-crt/36">{event.timestamp}</div>
                    <div className="text-crt/76">{event.message}</div>
                  </div>
                ))}
              </div>
            </TerminalWindow>

            <TerminalWindow title="Frequencies" version="tuner.02" animate={false}>
              <div className="space-y-2 text-[1.05rem] leading-tight text-crt/60">
                {signals.map((signal) => (
                  <div key={signal.id} className="flex items-center justify-between border-b border-crt/10 pb-2 last:border-b-0">
                    <span>{signal.frequency}</span>
                    <span className="text-crt/38">{signal.source}</span>
                  </div>
                ))}
              </div>
            </TerminalWindow>
          </aside>
        </div>
      </div>
    </div>
  );
}
