'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { AmbientGrid } from '@/components/AmbientGrid';
import { CategoryRail } from '@/components/CategoryRail';
import { CreateThreadPanel } from '@/components/CreateThreadPanel';
import { GhostPanel } from '@/components/GhostPanel';
import { mockDb } from '@/lib/mock-db';
import { CATEGORY_COLORS } from '@/lib/forum-types';

const ALL_THREAD_CATEGORIES = [
  'Stories', 'Philosophy', 'Technology', 'UFOs', 'Dreams',
  'Art', 'Music', 'Crypto Trench', 'Politics', 'Paranormal',
  'AI', 'Simulation Theory', 'Lost Media', 'Dark Web Lore',
  'Conspiracy Theory', 'Hidden History',
] as const;

export default function ThreadsPage() {
  const allThreads = useMemo(() => mockDb.getThreads(), []);
  const ghost = useMemo(() => mockDb.getGhostIdentity(), []);
  const draft = useMemo(() => mockDb.getCreateThreadDraft(), []);
  const categories = useMemo(() => mockDb.getSeededCategories(), []);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  const threads = useMemo(() => {
    if (!activeCategory) return allThreads;
    return allThreads.filter((t) => t.category === activeCategory);
  }, [allThreads, activeCategory]);

  return (
    <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[52px] md:pb-8">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative z-10 mx-auto max-w-7xl px-2.5 py-4 sm:px-3 md:px-4 md:py-6">

        {/* Page header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-[0.38em] text-crt/32">
              swim network
            </div>
            <h1 className="text-[1.6rem] tracking-[0.14em] text-crt md:text-[2rem]">
              THREADS
            </h1>
          </div>
          <button
            onClick={() => setShowCompose((v) => !v)}
            className="create-thread-cta"
          >
            {showCompose ? '[ × close ]' : '[ + create thread ]'}
          </button>
        </div>

        {/* Compose panel (toggled) */}
        {showCompose && (
          <div className="mb-4">
            <CreateThreadPanel draft={draft} categories={categories} />
          </div>
        )}

        {/* Category rail */}
        <div className="mb-4 forum-shell overflow-hidden">
          <CategoryRail
            categories={ALL_THREAD_CATEGORIES}
            active={activeCategory}
            onSelect={setActiveCategory}
          />
        </div>

        {/* Main grid */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">

          {/* Thread table */}
          <section className="forum-shell overflow-hidden">
            <div className="flex items-center justify-between border-b border-crt/12 px-3 py-2 sm:px-4">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-crt/50 animate-pulse-glow" aria-hidden="true" />
                <span className="text-[13px] uppercase tracking-[0.22em] text-crt">
                  {activeCategory ?? 'all threads'}
                </span>
                {activeCategory && (
                  <button
                    onClick={() => setActiveCategory(null)}
                    className="text-[10px] uppercase tracking-[0.18em] text-crt/30 hover:text-crt/60 transition-colors"
                  >
                    [× all]
                  </button>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-[0.22em] text-crt/28">
                {threads.length} threads
              </span>
            </div>

            {/* Desktop column headers */}
            <div className="hidden border-b border-crt/8 px-4 py-1.5 text-[9px] uppercase tracking-[0.24em] text-crt/22 md:grid md:grid-cols-[minmax(0,1fr)_80px_80px_110px_20px]">
              <span>thread / topic</span>
              <span>replies</span>
              <span>views</span>
              <span>last post</span>
              <span />
            </div>

            {threads.length === 0 ? (
              <div className="px-4 py-10 text-center text-[11px] uppercase tracking-[0.24em] text-crt/25">
                no threads in this board yet
              </div>
            ) : (
              threads.map((thread) => {
                const color = CATEGORY_COLORS[thread.category] ?? '#86d46e';
                return (
                  <Link
                    key={thread.id}
                    href={`/threads/${thread.id}`}
                    className="forum-row block px-3 py-4 md:grid md:grid-cols-[minmax(0,1fr)_80px_80px_110px_20px] md:items-center md:gap-3 md:px-4"
                  >
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className="category-chip inline-flex px-2 py-0.5 text-[10px] uppercase tracking-[0.22em]"
                          style={{ ['--category' as string]: color }}
                        >
                          {thread.category}
                        </span>
                        {thread.pinned && (
                          <span className="text-[9px] uppercase tracking-[0.2em] text-crt/40">■ pinned</span>
                        )}
                      </div>
                      <div className="thread-title">{thread.title}</div>
                      <div className="mt-1 text-[0.9rem] leading-snug text-crt/32">
                        {thread.lastPostPreview}
                      </div>
                    </div>
                    <div className="mt-3 md:mt-0">
                      <div className="text-[9px] uppercase tracking-[0.22em] text-crt/22 md:hidden">replies</div>
                      <div className="text-[1rem] text-crt/52">{thread.replyCount}</div>
                    </div>
                    <div className="hidden text-[1rem] text-crt/48 md:block">{thread.viewCount}</div>
                    <div className="hidden text-[0.95rem] text-crt/38 md:block">{thread.lastActivityAt}</div>
                    <div className="hidden text-right text-[1.1rem] text-crt/30 md:block">›</div>
                  </Link>
                );
              })
            )}

            <div className="border-t border-crt/10 px-4 py-2.5 text-center text-[10px] uppercase tracking-[0.26em] text-crt/28">
              {threads.length} threads · no accounts · anonymous participation
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            <GhostPanel ghost={ghost} />
            <div className="panel overflow-hidden">
              <div className="border-b border-crt/12 px-3 py-2">
                <span className="text-[12px] uppercase tracking-[0.22em] text-crt/65">Posting Rules</span>
              </div>
              <div className="space-y-2 p-3 text-[1.02rem] leading-tight text-crt/55">
                <p>no accounts required</p>
                <p>ghost handle is optional</p>
                <p>anything goes</p>
                <p>no tracking</p>
                <p>the archive remembers</p>
                <div className="analog-rule my-2" />
                <p className="text-crt/35">use &gt; for greentext</p>
                <p className="text-crt/35">ctrl+enter to submit replies</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
