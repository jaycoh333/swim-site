import Link from 'next/link';
import type { ThreadContent } from '@/lib/forum-types';
import { CATEGORY_COLORS } from '@/lib/forum-types';

interface HotThreadsModuleProps {
  threads: ThreadContent[];
  title?: string;
  limit?: number;
}

export function HotThreadsModule({
  threads,
  title = 'ACTIVE SIGNALS',
  limit = 3,
}: HotThreadsModuleProps) {
  const visible = threads.slice(0, limit);
  if (!visible.length) return null;

  return (
    <div className="panel overflow-hidden">

      {/* Section header */}
      <div className="flex items-center gap-2.5 border-b border-crt/10 px-5 py-4">
        <span className="h-1.5 w-1.5 flex-shrink-0 animate-pulse-glow bg-crt/55" aria-hidden="true" />
        <span className="text-[13px] uppercase tracking-[0.26em] text-crt/62">{title}</span>
      </div>

      {/* Terminal card list — each signal is a full card */}
      <div className="terminal-card-grid p-3">
        {visible.map((thread, i) => {
          const color = CATEGORY_COLORS[thread.category] ?? '#86d46e';
          return (
            <Link
              key={thread.id}
              href={`/threads/${thread.id}`}
              className={`terminal-card group px-5 py-4${i === 2 ? ' hidden sm:block' : ''}`}
            >
              {/* Category label */}
              <div
                className="mb-2 text-[11px] uppercase tracking-[0.22em]"
                style={{ color: `${color}88` }}
              >
                {thread.category}
              </div>

              {/* Thread title */}
              <div className="text-[1.35rem] leading-[1.28] text-crt/85 transition-colors group-hover:text-crt">
                {thread.title}
              </div>

              {/* Single metadata line */}
              <div className="mt-2.5 text-[13px] uppercase tracking-[0.14em] text-crt/42">
                {thread.replyCount} replies
                <span className="mx-1.5 text-crt/22">·</span>
                {thread.viewCount} views
                <span className="mx-1.5 text-crt/22">·</span>
                {thread.lastActivityAt}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer link */}
      <div className="border-t border-crt/8 px-5 py-3">
        <Link
          href="/threads"
          className="text-[12px] uppercase tracking-[0.20em] text-crt/48 transition-colors hover:text-crt/70"
        >
          all threads →
        </Link>
      </div>
    </div>
  );
}
