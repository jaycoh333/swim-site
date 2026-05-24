'use client';

import { motion } from 'framer-motion';

import { AmbientGrid } from '@/components/AmbientGrid';
import { ContentCard } from '@/components/ContentCard';
import { CreateThreadPanel } from '@/components/CreateThreadPanel';
import { GhostPanel } from '@/components/GhostPanel';
import { TerminalWindow } from '@/components/TerminalWindow';
import { mockDb } from '@/lib/mock-db';

export default function ThreadsPage() {
  const threads = mockDb.getThreads();
  const ghost = mockDb.getGhostIdentity();
  const draft = mockDb.getCreateThreadDraft();
  const categories = mockDb.getSeededCategories();

  return (
    <div className="relative min-h-screen pt-16">
      <AmbientGrid className="pointer-events-none fixed inset-0 opacity-50" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="mb-2 text-xs tracking-[.3em] text-crt/30 uppercase">
            SWIM NETWORK // THREADS
          </div>
          <h1 className="crt-text text-5xl tracking-wide uppercase">THREADS</h1>
          <p className="mt-2 text-sm tracking-widest text-crt/45">
            Anonymous. Persistent if you want. Still unclaimed.
          </p>
        </motion.div>

        <div className="mb-6 flex flex-wrap items-center gap-3 text-xs tracking-widest text-crt/35">
          <span className="h-1.5 w-1.5 rounded-full bg-crt animate-pulse-glow" />
          <span>LIVE - {mockDb.getOnlineSnapshot(4)} PARTICIPANTS - {threads.length} ACTIVE THREADS</span>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            {threads.map((thread, index) => (
              <ContentCard key={thread.id} item={thread} index={index} />
            ))}
          </div>

          <aside className="space-y-4">
            <GhostPanel ghost={ghost} />
            <CreateThreadPanel draft={draft} categories={categories} />
            <TerminalWindow title="Posting Notes" version="phase.02" animate={false}>
              <div className="space-y-2 text-[1.08rem] leading-tight text-crt/62">
                <p>anonymous handle only</p>
                <p>optional passphrase later</p>
                <p>no email required</p>
                <p>custom sigils reserved for future ghost identity settings</p>
              </div>
            </TerminalWindow>
          </aside>
        </div>
      </div>
    </div>
  );
}
