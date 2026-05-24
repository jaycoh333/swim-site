'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

import { BootSequence } from '@/components/BootSequence';
import { GlitchText } from '@/components/GlitchText';
import { AmbientGrid } from '@/components/AmbientGrid';
import { TerminalWindow } from '@/components/TerminalWindow';
import { ArchiveCard } from '@/components/ArchiveCard';
import { PixelButton } from '@/components/PixelButton';
import { AsciiSigil } from '@/components/AsciiSigil';
import { GreenText } from '@/components/GreenText';
import { ARCHIVE_ENTRIES, RECENT_THREADS } from '@/lib/sampleContent';

const CATEGORIES = [
  'TRIP REPORTS', 'CONFESSIONS', 'DREAMS', 'GLITCHES',
  'RELATIONSHIPS', 'PARANORMAL', 'SURVIVAL', 'CRYPTO', 'THEORIES',
];

const FEATURES = [
  ['ANON THREADS', 'Post stories as SWIM with no permanent identity. Green-text, markdown, hidden replies, and session ghosts.'],
  ['TEMP IDENTITIES', 'Generated ghost handles expire by session, 24h, or 7d. No names. No egos. Just ideas.'],
  ['THE ARCHIVE', 'Searchable vault of stories, reports, transmissions, and community lore. Saved by category and signal strength.'],
  ['MAP MODE', 'Anonymous pins for strange events, sightings, memories, and places that changed someone who isn\'t you.'],
  ['SWIM REACTIONS', 'No likes. Threads get swims, echoes, dives, ripples, and surfaces. Engagement becomes lore.'],
  ['TOKEN ACCESS', '$SWIM unlocks vault rooms, identity skins, archive boosts, encrypted rooms, and community voting.'],
];

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

