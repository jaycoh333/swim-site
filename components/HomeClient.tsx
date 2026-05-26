'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { AmbientGrid } from '@/components/AmbientGrid';
import { BootSequence } from '@/components/BootSequence';
import { CategoryPortalGrid } from '@/components/CategoryPortalGrid';
import { MobileActionBar } from '@/components/MobileActionBar';
import { NetworkFooter } from '@/components/NetworkFooter';
import { SignalTicker } from '@/components/SignalTicker';
import { SwimHeader } from '@/components/SwimHeader';
import { SwimAiTerminal } from '@/components/SwimAiTerminal';
import { mockDb } from '@/lib/mock-db';
import { MOCK_TERMINAL_FEED } from '@/lib/terminal-feed';
import type { TerminalEntry } from '@/lib/terminal-feed';
import type { ScannerStats } from '@/lib/supabase/repository';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HomeClientProps {
  terminalFeed?: TerminalEntry[];
  stats?:        ScannerStats;
  isLive?:       boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useAnimatedCounter(target: number, delay = 0, duration = 2000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = Date.now() + delay;
    const steps = 60;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed < 0) return;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress >= 1) clearInterval(id);
    }, duration / steps);
    return () => clearInterval(id);
  }, [target, delay, duration]);
  return count;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomeClient({
  terminalFeed,
  stats,
  isLive = false,
}: HomeClientProps) {
  const [bootDone,     setBootDone]     = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [clock,        setClock]        = useState('03:33:33');
  const [onlineTick,   setOnlineTick]   = useState(0);

  useEffect(() => {
    const rotate = window.setInterval(() => {
      setMessageIndex((c) => (c + 1) % 8);
      setOnlineTick((c) => c + 1);
    }, 5200);
    const tick = window.setInterval(() => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour:   '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    }, 1000);
    return () => {
      window.clearInterval(rotate);
      window.clearInterval(tick);
    };
  }, []);

  const onlineCount  = useAnimatedCounter(mockDb.getOnlineSnapshot(onlineTick), 250, 1600);
  const participants = bootDone ? onlineCount : 0;

  // Use live feed if available, otherwise mock
  const feed = (terminalFeed && terminalFeed.length > 0) ? terminalFeed : MOCK_TERMINAL_FEED;

  // Status bar numbers
  const terminalStats = stats
    ? {
        recoveredToday:   stats.totalRecovered,
        sourcesMonitored: 8,
        threadsReborn:    stats.threadsReborn,
        pendingReview:    stats.pendingReview,
      }
    : {
        recoveredToday:   847,
        sourcesMonitored: 8,
        threadsReborn:    34,
        pendingReview:    12,
      };

  return (
    <>
      <BootSequence onComplete={() => setBootDone(true)} />
      <MobileActionBar />

      <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[80px] soft-flicker md:pb-8 md:pt-[100px]">
        <AmbientGrid className="absolute inset-0 opacity-25" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 3%, rgba(134,212,110,.04), transparent 18rem)',
          }}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: bootDone ? 1 : 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="relative z-10 mx-auto max-w-5xl px-4 sm:px-5 md:px-6"
        >
          <section className="forum-shell">

            {/* ── Hero artwork ── */}
            <SwimHeader
              participants={participants}
              clock={clock}
              statusIdx={messageIndex}
            />

            {/* ── Atmospheric ticker ── */}
            <SignalTicker />

            {/* ── Intro + CTAs ── */}
            <div className="px-6 py-10 text-center md:px-14 md:py-14">
              <p className="text-[1.5rem] leading-relaxed tracking-[0.04em] text-crt/92 md:text-[1.7rem]">
                Anonymous archive for stories, confessions, signals, rabbit holes,
                strange encounters, and hidden internet lore.
              </p>
              <p className="mt-5 text-[1.2rem] leading-relaxed tracking-[0.06em] text-crt/65 md:text-[1.35rem]">
                No accounts required. Post as ANON or return as a Ghost.
              </p>
              <div className="mt-5 text-[13px] uppercase tracking-[0.28em] text-crt/42">
                NO TRACKING&nbsp;·&nbsp;ALL CHANNELS OPEN&nbsp;·&nbsp;THE ARCHIVE REMEMBERS
              </div>

              {/* CTAs */}
              <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:justify-center">
                <Link href="/threads" className="homepage-cta-primary">
                  [ ENTER ARCHIVE ]
                </Link>
                <Link href="/threads?compose=true" className="homepage-cta-secondary">
                  [ POST SIGNAL ]
                </Link>
              </div>
            </div>

            {/* ── SWIM AI Terminal ── */}
            <div className="border-t border-crt/10 px-4 pb-12 pt-10 md:px-6 md:pb-16 md:pt-14">

              {/* Section header */}
              <div className="mb-8 text-center">
                <div className="mb-2 flex items-center justify-center gap-2.5">
                  <span className="h-px w-8 bg-crt/15" aria-hidden="true" />
                  <span className="text-[10px] uppercase tracking-[0.36em] text-crt/35">
                    autonomous recovery system
                  </span>
                  <span className="h-px w-8 bg-crt/15" aria-hidden="true" />
                </div>
                <h2 className="mb-3 text-[1.7rem] tracking-[0.12em] text-crt/92 md:text-[2.1rem]">
                  SWIM AI SIGNAL MONITOR
                </h2>
                <p className="mx-auto max-w-md text-[1.1rem] leading-relaxed tracking-[0.04em] text-crt/48 md:text-[1.2rem]">
                  Recovering strange artifacts from forgotten internet edges.
                </p>
              </div>

              <SwimAiTerminal entries={feed} stats={terminalStats} />

              <div className="mt-5 text-center">
                <Link
                  href="/scanner"
                  className="text-[12px] uppercase tracking-[0.22em] text-crt/35 transition-colors hover:text-crt/65"
                >
                  view full scanner →
                </Link>
              </div>
            </div>

            {/* ── Category portal grid ── */}
            <div className="border-t border-crt/10 px-4 pb-10 pt-8 md:px-6 md:pb-12 md:pt-10">
              <div className="mb-6 flex items-center gap-3">
                <span className="h-1.5 w-1.5 animate-pulse-glow bg-crt/55" aria-hidden="true" />
                <span className="text-[12px] uppercase tracking-[0.30em] text-crt/52">
                  SELECT CHANNEL
                </span>
              </div>
              <CategoryPortalGrid />
            </div>

            {/* ── Network footer ── */}
            <NetworkFooter />

            {/* ── Archive tagline ── */}
            <div className="border-t border-crt/8 px-4 py-3 text-center text-[14px] uppercase tracking-[0.20em] text-crt/42">
              swim · someone who isn&apos;t me · anonymous archive · no tracking
            </div>

          </section>
        </motion.div>
      </div>
    </>
  );
}
