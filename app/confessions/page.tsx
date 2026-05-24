'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { AmbientGrid } from '@/components/AmbientGrid';
import { ContentCard } from '@/components/ContentCard';
import { TerminalWindow } from '@/components/TerminalWindow';
import { mockDb } from '@/lib/mock-db';

export default function ConfessionsPage() {
  const confessions = mockDb.getConfessions();
  const [current, setCurrent] = useState(0);
  const confession = confessions[current];

  return (
    <div className="relative min-h-screen pt-16">
      <AmbientGrid className="pointer-events-none fixed inset-0 opacity-40" />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(2,4,3,.8) 100%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 md:px-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-10 text-center"
        >
          <h1 className="crt-text text-4xl tracking-[.2em] uppercase">CONFESSIONS</h1>
          <p className="mt-3 text-xs tracking-[.3em] text-crt/30 uppercase">
            ANONYMOUS // UNVERIFIED // REAL
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={confession.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                <ContentCard item={confession} />
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setCurrent((value) => Math.max(0, value - 1))}
                disabled={current === 0}
                className="pixel-btn px-5 py-2 text-sm tracking-widest disabled:opacity-20"
              >
                PREV
              </button>

              <div className="flex gap-2">
                {confessions.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrent(index)}
                    className={`h-1.5 w-6 transition-all ${
                      index === current ? 'bg-crt' : 'bg-crt/15 hover:bg-crt/35'
                    }`}
                    aria-label={`Confession ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => setCurrent((value) => Math.min(confessions.length - 1, value + 1))}
                disabled={current === confessions.length - 1}
                className="pixel-btn px-5 py-2 text-sm tracking-widest disabled:opacity-20"
              >
                NEXT
              </button>
            </div>
          </div>

          <aside className="space-y-4">
            <TerminalWindow title="Submission Notes" version="sealed.01" animate={false}>
              <div className="space-y-2 text-[1.08rem] leading-tight text-crt/60">
                <p>confessions render with softer framing</p>
                <p>no social profile required</p>
                <p>passphrase can preserve an anonymous voice later</p>
              </div>
            </TerminalWindow>

            <TerminalWindow title="Confession Queue" version="buried.02" animate={false}>
              <div className="space-y-2 text-[1.05rem] leading-tight text-crt/58">
                {confessions.map((item) => (
                  <div key={item.id} className="border-b border-crt/10 pb-2 last:border-b-0">
                    <div className="text-crt/38">{item.id}</div>
                    <div className="text-crt/72">{item.title}</div>
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
