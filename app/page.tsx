'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

import { AmbientGrid } from '@/components/AmbientGrid';
import { AsciiSigil } from '@/components/AsciiSigil';
import { BootSequence } from '@/components/BootSequence';
import { ContentCard } from '@/components/ContentCard';
import { CreateThreadPanel } from '@/components/CreateThreadPanel';
import { GhostPanel } from '@/components/GhostPanel';
import { TerminalWindow } from '@/components/TerminalWindow';
import { mockDb } from '@/lib/mock-db';
import { CATEGORY_COLORS } from '@/lib/forum-types';

const TOP_NAV = [
  'Stories',
  'Philosophy',
  'Technology',
  'UFOs',
  'Dreams',
  'Art',
  'Music',
  'Crypto Trench',
  'Politics',
  'Paranormal',
  'AI',
  'About',
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

  const homepageThreads = useMemo(() => mockDb.getHomepageThreads(), []);
  const hotThreads = useMemo(() => mockDb.getHotThreads(), []);
  const ghost = useMemo(() => mockDb.getGhostIdentity(), []);
  const recoveredEntries = useMemo(() => mockDb.getRecoveredEntries(), []);
  const worldEvents = useMemo(() => mockDb.getWorldEvents(), []);
  const archiveMessages = useMemo(() => mockDb.getArchiveMessages(), []);
  const createDraft = useMemo(() => mockDb.getCreateThreadDraft(), []);
  const seededCategories = useMemo(() => mockDb.getSeededCategories(), []);

  useEffect(() => {
    const rotate = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % archiveMessages.length);
      setOnlineTick((current) => current + 1);
    }, 5200);

    const tick = window.setInterval(() => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setClock(time);
    }, 1000);

    return () => {
      window.clearInterval(rotate);
      window.clearInterval(tick);
    };
  }, [archiveMessages.length]);

  const onlineCount = useAnimatedCounter(mockDb.getOnlineSnapshot(onlineTick), 250, 1600);
  const participants = bootDone ? onlineCount : 0;
  const activeMessage = archiveMessages[messageIndex];
  const rotatingRecovery = recoveredEntries[messageIndex % recoveredEntries.length];
  const rotatingEvent = worldEvents[messageIndex % worldEvents.length];

  return (
    <>
      <BootSequence onComplete={() => setBootDone(true)} />

      <div className="relative min-h-screen overflow-hidden pb-8 pt-12 soft-flicker">
        <AmbientGrid className="absolute inset-0 opacity-30" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 4%, rgba(141,223,114,.05), transparent 20rem)',
          }}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: bootDone ? 1 : 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="relative z-10 mx-auto max-w-7xl px-2.5 sm:px-3 md:px-4"
        >
          <section className="forum-shell">
            <div className="grid gap-3 border-b border-crt/12 px-3 py-3 md:grid-cols-[170px_1fr_170px] md:px-4">
              <div className="hidden text-[1rem] leading-tight text-crt/58 md:block">
                <div className="mb-1 text-crt/72 uppercase tracking-[0.35em]">the archive</div>
                <div>remembers.</div>
                <div className="mt-2 text-crt/28">late mirror</div>
                <div className="text-crt/28">edition</div>
              </div>

              <div className="text-center">
                <div className="mb-1 text-[10px] uppercase tracking-[0.52em] text-crt/58">
                  SOMEONE WHO ISN&apos;T ME
                </div>
                <div className="flex items-center justify-center gap-2.5 text-crt/42">
                  <AsciiSigil />
                  <h1 className="crt-text-bright text-[clamp(2.9rem,12vw,6.7rem)] leading-none tracking-[0.14em]">
                    $SWIM
                  </h1>
                  <AsciiSigil />
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-phosphor/68">
                  no accounts. no ids. no tracking. just minds.
                </div>
              </div>

              <div className="text-left text-[1rem] leading-tight text-crt/58 md:text-right">
                <div>explore.</div>
                <div>learn.</div>
                <div>share.</div>
                <div>remember.</div>
              </div>
            </div>

            <div className="border-b border-crt/12 px-2 py-1.5 md:px-3">
              <div className="flex gap-1 overflow-x-auto whitespace-nowrap pb-1 text-[11px] uppercase tracking-[0.16em]">
                {TOP_NAV.map((item) => {
                  const color =
                    CATEGORY_COLORS[item] ??
                    (item === 'About' ? '#7eb5d6' : '#8ddf72');
                  return (
                    <span
                      key={item}
                      className="forum-tab inline-flex items-center px-2.5 py-1.5"
                      style={{ color }}
                    >
                      {item}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="border-b border-crt/12 px-3 py-1.5 text-center text-[10px] uppercase tracking-[0.3em] text-crt/58 md:px-4">
              anyone can post. anything goes. the internet remembers.
            </div>

            <div className="grid gap-3 px-2.5 py-3 lg:grid-cols-[minmax(0,1fr)_276px] md:px-4">
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <div className="archive-stat px-3 py-2 text-[12px] text-crt/56">
                    active board: <span className="text-crt">/stories/</span> | archive note:{' '}
                    <span className="text-phosphor/62">{activeMessage}</span>
                  </div>
                  <div className="archive-stat px-3 py-2 text-[12px] text-crt/52">
                    users awake: <span className="text-crt">{participants}</span>
                  </div>
                  <div className="archive-stat px-3 py-2 text-[12px] text-crt/52">
                    mt time: <span className="text-crt">{clock}</span>
                  </div>
                </div>

                <section className="panel overflow-hidden">
                  <div className="flex items-center justify-between border-b border-crt/12 px-3 py-2 sm:px-4">
                    <div className="text-base uppercase tracking-[0.22em] text-crt">
                      stories
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-crt/32">
                      index / topic
                    </div>
                  </div>

                  <div className="hidden border-b border-crt/10 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-crt/28 md:grid md:grid-cols-[minmax(0,1fr)_90px_90px_120px_24px]">
                    <span>thread / topic</span>
                    <span>replies</span>
                    <span>views</span>
                    <span>last post</span>
                    <span />
                  </div>

                  <div>
                    {homepageThreads.map((thread) => {
                      const color = CATEGORY_COLORS[thread.category] ?? '#8ddf72';
                      return (
                        <div
                          key={thread.id}
                          className="forum-row px-3 py-3.5 md:grid md:grid-cols-[minmax(0,1fr)_90px_90px_120px_24px] md:items-center md:gap-3 md:px-4"
                        >
                          <div className="min-w-0">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <span
                                className="category-chip inline-flex px-2 py-0.5 text-[11px] uppercase tracking-[0.22em]"
                                style={{ ['--category' as string]: color }}
                              >
                                {thread.category}
                              </span>
                              <span className="text-[10px] uppercase tracking-[0.18em] text-crt/28">
                                {thread.pinned ? 'hot' : 'active'}
                              </span>
                            </div>
                            <div className="text-[1.18rem] leading-tight text-crt md:text-[1.34rem]">
                              {thread.title}
                            </div>
                            <div className="mt-1 text-[0.98rem] leading-snug text-crt/38 md:text-[1rem]">
                              last post: {thread.lastPostPreview}
                            </div>
                          </div>

                          <div className="mt-3 text-[1rem] text-crt/58 md:mt-0 md:text-[1.08rem]">
                            <div className="md:hidden text-[10px] uppercase tracking-[0.2em] text-crt/28">
                              replies
                            </div>
                            <div>{thread.replyCount}</div>
                          </div>

                          <div className="hidden text-[1.08rem] text-crt/58 md:block">{thread.viewCount}</div>
                          <div className="hidden text-[1.02rem] text-crt/46 md:block">{thread.lastActivityAt}</div>
                          <div className="hidden text-right text-[1.15rem] text-crt/34 md:block">&gt;</div>

                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-crt/46 md:hidden">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.2em] text-crt/28">views</div>
                              <div className="text-base text-crt/58">{thread.viewCount}</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.2em] text-crt/28">last post</div>
                              <div className="text-base text-crt/52">{thread.lastActivityAt}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-crt/10 px-4 py-2 text-center text-[1rem] uppercase tracking-[0.3em] text-crt/58">
                    [ post a new thread ]
                  </div>
                </section>
              </div>

              <aside className="space-y-3">
                <TerminalWindow title="Welcome to $SWIM" version="2001.5.15" animate={false}>
                  <div className="space-y-2 text-[1.06rem] leading-tight text-crt/78">
                    <p>This is a free forum.</p>
                    <p>Anyone can post.</p>
                    <p>Anything goes.</p>
                    <p>No signups.</p>
                    <p>No tracking.</p>
                    <p>No bullshit.</p>
                    <div className="analog-rule my-2" />
                    <p>The internet remembers.</p>
                    <p className="pt-3 text-center text-crt/64">SWIM FOREVER</p>
                  </div>
                </TerminalWindow>

                <TerminalWindow title="Hot Threads" version="feed.04" animate={false}>
                  <div className="space-y-2 text-[1.02rem] leading-tight">
                    {hotThreads.map((item, index) => (
                      <div key={item.id} className={index === 0 ? 'text-[#c97c44]' : 'text-crt/68'}>
                        {item.category}: {item.title}
                      </div>
                    ))}
                    <div className="pt-2 text-right text-crt/42">[ more ]</div>
                  </div>
                </TerminalWindow>

                <TerminalWindow title="System Notices" version="night.02" animate={false}>
                  <div className="space-y-2 text-[1rem] leading-tight text-crt/66">
                    <p className="category-chip-muted px-3 py-2" style={{ ['--category' as string]: '#8ddf72' }}>
                      {rotatingEvent.timestamp} / {rotatingEvent.message}
                    </p>
                    <p className="category-chip-muted px-3 py-2" style={{ ['--category' as string]: '#7aa8ff' }}>
                      signal instability detected near /ai/ archive mirror
                    </p>
                    <p className="category-chip-muted px-3 py-2" style={{ ['--category' as string]: '#b8c97a' }}>
                      thread recovered from dead node: {rotatingRecovery.archiveCode}
                    </p>
                  </div>
                </TerminalWindow>
              </aside>
            </div>

            <div className="grid gap-px border-t border-crt/12 bg-crt/10 md:grid-cols-[220px_1fr_240px]">
              <div className="bg-[rgba(2,3,3,.96)] px-4 py-2.5 text-[0.98rem] leading-tight text-crt/54">
                <div className="mb-1">someone who isn&apos;t me</div>
                <div>the archive remembers.</div>
              </div>
              <div className="bg-[rgba(2,3,3,.96)] px-4 py-2.5 text-[0.98rem] leading-tight text-crt/42">
                <div>signal archived.</div>
                <div>ghost identity scaffolded.</div>
                <div>corrupted snippet withheld.</div>
              </div>
              <div className="bg-[rgba(2,3,3,.96)] px-4 py-2.5 text-right text-[0.98rem] leading-tight text-crt/48 md:text-right">
                <div>{clock}</div>
                <div>may 15, 2001</div>
                <div>connected: everyone</div>
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <GhostPanel ghost={ghost} />
              <CreateThreadPanel draft={createDraft} categories={seededCategories} />

              <TerminalWindow title="Recovered Archive Entries" version="reindex.3" animate={false}>
                <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-crt/30">
                  <span>archive recoveries</span>
                  <span className="micro-blip">currently drifting through SWIM</span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {recoveredEntries.map((item, index) => (
                    <ContentCard key={item.id} item={item} index={index} compact />
                  ))}
                </div>
              </TerminalWindow>
            </div>

            <div className="space-y-3">
              <TerminalWindow title="Archive Navigation" version="mirror.9" animate={false}>
                <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-crt/28">
                  board index / old nodes / hidden archive references
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {seededCategories.map((name) => (
                    <Link
                      href="/archive"
                      key={name}
                      className="category-chip-muted faint-hover px-3 py-1.5 text-[0.98rem] transition-colors hover:text-crt"
                      style={{ ['--category' as string]: CATEGORY_COLORS[name] ?? '#8ddf72' }}
                    >
                      {name}
                    </Link>
                  ))}
                </div>
              </TerminalWindow>

              <TerminalWindow title="Active World" version="presence.2" animate={false}>
                <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-crt/28">
                  currently drifting through SWIM
                </div>
                <div className="grid grid-cols-2 gap-2 text-[1.02rem]">
                  <div className="archive-stat px-3 py-2">
                    <div className="text-crt">{participants}</div>
                    <div className="text-[0.92rem] text-crt/34">anonymous</div>
                  </div>
                  <div className="archive-stat px-3 py-2">
                    <div className="text-crt">19</div>
                    <div className="text-[0.92rem] text-crt/34">lurkers</div>
                  </div>
                  <div className="archive-stat px-3 py-2">
                    <div className="text-crt">7</div>
                    <div className="text-[0.92rem] text-crt/34">posting now</div>
                  </div>
                  <div className="archive-stat px-3 py-2">
                    <div className="text-crt">1</div>
                    <div className="text-[0.92rem] text-crt/34">new node</div>
                  </div>
                </div>
              </TerminalWindow>

              <TerminalWindow title="Archive Drift" version="rotating.msg" animate={false} showCursor>
                <div className="text-[1.06rem] leading-tight text-phosphor/68">
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
