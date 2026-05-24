'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

import { AmbientGrid } from '@/components/AmbientGrid';
import { BootSequence } from '@/components/BootSequence';
import { ContentCard } from '@/components/ContentCard';
import { CreateThreadPanel } from '@/components/CreateThreadPanel';
import { GhostPanel } from '@/components/GhostPanel';
import { MobileActionBar } from '@/components/MobileActionBar';
import { SwimHeader } from '@/components/SwimHeader';
import { TerminalWindow } from '@/components/TerminalWindow';
import { mockDb } from '@/lib/mock-db';
import { CATEGORY_COLORS } from '@/lib/forum-types';
import { ThreadContent } from '@/lib/forum-types';

// Categories visible in the rail (primary boards)
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

export default function Home() {
  const [bootDone, setBootDone] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [clock, setClock] = useState('03:33:33');
  const [onlineTick, setOnlineTick] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const allThreads    = useMemo(() => mockDb.getHomepageThreads(), []);
  const hotThreads    = useMemo(() => mockDb.getHotThreads(), []);
  const ghost         = useMemo(() => mockDb.getGhostIdentity(), []);
  const recoveredEntries = useMemo(() => mockDb.getRecoveredEntries(), []);
  const worldEvents   = useMemo(() => mockDb.getWorldEvents(), []);
  const archiveMessages = useMemo(() => mockDb.getArchiveMessages(), []);
  const createDraft   = useMemo(() => mockDb.getCreateThreadDraft(), []);
  const seededCategories = useMemo(() => mockDb.getSeededCategories(), []);

  // Filtered thread list
  const homepageThreads = useMemo<ThreadContent[]>(() => {
    if (!activeCategory) return allThreads;
    return allThreads.filter((t) => t.category === activeCategory);
  }, [allThreads, activeCategory]);

  useEffect(() => {
    const rotate = window.setInterval(() => {
      setMessageIndex((c) => (c + 1) % archiveMessages.length);
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
  }, [archiveMessages.length]);

  const onlineCount  = useAnimatedCounter(mockDb.getOnlineSnapshot(onlineTick), 250, 1600);
  const participants = bootDone ? onlineCount : 0;
  const activeMessage   = archiveMessages[messageIndex];
  const rotatingRecovery = recoveredEntries[messageIndex % recoveredEntries.length];
  const rotatingEvent    = worldEvents[messageIndex % worldEvents.length];

  const boardLabel = activeCategory ?? 'stories';

  return (
    <>
      <BootSequence onComplete={() => setBootDone(true)} />
      <MobileActionBar />

      {/* pt-[52px] accounts for nav height (main row ~38px + status bar ~14px on desktop).
          On mobile, nav has no status bar so ~38px; pt-[42px] is tight but fine. */}
      <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[52px] soft-flicker md:pb-8">
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
          className="relative z-10 mx-auto max-w-7xl px-2.5 sm:px-3 md:px-4"
        >
          <section className="forum-shell">

            {/* ── SWIM HEADER — image bg + overlay navigation ── */}
            <SwimHeader
              participants={participants}
              clock={clock}
              statusIdx={messageIndex}
              categories={RAIL_CATEGORIES}
              activeCategory={activeCategory}
              onSelectCategory={setActiveCategory}
            />

            {/* ── MAIN GRID ───────────────────────────────── */}
            <div className="grid gap-3 px-2.5 py-3 lg:grid-cols-[minmax(0,1fr)_268px] md:px-4">

              {/* Left column */}
              <div className="space-y-3">

                {/* Status bar */}
                <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <div className="archive-stat px-3 py-2 text-[11px] text-crt/52">
                    board:{' '}
                    <span className="text-crt">/{boardLabel}/</span>
                    {' '}| note:{' '}
                    <span className="text-phosphor/55">{activeMessage}</span>
                  </div>
                  <div className="archive-stat px-3 py-2 text-[11px] text-crt/48">
                    awake:{' '}
                    <span className="text-crt">{participants}</span>
                  </div>
                  <div className="archive-stat flex items-center gap-2 px-3 py-2 text-[11px] text-crt/42">
                    <span className="text-crt">{clock}</span>
                    <span className="blink text-crt/35">█</span>
                  </div>
                </div>

                {/* ── Thread list ─── */}
                <section className="panel overflow-hidden">
                  {/* Panel header */}
                  <div className="flex items-center justify-between border-b border-crt/12 px-3 py-2 sm:px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 bg-crt/50 animate-pulse-glow"
                        aria-hidden="true"
                      />
                      <span className="text-[13px] uppercase tracking-[0.22em] text-crt">
                        {boardLabel}
                      </span>
                      {activeCategory && (
                        <button
                          onClick={() => setActiveCategory(null)}
                          className="text-[10px] uppercase tracking-[0.18em] text-crt/30 hover:text-crt/60 transition-colors"
                        >
                          [×&nbsp;all]
                        </button>
                      )}
                    </div>
                    <Link href="/threads" className="create-thread-cta text-[10px]">
                      [ + post thread ]
                    </Link>
                  </div>

                  {/* Column header (desktop) */}
                  <div className="hidden border-b border-crt/8 px-4 py-1.5 text-[9px] uppercase tracking-[0.24em] text-crt/22 md:grid md:grid-cols-[minmax(0,1fr)_80px_80px_110px_20px]">
                    <span>thread&nbsp;/&nbsp;topic</span>
                    <span>replies</span>
                    <span>views</span>
                    <span>last&nbsp;post</span>
                    <span />
                  </div>

                  {/* Thread rows */}
                  {homepageThreads.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[11px] uppercase tracking-[0.24em] text-crt/25">
                      no threads in this board yet
                    </div>
                  ) : (
                    <div>
                      {homepageThreads.map((thread) => {
                        const color = CATEGORY_COLORS[thread.category] ?? '#8ddf72';
                        return (
                          <Link
                            key={thread.id}
                            href={`/threads/${thread.id}`}
                            className="forum-row block px-3 py-4 md:grid md:grid-cols-[minmax(0,1fr)_80px_80px_110px_20px] md:items-center md:gap-3 md:px-4"
                          >
                            {/* Title block */}
                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span
                                  className="category-chip inline-flex px-2 py-0.5 text-[10px] uppercase tracking-[0.22em]"
                                  style={{ ['--category' as string]: color }}
                                >
                                  {thread.category}
                                </span>
                                {thread.pinned && (
                                  <span className="text-[9px] uppercase tracking-[0.2em] text-crt/28">
                                    hot
                                  </span>
                                )}
                              </div>

                              {/* Thread title — larger, cleaner */}
                              <div className="thread-title">{thread.title}</div>

                              {/* Last post preview — dimmer */}
                              <div className="mt-1 text-[0.9rem] leading-snug text-crt/32">
                                {thread.lastPostPreview}
                              </div>
                            </div>

                            {/* Replies */}
                            <div className="mt-3 md:mt-0">
                              <div className="text-[9px] uppercase tracking-[0.22em] text-crt/22 md:hidden">
                                replies
                              </div>
                              <div className="text-[1rem] text-crt/52">{thread.replyCount}</div>
                            </div>

                            {/* Views (desktop) */}
                            <div className="hidden text-[1rem] text-crt/48 md:block">
                              {thread.viewCount}
                            </div>

                            {/* Last activity (desktop) */}
                            <div className="hidden text-[0.95rem] text-crt/38 md:block">
                              {thread.lastActivityAt}
                            </div>

                            {/* Arrow (desktop) */}
                            <div className="hidden text-right text-[1rem] text-crt/25 md:block">
                              ›
                            </div>

                            {/* Mobile detail row */}
                            <div className="mt-2.5 grid grid-cols-2 gap-3 md:hidden">
                              <div>
                                <div className="text-[9px] uppercase tracking-[0.2em] text-crt/22">views</div>
                                <div className="text-[0.9rem] text-crt/45">{thread.viewCount}</div>
                              </div>
                              <div>
                                <div className="text-[9px] uppercase tracking-[0.2em] text-crt/22">last post</div>
                                <div className="text-[0.9rem] text-crt/40">{thread.lastActivityAt}</div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Post footer */}
                  <Link
                    href="/threads"
                    className="block border-t border-crt/10 px-4 py-2.5 text-center text-[11px] uppercase tracking-[0.3em] text-crt/40 hover:text-crt/65 transition-colors"
                  >
                    [ view all threads ]
                  </Link>
                </section>
              </div>

              {/* ── Sidebar ─────────────────────────────────── */}
              <aside className="space-y-3">
                {/* Welcome */}
                <TerminalWindow title="Welcome to $SWIM" version="2001.5.15" animate={false}>
                  <div className="space-y-1.5 text-[0.98rem] leading-tight text-crt/72">
                    <p>This is a free forum.</p>
                    <p>Anyone can post.</p>
                    <p>Anything goes.</p>
                    <p>No signups.</p>
                    <p>No tracking.</p>
                    <p>No bullshit.</p>
                    <div className="analog-rule my-2" />
                    <p>The internet remembers.</p>
                    <p className="pt-2 text-center text-crt/55 cursor::after">
                      SWIM FOREVER<span className="ml-1 blink">█</span>
                    </p>
                  </div>
                </TerminalWindow>

                {/* Hot threads */}
                <TerminalWindow title="Hot Threads" version="feed.04" animate={false}>
                  <div className="space-y-2 text-[0.95rem] leading-tight">
                    {hotThreads.map((item, index) => (
                      <div
                        key={item.id}
                        className={`leading-snug ${index === 0 ? 'text-[#c97c44]' : 'text-crt/58'}`}
                      >
                        <span className="text-[9px] uppercase tracking-[0.2em] opacity-50">
                          {item.category}:
                        </span>{' '}
                        {item.title}
                      </div>
                    ))}
                    <div className="pt-1.5 text-right text-[10px] text-crt/35">
                      [ more ]
                    </div>
                  </div>
                </TerminalWindow>

                {/* System notices */}
                <TerminalWindow title="System Notices" version="night.02" animate={false}>
                  <div className="space-y-2 text-[0.92rem] leading-tight text-crt/60">
                    <p className="category-chip-muted px-2 py-1.5" style={{ ['--category' as string]: '#86d46e' }}>
                      {rotatingEvent.timestamp}&nbsp;/&nbsp;{rotatingEvent.message}
                    </p>
                    <p className="category-chip-muted px-2 py-1.5" style={{ ['--category' as string]: '#7aa8ff' }}>
                      signal instability detected near /ai/ archive mirror
                    </p>
                    <p className="category-chip-muted px-2 py-1.5" style={{ ['--category' as string]: '#b8c97a' }}>
                      thread recovered:&nbsp;{rotatingRecovery.archiveCode}
                    </p>
                  </div>
                </TerminalWindow>
              </aside>
            </div>

            {/* ── FOOTER STRIP ────────────────────────────── */}
            <div className="grid gap-px border-t border-crt/10 bg-crt/[0.04] md:grid-cols-[200px_1fr_220px]">
              <div className="bg-[rgba(2,3,3,.97)] px-4 py-2 text-[0.9rem] leading-tight text-crt/45">
                <div>someone who isn&apos;t me</div>
                <div className="text-crt/28">the archive remembers.</div>
              </div>
              <div className="bg-[rgba(2,3,3,.97)] px-4 py-2 text-[0.9rem] leading-tight text-crt/32">
                <div>signal archived.</div>
                <div>ghost identity scaffolded.</div>
              </div>
              <div className="bg-[rgba(2,3,3,.97)] px-4 py-2 text-right text-[0.9rem] leading-tight text-crt/38">
                <div>{clock}</div>
                <div className="text-crt/25">may 15, 2001</div>
              </div>
            </div>
          </section>

          {/* ── BELOW-FOLD SECTION ──────────────────────── */}
          <section className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_310px]">
            <div className="space-y-3">
              <GhostPanel ghost={ghost} />
              <CreateThreadPanel draft={createDraft} categories={seededCategories} />

              <TerminalWindow title="Recovered Archive Entries" version="reindex.3" animate={false}>
                <div className="mb-3 flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-crt/28">
                  <span>archive recoveries</span>
                  <span className="micro-blip text-crt/25">drifting through SWIM</span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {recoveredEntries.map((item, index) => (
                    <ContentCard key={item.id} item={item} index={index} compact />
                  ))}
                </div>
              </TerminalWindow>
            </div>

            {/* Right sidebar */}
            <div className="space-y-3">
              {/* Archive navigation — category list */}
              <TerminalWindow title="Archive Navigation" version="mirror.9" animate={false}>
                <div className="mb-2 text-[9px] uppercase tracking-[0.22em] text-crt/24">
                  board index / old nodes / hidden archive
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {seededCategories.map((name) => (
                    <Link
                      href="/archive"
                      key={name}
                      className="category-chip-muted faint-hover px-2.5 py-1.5 text-[0.9rem] transition-colors hover:text-crt"
                      style={{ ['--category' as string]: CATEGORY_COLORS[name] ?? '#86d46e' }}
                    >
                      {name}
                    </Link>
                  ))}
                </div>
              </TerminalWindow>

              {/* Active world */}
              <TerminalWindow title="Active World" version="presence.2" animate={false}>
                <div className="mb-2 text-[9px] uppercase tracking-[0.22em] text-crt/24">
                  currently drifting through SWIM
                </div>
                <div className="grid grid-cols-2 gap-2 text-[0.95rem]">
                  {[
                    { v: participants, l: 'anonymous' },
                    { v: 19, l: 'lurking' },
                    { v: 7, l: 'posting now' },
                    { v: 1, l: 'new node' },
                  ].map(({ v, l }) => (
                    <div key={l} className="archive-stat px-2.5 py-2">
                      <div className="text-crt">{v}</div>
                      <div className="text-[0.82rem] text-crt/28">{l}</div>
                    </div>
                  ))}
                </div>
              </TerminalWindow>

              {/* Archive drift */}
              <TerminalWindow title="Archive Drift" version="rotating.msg" animate={false} showCursor>
                <div className="text-[0.98rem] leading-relaxed text-phosphor/60">
                  {activeMessage}
                </div>
              </TerminalWindow>
            </div>
          </section>
        </motion.div>
      </div>
    </>
  );
}
