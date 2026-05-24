'use client';

import { motion } from 'framer-motion';
import { AmbientGrid } from '@/components/AmbientGrid';
import { GreenText } from '@/components/GreenText';

const THREADS = [
  {
    id: '#3381',
    handle: 'SWIM_19841',
    time: '3m ago',
    category: 'PARANORMAL',
    content: `> had the dream again
> same coordinates as last time
> different city though
> or maybe the same city, different time

I'm starting to think the coordinates aren't a place. They're a when.`,
    echoes: 7, dives: 3, ripples: 12,
  },
  {
    id: '#3380',
    handle: 'SWIM_44021',
    time: '11m ago',
    category: 'GLITCHES',
    content: `> found an old forum
> not linked anywhere
> had to find it by accident
> the last post was dated on my birthday

not the year. just the day and month.
I posted something. it replied immediately.
the reply was timestamped 1997.`,
    echoes: 22, dives: 8, ripples: 31,
  },
  {
    id: '#3379',
    handle: 'SWIM_00771',
    time: '34m ago',
    category: 'THEORIES',
    content: `> the archive remembers things I deleted
> I tested it
> wrote something, deleted it, came back
> it was there

not cached. not recovered. just. there.
as if deletion is not the same as gone.`,
    echoes: 41, dives: 15, ripples: 88,
  },
  {
    id: '#3378',
    handle: 'SWIM_99130',
    time: '1h ago',
    category: 'CONFESSIONS',
    content: `you are not the person who started reading this sentence.

prove me wrong.`,
    echoes: 137, dives: 44, ripples: 210,
  },
  {
    id: '#3377',
    handle: 'SWIM_55502',
    time: '2h ago',
    category: 'DREAMS',
    content: `> I dreamed a number
> woke up and wrote it down
> 8 digits
> looked it up

it was a phone number. disconnected in 1994.
I called the disconnected number anyway.
someone answered.
they said: "we've been waiting."`,
    echoes: 89, dives: 27, ripples: 144,
  },
  {
    id: '#3376',
    handle: 'SWIM_23381',
    time: '3h ago',
    category: 'RELATIONSHIPS',
    content: `we talked every night for two years.
I still don't know their name.
I don't need to.
we understood something together that I cannot explain to anyone.

they stopped appearing six months ago.
I still log in at the same time.
in case.`,
    echoes: 63, dives: 19, ripples: 95,
  },
];

export default function ThreadsPage() {
  return (
    <div className="relative min-h-screen pt-16">
      <AmbientGrid className="pointer-events-none fixed inset-0 opacity-50" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="mb-2 text-xs tracking-[.3em] text-crt/30 uppercase">
            SWIM NETWORK // THREADS
          </div>
          <h1 className="crt-text font-terminal text-5xl tracking-wide uppercase">
            THREADS
          </h1>
          <p className="mt-2 text-sm text-crt/45 tracking-widest">
            Anonymous. Temporary. Real.
          </p>
        </motion.div>

        {/* Live indicator */}
        <div className="mb-6 flex items-center gap-3 text-xs text-crt/35 tracking-widest">
          <span className="h-1.5 w-1.5 rounded-full bg-crt animate-pulse-glow" />
          <span>LIVE — 247 PARTICIPANTS — {THREADS.length} ACTIVE THREADS</span>
        </div>

        {/* Thread list */}
        <div className="space-y-4">
          {THREADS.map((thread, i) => (
            <motion.article
              key={thread.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="panel cursor-pointer transition-all duration-200 hover:border-crt/55"
            >
              {/* Thread header */}
              <div className="border-b border-crt/15 px-4 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs tracking-widest">
                    <span className="text-crt/40">{thread.id}</span>
                    <span className="text-crt/25">|</span>
                    <span className="text-phosphor/60">{thread.handle}</span>
                    <span className="text-crt/25">|</span>
                    <span className="text-crt/30 uppercase">[{thread.category}]</span>
                  </div>
                  <span className="text-xs text-crt/25">{thread.time}</span>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 py-4">
                <GreenText text={thread.content} />
              </div>

              {/* Reactions */}
              <div className="border-t border-crt/10 px-4 py-2.5">
                <div className="flex gap-5 text-xs text-crt/30 tracking-widest">
                  <button className="hover:text-crt transition-colors">
                    ≋ {thread.echoes} ECHOES
                  </button>
                  <button className="hover:text-crt transition-colors">
                    ↓ {thread.dives} DIVES
                  </button>
                  <button className="hover:text-crt transition-colors">
                    ∿ {thread.ripples} RIPPLES
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Post prompt */}
        <div className="mt-8 border border-crt/15 p-6 text-center">
          <p className="text-sm text-crt/35 tracking-widest">
            — POST A THREAD AS SWIM —
          </p>
          <p className="mt-2 text-xs text-crt/20">
            ANONYMOUS POSTING: COMING IN PHASE 2
          </p>
        </div>
      </div>
    </div>
  );
}
