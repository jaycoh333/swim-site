'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AmbientGrid } from '@/components/AmbientGrid';
import { GlitchText } from '@/components/GlitchText';

const CONFESSIONS = [
  {
    id: 'C-0041',
    text: "I told my wife I was at work for three years. I was just driving. The radio had a station that only played between 2 and 4 AM. It knew my name. I still don't know how.",
    timestamp: '05/15/01 03:33 AM',
  },
  {
    id: 'C-0042',
    text: "I've been pretending to be two different people in the same chat room for eleven months. I'm not sure which one is me anymore. One of them is better.",
    timestamp: '06/02/01 02:11 AM',
  },
  {
    id: 'C-0043',
    text: "I know the exact moment my father gave up. He was reading the newspaper. Nothing happened. He just stopped being there. We didn't talk about it. We still don't.",
    timestamp: '07/19/01 11:44 PM',
  },
  {
    id: 'C-0044',
    text: "The version of me that exists in my mother's memory is a completely different person. I'm afraid to correct her. She seems happier with that one.",
    timestamp: '08/31/01 01:08 AM',
  },
  {
    id: 'C-0045',
    text: "I found a journal I wrote at 14. I don't recognize the person who wrote it. But they were right about everything.",
    timestamp: '09/14/01 04:22 AM',
  },
];

export default function ConfessionsPage() {
  const [current, setCurrent] = useState(0);

  const confession = CONFESSIONS[current];

  return (
    <div className="relative min-h-screen pt-16">
      <AmbientGrid className="pointer-events-none fixed inset-0 opacity-40" />

      {/* Dark vignette - extra heavy for confessions */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(2,4,3,.8) 100%)',
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-16 text-center"
        >
          <GlitchText
            as="h1"
            intensity="low"
            className="font-terminal text-4xl tracking-[.2em] text-crt/80 uppercase"
          >
            CONFESSIONS
          </GlitchText>
          <p className="mt-3 text-xs text-crt/30 tracking-[.3em] uppercase">
            ANONYMOUS // UNVERIFIED // REAL
          </p>
        </motion.div>

        {/* Confession display */}
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={confession.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="panel p-8 text-center"
            >
              <p className="mb-6 text-xs text-crt/25 tracking-[.3em] uppercase">
                {confession.id} // {confession.timestamp}
              </p>
              <blockquote className="text-xl leading-relaxed text-crt/85 md:text-2xl">
                &ldquo;{confession.text}&rdquo;
              </blockquote>
              <p className="mt-6 text-sm text-phosphor/40 tracking-widest">— SWIM</p>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setCurrent(v => Math.max(0, v - 1))}
              disabled={current === 0}
              className="pixel-btn px-5 py-2 text-sm tracking-widest disabled:opacity-20"
            >
              ‹ PREV
            </button>

            <div className="flex gap-2">
              {CONFESSIONS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-1.5 w-6 transition-all ${
                    i === current ? 'bg-crt' : 'bg-crt/15 hover:bg-crt/35'
                  }`}
                  aria-label={`Confession ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrent(v => Math.min(CONFESSIONS.length - 1, v + 1))}
              disabled={current === CONFESSIONS.length - 1}
              className="pixel-btn px-5 py-2 text-sm tracking-widest disabled:opacity-20"
            >
              NEXT ›
            </button>
          </div>

          {/* Submit */}
          <div className="mt-12 border border-crt/12 p-5 text-center">
            <p className="text-xs text-crt/25 tracking-widest">
              SUBMIT A CONFESSION // ANONYMOUS // NO ACCOUNT REQUIRED
            </p>
            <p className="mt-2 text-[11px] text-crt/15 tracking-widest">
              COMING IN PHASE 2
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
