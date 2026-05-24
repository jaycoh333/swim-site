'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

import { AmbientGrid } from '@/components/AmbientGrid';
import { ContentCard } from '@/components/ContentCard';
import { TerminalWindow } from '@/components/TerminalWindow';
import { mockDb } from '@/lib/mock-db';
import { Category } from '@/lib/forum-types';

export default function ArchivePage() {
  const [activeCategory, setActiveCategory] = useState<Category | 'ALL'>('ALL');

  const stats = useMemo(() => mockDb.getForumStats(), []);
  const categories = useMemo(() => ['ALL', ...mockDb.getSeededCategories()] as const, []);
  const archiveIndex = useMemo(
    () => mockDb.listContent({ category: activeCategory, limit: 12 }),
    [activeCategory],
  );

  return (
    <div className="relative min-h-screen pt-16">
      <AmbientGrid className="pointer-events-none fixed inset-0 opacity-60" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="mb-2 text-xs tracking-[.3em] text-crt/30 uppercase">
            SWIM NETWORK // ARCHIVE
          </div>
          <h1 className="crt-text text-5xl tracking-wide uppercase">THE ARCHIVE</h1>
          <p className="mt-2 text-sm tracking-widest text-crt/45">
            Typed records. Recovered fragments. Signals mixed with memory.
          </p>
        </motion.div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'TOTAL ENTRIES', value: stats.totalEntries.toString() },
            { label: 'CATEGORIES', value: stats.totalCategories.toString() },
            { label: 'OLDEST ENTRY', value: stats.oldestEntry },
            { label: 'AVG SIGNAL', value: stats.averageSignal },
          ].map(({ label, value }) => (
            <div key={label} className="panel px-4 py-3 text-center">
              <div className="text-xl text-crt crt-text-dim">{value}</div>
              <div className="mt-1 text-[10px] tracking-widest text-crt/30 uppercase">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside>
            <TerminalWindow title="Filter By" animate={false}>
              <ul className="space-y-1 text-sm">
                {categories.map((category) => (
                  <li key={category}>
                    <button
                      onClick={() => setActiveCategory(category)}
                      className="w-full px-2 py-1.5 text-left tracking-widest text-crt/60 transition-colors hover:bg-crt/5 hover:text-crt"
                    >
                      {activeCategory === category ? (
                        <span className="text-crt crt-text-dim">&gt; {category}</span>
                      ) : (
                        <span>{category}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </TerminalWindow>

            <div className="mt-4">
              <TerminalWindow title="Schemas" animate={false}>
                <div className="space-y-2 text-[1.05rem] leading-tight text-crt/58">
                  <div>THREAD</div>
                  <div>ARCHIVE ENTRY</div>
                  <div>CONFESSION</div>
                  <div>SIGNAL</div>
                  <div>ENCOUNTER</div>
                  <div>DREAM FILE</div>
                  <div>THEORY</div>
                  <div>LOST MEDIA</div>
                  <div>LOG</div>
                </div>
              </TerminalWindow>
            </div>
          </aside>

          <main>
            <div className="mb-4 flex items-center justify-between text-xs tracking-widest text-crt/30">
              <span>SHOWING {archiveIndex.length} ENTRIES</span>
              <span>CATEGORY: {activeCategory}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {archiveIndex.map((item, index) => (
                <ContentCard key={item.id} item={item} index={index} compact />
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