export default function Home() {
  const [bootDone, setBootDone] = useState(false);
  const participants = useAnimatedCounter(247, 300, 2200);

  return (
    <>
      <BootSequence onComplete={() => setBootDone(true)} />

      <div className="relative min-h-screen">

        {/* ── HERO ──────────────────────────────────────── */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-16">
          <AmbientGrid className="absolute inset-0" />

          {/* Phosphor radial bloom */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 50% 38%, rgba(124,255,91,.07) 0%, transparent 62%)',
            }}
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: bootDone ? 1 : 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="relative z-10 flex flex-col items-center px-4 text-center"
          >
            {/* Sigils row */}
            <div className="mb-6 flex items-center gap-8 opacity-60">
              <AsciiSigil />
              <span className="hidden text-sm tracking-[.35em] text-crt/40 sm:block">
                THE ARCHIVE REMEMBERS
              </span>
              <AsciiSigil />
            </div>

            {/* Giant logo */}
            <GlitchText
              as="h1"
              intensity="low"
              className="crt-text-bright font-terminal text-[clamp(4rem,18vw,11rem)] leading-none tracking-tight"
            >
              $SWIM
            </GlitchText>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6 }}
              className="mt-4 text-[clamp(1rem,2.8vw,1.65rem)] tracking-[.18em] text-phosphor uppercase phosphor-glow"
            >
              Someone Who Isn&apos;t Me
            </motion.p>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 1.0 }}
              className="mx-auto mt-5 max-w-lg text-base text-crt/55 leading-relaxed"
            >
              An anonymous network for stories, confessions, strange reports,
              and transmissions that need no real name.
            </motion.p>

            {/* Network stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.3 }}
              className="mt-10 flex flex-wrap justify-center gap-5"
            >
              {[
                { label: 'PARTICIPANTS', value: bootDone ? participants.toString() : '0' },
                { label: 'ACTIVE THREADS', value: '1,337' },
                { label: 'ARCHIVE DEPTH', value: '∞' },
              ].map(({ label, value }) => (
                <div key={label} className="panel min-w-[110px] px-5 py-3 text-center">
                  <div className="text-2xl text-crt crt-text">{value}</div>
                  <div className="mt-1 text-[10px] tracking-widest text-crt/35 uppercase">{label}</div>
                </div>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.6 }}
              className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
            >
              <PixelButton href="/archive" size="lg">
                [ ENTER THE ARCHIVE ]
              </PixelButton>
              <PixelButton href="/threads" size="md" className="opacity-65">
                › BROWSE THREADS
              </PixelButton>
            </motion.div>

            {/* Scroll hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ duration: 1.2, delay: 2.4 }}
              className="mt-16 flex flex-col items-center gap-1 text-xs text-crt/40 tracking-[.25em]"
            >
              <span className="animate-drift inline-block">▼</span>
              <span>SCROLL TO EXPLORE</span>
            </motion.div>
          </motion.div>
        </section>

        {/* ── MAIN CONTENT ──────────────────────────────── */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 md:px-8">

          {/* Status bar */}
          <div className="mb-8 flex items-center justify-between border border-crt/20 px-4 py-2 text-sm tracking-widest">
            <span className="text-crt/45">SWIM NETWORK // OPEN PROTOCOL</span>
            <span className="hidden text-crt/25 md:block">
              CONNECTED: EVERYONE<span className="ml-2 blink">█</span>
            </span>
          </div>

          {/* 3-column: directories / welcome / active */}
          <section className="grid gap-6 lg:grid-cols-[250px_1fr_290px]">
            <TerminalWindow title="DIRECTORIES">
              <ul className="space-y-1.5 text-lg">
                {CATEGORIES.map(cat => (
                  <li key={cat}>
                    <Link
                      href="/archive"
                      className="flex items-center gap-2 text-crt/65 hover:text-crt transition-colors"
                    >
                      <span className="text-crt/25">›</span> {cat}
                    </Link>
                  </li>
                ))}
              </ul>
            </TerminalWindow>

            <TerminalWindow title="WELCOME THREAD">
              <div className="grid gap-6 md:grid-cols-[1fr_230px]">
                <div className="space-y-4">
                  <p className="text-sm text-phosphor/70">Anonymous — 05/15/01 03:33 AM</p>
                  <GreenText
                    text={`> We are all explorers.\n> We go alone.\n> To find the edge.\n> Then we share.\n\nFor someone\nwho isn't me.`}
                  />
                  <p className="text-sm text-crt/35">
                    &lt;&lt;&lt; END OF THREAD &gt;&gt;&gt;{' '}
                    <span className="blink">█</span>
                  </p>
                </div>
                <pre className="panel hidden min-h-44 items-center justify-center p-4 text-center text-base leading-[1.3] text-phosphor/75 md:flex">
{`      *      .
   .      ◇      *
      /\\____/\\
     /  o  o  \\
    (    --    )
     \\  ----  /
      \\______/`}
                </pre>
              </div>
            </TerminalWindow>

            <TerminalWindow title="ACTIVE NODES">
              <div className="space-y-2 text-xl">
                <p className="text-crt">&gt; {bootDone ? participants : 0} online</p>
                <p className="text-crt/55">&gt; 0 identified</p>
                <p className="text-phosphor/65">&gt; infinite potential</p>
              </div>
              <div className="mt-8 text-center text-xl crt-text animate-text-flicker">
                SWIM FOREVER
              </div>
            </TerminalWindow>
          </section>

          {/* Archive preview grid */}
          <section className="mt-8">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base tracking-widest text-crt/40 uppercase">
                // RECENT ARCHIVE ENTRIES
              </h2>
              <Link
                href="/archive"
                className="text-sm text-crt/35 hover:text-crt tracking-widest transition-colors"
              >
                VIEW ALL ›
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ARCHIVE_ENTRIES.slice(0, 6).map((entry, i) => (
                <ArchiveCard key={entry.id} {...entry} index={i} />
              ))}
            </div>
          </section>

          {/* Feature panels */}
          <section className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([title, body]) => (
              <TerminalWindow title={title} key={title}>
                <p className="text-sm text-crt/65 leading-relaxed">{body}</p>
              </TerminalWindow>
            ))}
          </section>

          {/* Recent logs + Build notes */}
          <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            <TerminalWindow title="RECENT LOGS">
              <div className="space-y-3">
                {RECENT_THREADS.map(t => (
                  <div
                    key={t.id}
                    className="border border-crt/12 p-3 cursor-pointer transition-colors hover:border-crt/30"
                  >
                    <div className="mb-1.5 flex justify-between text-xs text-crt/35 tracking-widest">
                      <span>{t.id}</span>
                      <span>{t.time}</span>
                    </div>
                    <p className="text-sm text-crt/70 leading-relaxed">&gt; {t.preview}</p>
                    <p className="mt-2 text-xs text-crt/25">{t.echoes} echoes</p>
                  </div>
                ))}
              </div>
            </TerminalWindow>

            <TerminalWindow title="BUILD NOTES" showCursor>
              <ul className="space-y-3 text-sm text-crt/60 leading-relaxed">
                <li className="flex gap-2"><span className="text-crt/25">›</span><span>Phase 1: static landing page <span className="text-crt/40">✓</span></span></li>
                <li className="flex gap-2"><span className="text-crt/25">›</span><span>Phase 2: anonymous threads</span></li>
                <li className="flex gap-2"><span className="text-crt/25">›</span><span>Phase 3: wallet optional</span></li>
                <li className="flex gap-2"><span className="text-crt/25">›</span><span>Phase 4: token-gated vaults</span></li>
                <li className="flex gap-2"><span className="text-crt/25">›</span><span>Phase 5: live rooms + map</span></li>
              </ul>
              <div className="mt-6 border-t border-crt/12 pt-4 text-[11px] text-crt/25 tracking-widest leading-loose">
                PROTOCOL: OPEN<br />
                IDENTITY: NONE<br />
                MISSION: ONGOING
              </div>
            </TerminalWindow>
          </section>

          {/* Footer */}
          <footer className="mt-12 border border-crt/18 p-6 text-center">
            <p className="crt-text text-lg tracking-[.15em] uppercase">
              NOT FINANCIAL ADVICE. THIS IS A CALLING.
            </p>
            <p className="mt-2 text-sm text-crt/40 tracking-[.2em]">
              WE SWIM TOGETHER.<span className="ml-2 blink">█</span>
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-5 text-xs text-crt/20 tracking-widest uppercase">
              {['/archive', '/threads', '/confessions', '/vault', '/map', '/signal'].map(r => (
                <Link key={r} href={r} className="hover:text-crt/45 transition-colors">
                  {r.slice(1)}
                </Link>
              ))}
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
