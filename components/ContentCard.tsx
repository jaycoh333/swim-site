'use client';

import { motion } from 'framer-motion';

import { CATEGORY_COLORS, ForumContent } from '@/lib/forum-types';
import { ReactionBar } from '@/components/ReactionBar';
import { GreenText } from '@/components/GreenText';

interface ContentCardProps {
  item: ForumContent;
  index?: number;
  compact?: boolean;
}

function typeMeta(item: ForumContent) {
  switch (item.type) {
    case 'THREAD':
      return { label: 'thread', accent: item.board, detail: item.lastPostPreview };
    case 'ARCHIVE_ENTRY':
      return { label: 'archive entry', accent: item.archiveCode, detail: `signal ${item.signalStrength}/5` };
    case 'CONFESSION':
      return { label: 'confession', accent: item.seal, detail: 'sealed anonymous text' };
    case 'SIGNAL':
      return { label: 'signal', accent: item.frequency, detail: item.source };
    case 'ENCOUNTER':
      return { label: 'encounter', accent: item.coordinates, detail: item.locationName };
    case 'DREAM_FILE':
      return { label: 'dream file', accent: item.dreamIndex, detail: item.sleepPhase };
    case 'THEORY':
      return { label: 'theory', accent: item.theoryStatus, detail: 'living document' };
    case 'LOST_MEDIA':
      return { label: 'lost media', accent: item.mediaFormat, detail: 'recovered artifact' };
    case 'LOG':
      return { label: 'log', accent: item.logKind, detail: item.createdAt };
  }
}

function renderBody(item: ForumContent) {
  switch (item.type) {
    case 'THREAD':
    case 'DREAM_FILE':
      return <GreenText text={item.body} className="text-[1.02rem]" />;
    case 'SIGNAL':
      return <p className="text-[1.08rem] uppercase tracking-[0.14em] text-phosphor/80">&gt; {item.body}</p>;
    case 'CONFESSION':
      return <blockquote className="text-[1.18rem] leading-relaxed text-crt/84">"{item.body}"</blockquote>;
    case 'LOG':
      return <p className="text-[1.02rem] text-crt/64">{item.body}</p>;
    default:
      return <p className="text-[1.05rem] leading-relaxed text-crt/72">{item.body}</p>;
  }
}

export function ContentCard({ item, index = 0, compact = false }: ContentCardProps) {
  const meta = typeMeta(item);
  const color = CATEGORY_COLORS[item.category] ?? '#8ddf72';

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.22, delay: index * 0.03 }}
      className="panel overflow-hidden panel-hover"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crt/10 px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className="category-chip inline-flex px-2 py-0.5 text-[10px] uppercase tracking-[0.22em]"
            style={{ ['--category' as string]: color }}
          >
            {item.category}
          </span>
          <span className="text-[10px] uppercase tracking-[0.22em] text-crt/28">{meta.label}</span>
          <span className="text-[10px] uppercase tracking-[0.22em] text-crt/22">{meta.accent}</span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-crt/24">{item.lastActivityAt}</span>
      </div>

      <div className={`${compact ? 'p-3' : 'p-4'} space-y-3.5`}>
        <div>
          <h3 className="text-[1.22rem] leading-tight text-crt md:text-[1.4rem]">{item.title}</h3>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-crt/28">
            {item.id} / {item.authorHandle} / {meta.detail}
          </div>
        </div>

        {renderBody(item)}

        <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-crt/30">
          {item.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-crt/10 pt-3">
          <ReactionBar reactions={item.reactions} compact />
          <div className="text-[10px] uppercase tracking-[0.2em] text-crt/26">
            {item.replyCount} replies / {item.viewCount} views
          </div>
        </div>
      </div>
    </motion.article>
  );
}
