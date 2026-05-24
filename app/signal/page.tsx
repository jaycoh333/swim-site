'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AmbientGrid } from '@/components/AmbientGrid';
import { GlitchText } from '@/components/GlitchText';
import { SIGNAL_FEED } from '@/lib/sampleContent';

const EXTENDED_FEED = [
  ...SIGNAL_FEED,
  { freq: '110.5 MHz', message: 'ENTRY #0x3D7E RECEIVING HIGH ECHO RATE.' },
  { freq: '88.1 MHz', message: 'ANOMALY DETECTED: DUPLICATE TIMESTAMP IN ARCHIVE.' },
  { freq: '96.3 MHz', message: 'NEW NODE CONNECTED. LOCATION: UNKNOWN.' },
  { freq: '101.1 MHz', message: 'SWIM PROTOCOL STABLE. ALL CHANNELS OPEN.' },
];

export default function SignalPage() {
  const [feed, setFeed] = useState(EXTENDED_FEED.slice(0, 6));

  // Simulate live feed — stable interval, no tick state needed
  useEffect(() => {
    let cursor = 0;
    const id = setInterval(() => {
      cursor = (cursor + 1) % EXTENDED_FEED.length;
      setFeed(prev => [EXTENDED_FEED[cursor], ...prev].slice(0, 12));
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-screen pt-16">
      <AmbientGrid className="pointer-events-none fixed inset-0 opacity-45" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="mb-2 text-xs tracking-[.3em] text-crt/25 uppercase">
            SWIM NETWORK // SIGNAL
          </div>
          <GlitchText
            as="h1"
            intensity="medium"
            className="crt-text font-terminal text-5xl tracking-wide uppercase"
          >
            SIGNAL
          </GlitchText>
          <p className="mt-2 text-sm text-crt/40 tracking-widest">
            Incoming transmissions. Unfiltered. Unverified.
          </p>
        </motion.div>

        {/* Live status */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-crt/40 tracking-widest">
            <span className="h-2 w-2 rounded-full bg-crt animate-pulse-glow" />
            <span>SIGNAL LIVE</span>
          </div>
          <div className="flex-1 h-px bg-crt/10" />
          <div className="text-xs text-crt/25 tracking-widest">SCANNING ALL FREQUENCIES</div>
        </div>

        {/* Waveform visualizer */}
        <div className="mb-8 panel px-6 py-4">
          <div className="mb-3 text-xs text-crt/30 tracking-widest">WAVEFORM</div>
          <div className="flex items-end gap-0.5 h-12">
            {Array.from({ length: 64 }, (_, i) => (
              <motion.div
                key={i}
                animate={{ height: ['20%', `${25 + ((i * 37 + 13) % 75)}%`, '20%'] }}
                transition={{
                  duration: 0.8 + (i % 5) * 0.2,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  delay: i * 0.03,
                  ease: 'easeInOut',
                }}
                className="flex-1 bg-crt/40"
                style={{ boxShadow: '0 0 3px rgba(124,255,91,.2)' }}
              />
            ))}
          </div>
        </div>

        {/* Live feed */}
        <div className="panel overflow-hidden">
          <div className="border-b border-crt/15 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-phosphor/65 tracking-widest">// INCOMING FEED</span>
            <span className="text-xs text-crt/20 tracking-widest">AUTO-REFRESH: 4.5s</span>
          </div>
          <div className="p-4 space-y-0 min-h-[380px]">
            <AnimatePresence>
              {feed.map((item, i) => (
                <motion.div
                  key={`${item.freq}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: Math.max(0.15, 1 - i * 0.08), x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-4 py-2.5 border-b border-crt/8 last:border-0"
                >
                  <span
                    className="shrink-0 text-xs text-crt/35 tracking-widest font-mono pt-0.5"
                    style={{ minWidth: '86px' }}
                  >
                    {item.freq}
                  </span>
                  <span className="text-sm text-crt/65 leading-relaxed">
                    &gt; {item.message}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Frequency tuner */}
        <div className="mt-6 border border-crt/12 p-5">
          <div className="mb-3 text-xs text-crt/30 tracking-widest uppercase">
            TUNE TO FREQUENCY
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="88"
              max="108"
              defaultValue="98"
              className="flex-1 h-1 bg-crt/10 cursor-pointer"
              style={{ accentColor: '#7CFF5B' }}
            />
            <div className="panel px-3 py-1.5 text-sm text-crt tracking-widest min-w-[90px] text-center">
              98.6 MHz
            </div>
          </div>
          <p className="mt-3 text-xs text-crt/18 tracking-widest">
            MANUAL TUNING: COMING IN PHASE 5
          </p>
        </div>
      </div>
    </div>
  );
}
