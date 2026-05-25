'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { AmbientGrid } from '@/components/AmbientGrid';
import { CategoryRail } from '@/components/CategoryRail';
import { CreateThreadPanel } from '@/components/CreateThreadPanel';
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

interface ThreadsClientProps {
  initialThreads: ThreadContent[];
  initialCategory: string | null;
  initialCompose: boolean;
  ghost: GhostIdentity;
  draft: CreateThreadDraft;
  categories: readonly Category[];
}

export function ThreadsClient({
  initialThreads,
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
    <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[68px] md:pb-8 md:pt-[80px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative z-10 mx-auto max-w-7xl px-2.5 py-3 sm:px-3 md:px-4 md:py-5">

        {/* ── Board header ── */}
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            {activeCategory ? (
              <>
                <div className="text-[9px] uppercase tracking-[0.36em] text-crt/28">
                  ← <button
                    onClick={() => handleCategorySelect(null)}
                    className="hover:text-crt/55 transition-colors"
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
                <div className="text-[9px] uppercase tracking-[0.38em] text-crt/28">
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
        </div>

        {/* ── Main grid ── */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">

          {/* Thread table */}
          <section className="forum-shell overflow-hidden">

            {/* Table header */}
            <div className="flex items-center justify-between border-b border-crt/12 px-3 py-2 sm:px-4">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 animate-pulse-glow"
                  style={{ background: activeCategory ? categoryColor : 'rgba(134,212,110,0.5)' }}
                  aria-hidden="true"
                />
                <span className="text-[12px] uppercase tracking-[0.22em] text-crt">
                  {activeCategory ?? 'all threads'}
                </span>
                {activeCategory && (
                  <button
                    onClick={() => handleCategorySelect(null)}
                    className="text-[10px] uppercase tracking-[0.18em] text-crt/28 hover:text-crt/55 transition-colors"
                  >
                    [× all]
                  </button>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-[0.22em] text-crt/25">
                {threads.length} threads
              </span>
            </div>

            {/* Desktop column headers */}
            <div className="hidden border-b border-crt/8 px-4 py-1.5 text-[9px] uppercase tracking-[0.24em] text-crt/20 md:grid md:grid-cols-[minmax(0,1fr)_80px_80px_110px_20px]">
              <span>thread / topic</span>
              <span>replies</span>
              <span>views</span>
              <span>last post</span>
              <span />
            </div>

            {threads.length === 0 ? (
              <div className="px-4 py-10 text-center text-[11px] uppercase tracking-[0.24em] text-crt/22">
                no threads in this board yet
              </div>
            ) : (
              threads.map((thread) => {
                const color = CATEGORY_COLORS[thread.category] ?? '#86d46e';
                const fresh = isNewThread(thread.createdAt);
                return (
                  <Link
                    key={thread.id}
                    href={`/threads/${thread.id}`}
                    className="forum-row block px-3 py-3.5 md:grid md:grid-cols-[minmax(0,1fr)_80px_80px_110px_20px] md:items-center md:gap-3 md:px-4"
                  >
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {/* Hide category chip when browsing a board — it's redundant */}
                        {!activeCategory && (
                          <span
                            className="category-chip inline-flex px-2 py-0.5 text-[10px] uppercase tracking-[0.22em]"
                            style={{ ['--category' as string]: color }}
                          >
                            {thread.category}
                          </span>
                        )}
                        {thread.pinned && (
                          <span className="text-[9px] uppercase tracking-[0.2em] text-crt/38">■ pinned</span>
                        )}
                        {fresh && (
                          <span className="text-[9px] uppercase tracking-[0.2em] text-phosphor/80">[new]</span>
                        )}
                      </div>
                      <div className="thread-title">{thread.title}</div>
                      {thread.lastPostPreview && (
                        <div className="mt-1 text-[0.88rem] leading-snug text-crt/30 md:text-crt/28">
                          {thread.lastPostPreview}
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 md:mt-0">
                      <div className="text-[9px] uppercase tracking-[0.22em] text-crt/22 md:hidden">replies</div>
                      <div className="text-[0.98rem] text-crt/50">{thread.replyCount}</div>
                    </div>
                    <div className="hidden text-[0.98rem] text-crt/45 md:block">{thread.viewCount}</div>
                    <div className="hidden text-[0.92rem] text-crt/35 md:block">{thread.lastActivityAt}</div>
                    <div className="hidden text-right text-[1.1rem] text-crt/25 md:block">›</div>
                  </Link>
                );
              })
            )}

            <div className="border-t border-crt/8 px-4 py-2 text-center text-[9px] uppercase tracking-[0.26em] text-crt/22">
              {threads.length} threads · no accounts · anonymous participation
            </div>
          </section>

          {/* ── Sidebar ── */}
          <aside className="space-y-3">

            {/* Board info when category is active */}
            {activeCategory && (
              <div className="panel overflow-hidden">
                <div className="border-b border-crt/12 px-3 py-2">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-crt/32">board</span>
                </div>
                <div className="px-3 py-3 text-[10px] uppercase tracking-[0.2em] text-crt/35 space-y-1.5">
                  <div
                    className="text-[0.95rem] tracking-[0.1em]"
                    style={{ color: categoryColor }}
                  >
                    {activeCategory}
                  </div>
                  <div className="text-crt/22 pt-1">{threads.length} threads archived</div>
                  <div className="text-crt/18">anonymous · no tracking</div>
                </div>
              </div>
            )}

            {/* Posting rules */}
            <div className="panel overflow-hidden">
              <div className="border-b border-crt/12 px-3 py-2">
                <span className="text-[12px] uppercase tracking-[0.22em] text-crt/60">Posting Rules</span>
              </div>
              <div className="space-y-1.5 p-3 text-[0.98rem] leading-tight text-crt/50">
                <p>no accounts required</p>
                <p>ghost handle is optional</p>
                <p>anything goes</p>
                <p>no tracking</p>
                <p>the archive remembers</p>
                <div className="analog-rule my-2" />
                <p className="text-crt/28">&gt; for greentext</p>
                <p className="text-crt/28">ctrl+enter to post</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
