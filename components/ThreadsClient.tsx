'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { AmbientGrid } from '@/components/AmbientGrid';
import { CategoryRail } from '@/components/CategoryRail';
import { CreateThreadPanel } from '@/components/CreateThreadPanel';
import { HotThreadsModule } from '@/components/HotThreadsModule';
import { NetworkFooter } from '@/components/NetworkFooter';
import { SignalTicker } from '@/components/SignalTicker';
import { CATEGORY_COLORS } from '@/lib/forum-types';
import type { Category, CreateThreadDraft, GhostIdentity, ThreadContent } from '@/lib/forum-types';

const ALL_THREAD_CATEGORIES = [
  'Stories', 'Philosophy', 'Technology', 'UFOs', 'Dreams',
  'Art', 'Music', 'Crypto Trench', 'Politics', 'Paranormal',
  'AI', 'Simulation Theory', 'Lost Media', 'Dark Web Lore',
  'Conspiracy Theory', 'Hidden History',
] as const;

function isNewThread(createdAt: string): boolean {
  try {
    const t = new Date(createdAt).getTime();
    if (isNaN(t)) return false;
    const age = Date.now() - t;
    return age >= 0 && age < 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isHotThread(replyCount: number): boolean {
  return replyCount >= 5;
}

interface ThreadsClientProps {
  initialThreads: ThreadContent[];
  initialHotThreads: ThreadContent[];
  initialCategory: string | null;
  initialCompose: boolean;
  ghost: GhostIdentity;
  draft: CreateThreadDraft;
  categories: readonly Category[];
}

export function ThreadsClient({
  initialThreads,
  initialHotThreads,
  initialCategory,
  initialCompose,
  draft,
  categories,
}: ThreadsClientProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory);
  const [showCompose, setShowCompose] = useState(initialCompose);

  function handleCategorySelect(cat: string | null) {
    setActiveCategory(cat);
    const url = new URL(window.location.href);
    if (cat) url.searchParams.set('category', cat);
    else url.searchParams.delete('category');
    url.searchParams.delete('compose');
    window.history.replaceState(null, '', url.toString());
  }

  const threads = useMemo(() => {
    if (!activeCategory) return initialThreads;
    return initialThreads.filter((t) => t.category === activeCategory);
  }, [initialThreads, activeCategory]);

  const categoryColor =
    activeCategory
      ? (CATEGORY_COLORS[activeCategory as Category] ?? '#86d46e')
      : '#86d46e';

  return (
    <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[80px] md:pb-8 md:pt-[100px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">

        {/* ── Board header ── */}
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            {activeCategory ? (
              <>
                <div className="text-[12px] uppercase tracking-[0.28em] text-crt/50">
                  ← <button
                    onClick={() => handleCategorySelect(null)}
                    className="hover:text-crt/75 transition-colors"
                  >
                    all boards
                  </button>
                </div>
                <h1
                  className="mt-0.5 text-[1.7rem] tracking-[0.1em] md:text-[2.1rem]"
                  style={{ color: categoryColor }}
                >
                  {activeCategory}
                </h1>
              </>
            ) : (
              <>
                <div className="text-[12px] uppercase tracking-[0.30em] text-crt/50">
                  swim network
                </div>
                <h1 className="mt-0.5 text-[1.7rem] tracking-[0.14em] text-crt md:text-[2.1rem]">
                  THREADS
                </h1>
              </>
            )}
          </div>
          <button
            onClick={() => setShowCompose((v) => !v)}
            className="create-thread-cta shrink-0"
          >
            {showCompose ? '[ × close ]' : '[ + new thread ]'}
          </button>
        </div>

        {/* Compose panel */}
        {showCompose && (
          <div className="mb-3">
            <CreateThreadPanel draft={draft} categories={categories} />
          </div>
        )}

        {/* ── Category rail ── */}
        <div className="mb-3 forum-shell overflow-hidden">
          <CategoryRail
            categories={ALL_THREAD_CATEGORIES}
            active={activeCategory}
            onSelect={handleCategorySelect}
          />
          <SignalTicker />
        </div>

        {/* ── Main grid ── */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">

          {/* Thread table */}
          <section className="forum-shell overflow-hidden">

            {/* Table header */}
            <div className="flex items-center justify-between border-b border-crt/12 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <span
                  className="h-2 w-2 animate-pulse-glow"
                  style={{ background: activeCategory ? categoryColor : 'rgba(134,212,110,0.5)' }}
                  aria-hidden="true"
                />
                <span className="text-[16px] uppercase tracking-[0.18em] text-crt">
                  {activeCategory ?? 'all threads'}
                </span>
                {activeCategory && (
                  <button
                    onClick={() => handleCategorySelect(null)}
                    className="text-[13px] uppercase tracking-[0.14em] text-crt/48 hover:text-crt/75 transition-colors"
                  >
                    [× all]
                  </button>
                )}
              </div>
              <span className="text-[14px] uppercase tracking-[0.16em] text-crt/50">
                {threads.length} threads
              </span>
            </div>

            {/* Terminal card grid */}
            {threads.length === 0 ? (
              <div className="px-5 py-12 text-center text-[13px] uppercase tracking-[0.22em] text-crt/42">
                no threads in this board yet
              </div>
            ) : (
              <div className="terminal-card-grid p-4 md:p-5">
                {threads.map((thread) => {
                  const color = CATEGORY_COLORS[thread.category] ?? '#86d46e';
                  const fresh = isNewThread(thread.createdAt);
                  const hot = isHotThread(thread.replyCount);
                  return (
                    <Link
                      key={thread.id}
                      href={`/threads/${thread.id}`}
                      className="terminal-card group px-5 py-5 md:px-7 md:py-6"
                    >
                      {/* Top row: category + status markers */}
                      <div className="mb-2.5 flex flex-wrap items-center gap-2">
                        {!activeCategory && (
                          <span
                            className="category-chip inline-flex px-2.5 py-0.5 text-[11px] uppercase tracking-[0.16em]"
                            style={{ ['--category' as string]: color }}
                          >
                            {thread.category}
                          </span>
                        )}
                        {thread.pinned && (
                          <span className="thread-marker-pin">■ pinned</span>
                        )}
                        {fresh && (
                          <span className="thread-marker-new">◉ new</span>
                        )}
                        {hot && !fresh && (
                          <span className="thread-marker-hot">↯ active</span>
                        )}
                      </div>

                      {/* Title */}
                      <div className="thread-title">{thread.title}</div>

                      {/* Excerpt */}
                      {thread.lastPostPreview && (
                        <div className="thread-preview">{thread.lastPostPreview}</div>
                      )}

                      {/* Single metadata line */}
                      <div className="mt-3 text-[13px] uppercase tracking-[0.14em] text-crt/42">
                        {thread.replyCount} replies
                        <span className="mx-2 text-crt/22">·</span>
                        {thread.viewCount} views
                        <span className="mx-2 text-crt/22">·</span>
                        {thread.lastActivityAt}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="border-t border-crt/8 px-5 py-3 text-center text-[14px] uppercase tracking-[0.18em] text-crt/45">
              {threads.length} threads · no accounts · anonymous participation
            </div>
          </section>

          {/* ── Sidebar ── */}
          <aside className="space-y-3">

            {/* Hot threads */}
            <HotThreadsModule
              threads={initialHotThreads}
              title="ACTIVE SIGNALS"
              limit={4}
            />

            {/* Board info when category is active */}
            {activeCategory && (
              <div className="panel overflow-hidden">
                <div className="border-b border-crt/12 px-3 py-2">
                  <span className="text-[12px] uppercase tracking-[0.20em] text-crt/52">board</span>
                </div>
                <div className="px-3 py-3 text-[12px] uppercase tracking-[0.18em] text-crt/55 space-y-1.5">
                  <div
                    className="text-[1.05rem] tracking-[0.1em]"
                    style={{ color: categoryColor }}
                  >
                    {activeCategory}
                  </div>
                  <div className="text-crt/42 pt-1">{threads.length} threads archived</div>
                  <div className="text-crt/35">anonymous · no tracking</div>
                </div>
              </div>
            )}

            {/* Posting rules */}
            <div className="panel overflow-hidden">
              <div className="border-b border-crt/12 px-3 py-2">
                <span className="text-[13px] uppercase tracking-[0.20em] text-crt/72">Posting Rules</span>
              </div>
              <div className="space-y-1.5 p-3 text-[1.05rem] leading-tight text-crt/68">
                <p>no accounts required</p>
                <p>ghost handle is optional</p>
                <p>anything goes</p>
                <p>no tracking</p>
                <p>the archive remembers</p>
                <div className="analog-rule my-2" />
                <p className="text-crt/45">&gt; for greentext</p>
                <p className="text-crt/45">ctrl+enter to post</p>
              </div>
            </div>

            {/* Network links */}
            <NetworkFooter />
          </aside>
        </div>
      </div>
    </div>
  );
}
