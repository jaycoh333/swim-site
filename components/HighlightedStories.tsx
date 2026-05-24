'use client';

import Link from 'next/link';
import { ThreadContent, CATEGORY_COLORS, StoryBadge, SignalLevel } from '@/lib/forum-types';

const BADGE_CLASS: Record<StoryBadge, string> = {
  'REDACTED':       'story-badge-redacted',
  'RECOVERED':      'story-badge-recovered',
  'UNVERIFIED':     'story-badge-unverified',
  'WITNESSED':      'story-badge-witnessed',
  'LEAKED MEMORY':  'story-badge-leaked',
  'DEAD NODE':      'story-badge-dead',
  'ARCHIVIST PICK': 'story-badge-archivist',
  'SIGNAL ACTIVE':  'story-badge-signal',
};

const SIGNAL_BARS: Record<SignalLevel, string> = {
  LOW:      '■□□□□',
  ACTIVE:   '■■■□□',
  UNSTABLE: '■■□■□',
  BURIED:   '□□□□□',
};

interface Props {
  threads: ThreadContent[];
}

export function HighlightedStories({ threads }: Props) {
  if (threads.length === 0) return null;

  return (
    <div className="panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-crt/12 px-3 py-2.5 md:px-4">
        <span className="h-1.5 w-1.5 animate-pulse-glow bg-crt/65" aria-hidden="true" />
        <span className="text-[12px] uppercase tracking-[0.3em] text-crt">
          RECOVERED FILES
        </span>
        <div className="h-px flex-1 bg-crt/10" />
        <span className="text-[9px] uppercase tracking-[0.2em] text-crt/22">
          verified by no one
        </span>
      </div>

      {/* Story grid */}
      <div className="grid gap-px bg-crt/[0.04] sm:grid-cols-2 xl:grid-cols-3">
        {threads.map((thread) => {
          const color = CATEGORY_COLORS[thread.category] ?? '#86d46e';
          const badgeClass = thread.badge ? BADGE_CLASS[thread.badge] : '';
          const totalReactions = Object.values(thread.reactions).reduce((a, b) => a + b, 0);

          return (
            <Link
              key={thread.id}
              href={`/threads/${thread.id}`}
              className="story-card"
            >
              {/* Top row: badge + category */}
              <div className="mb-3 flex items-start justify-between gap-2">
                {thread.badge && (
                  <span className={`story-badge ${badgeClass}`}>
                    {thread.badge}
                  </span>
                )}
                <span
                  className="category-chip ml-auto shrink-0 px-1.5 py-0.5 text-[9px]"
                  style={{ ['--category' as string]: color }}
                >
                  {thread.category}
                </span>
              </div>

              {/* Title */}
              <h3 className="story-title">{thread.title}</h3>

              {/* Excerpt */}
              <p className="story-excerpt">{thread.excerpt}</p>

              {/* Stats */}
              <div className="story-stats">
                <span>~ {totalReactions} echoes</span>
                <span>{thread.replyCount} replies</span>
                <span>{thread.lastActivityAt}</span>
              </div>

              {/* Signal level + archive ID */}
              <div className="mt-2 flex items-center justify-between">
                {thread.signalLevel && (
                  <div className="story-signal">
                    <span className="signal-bar text-[10px]">
                      {SIGNAL_BARS[thread.signalLevel]}
                    </span>
                    <span>{thread.signalLevel}</span>
                  </div>
                )}
                {thread.archiveId && (
                  <span className="text-[9px] uppercase tracking-[0.14em] text-crt/18 ml-auto">
                    {thread.archiveId}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer archivist voice */}
      <div className="border-t border-crt/8 px-3 py-2 text-center text-[9px] uppercase tracking-[0.24em] text-crt/18">
        recovered from dead nodes · speculation archive · verify nothing · archive everything
      </div>
    </div>
  );
}
