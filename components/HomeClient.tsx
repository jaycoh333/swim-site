'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { AmbientGrid } from '@/components/AmbientGrid';
import { BootSequence } from '@/components/BootSequence';
import { CategoryRail } from '@/components/CategoryRail';
import { HighlightedStories } from '@/components/HighlightedStories';
import { MobileActionBar } from '@/components/MobileActionBar';
import { SwimHeader } from '@/components/SwimHeader';
import { mockDb } from '@/lib/mock-db';
import type { ThreadContent } from '@/lib/forum-types';

const RAIL_CATEGORIES = [
  'Stories', 'Philosophy', 'Technology', 'UFOs', 'Dreams',
  'Art', 'Music', 'Crypto Trench', 'Politics', 'Paranormal', 'AI',
] as const;

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

interface HomeClientProps {
  initialHighlightedThreads: ThreadContent[];
  initialHotThreads: ThreadContent[];
}

export function HomeClient({
  initialHighlightedThreads,
}: HomeClientProps) {
  const router = useRouter();
  const [bootDone, setBootDone] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [clock, setClock] = useState('03:33:33');
  const [onlineTick, setOnlineTick] = useState(0);

  function handleSelectCategory(cat: string | null) {
    if (cat) router.push(`/threads?category=${encodeURIComponent(cat)}`);
    else router.push('/threads');
  }

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
          hour: '2-digit',
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

  return (
    <>
      <BootSequence onComplete={() => setBootDone(true)} />
      <MobileActionBar />

      <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[68px] soft-flicker md:pb-8 md:pt-[80px]">
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
          className="relative z-10 mx-auto max-w-4xl px-2.5 sm:px-3 md:px-4"
        >
          <section className="forum-shell">

            {/* ── Atmospheric header ── */}
            <SwimHeader
              participants={participants}
              clock={clock}
              statusIdx={messageIndex}
            />

            {/* ── Category navigation ── */}
            <div className="border-b border-crt/12">
              <CategoryRail
                categories={RAIL_CATEGORIES}
                active={null}
                onSelect={handleSelectCategory}
              />
            </div>

            {/* ── Main content — single column portal ── */}
            <div className="space-y-4 px-2.5 py-5 md:space-y-5 md:px-6 md:py-8">

              {/* Large centered intro/description */}
              <div className="border border-crt/14 px-5 py-6 text-center md:px-10 md:py-8">
                <p className="text-[1.08rem] leading-relaxed tracking-[0.05em] text-crt/82 md:text-[1.2rem]">
                  SWIM is an anonymous archive for stories, theories, confessions, signals, strange experiences, and hidden internet lore.
                </p>
                <p className="mt-3 text-[0.95rem] leading-relaxed tracking-[0.08em] text-crt/42 md:text-[1.02rem]">
                  No names required. Post as ANON or return as a Ghost.
                </p>
                <div className="mt-3.5 text-[11px] uppercase tracking-[0.26em] text-crt/20">
                  no accounts · no tracking · the archive remembers
                </div>
              </div>

              {/* Two CTA buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/threads"
                  className="block border border-crt/18 px-4 py-4 text-center text-[13px] uppercase tracking-[0.22em] text-crt/52 transition-colors hover:border-crt/35 hover:text-crt/80"
                >
                  [ Browse Threads ]
                </Link>
                <Link
                  href="/threads?compose=true"
                  className="block border border-crt/30 px-4 py-4 text-center text-[13px] uppercase tracking-[0.22em] text-crt/75 transition-colors hover:border-crt/52 hover:text-crt"
                >
                  [ Post a Story ]
                </Link>
              </div>

              {/* Highlighted / Recovered Files */}
              <HighlightedStories threads={initialHighlightedThreads.slice(0, 6)} />

            </div>

            {/* ── Footer ── */}
            <div className="border-t border-crt/8 px-4 py-2.5 text-center text-[10px] uppercase tracking-[0.28em] text-crt/18">
              swim · someone who isn&apos;t me · anonymous archive · no tracking
            </div>
          </section>
        </motion.div>
      </div>
    </>
  );
}
