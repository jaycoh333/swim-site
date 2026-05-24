'use client';

import { ReactionSet } from '@/lib/forum-types';

interface ReactionBarProps {
  reactions: ReactionSet;
  compact?: boolean;
}

const REACTIONS: Array<{ key: keyof ReactionSet; label: string; glyph: string }> = [
  { key: 'echo', label: 'Echo', glyph: '~' },
  { key: 'dive', label: 'Dive', glyph: 'v' },
  { key: 'ripple', label: 'Ripple', glyph: '*' },
  { key: 'witness', label: 'Witness', glyph: '+' },
  { key: 'signal', label: 'Signal', glyph: '>' },
];

export function ReactionBar({ reactions, compact = false }: ReactionBarProps) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-2 ${compact ? 'text-[10px]' : 'text-xs'} tracking-[0.16em]`}>
      {REACTIONS.map(({ key, label, glyph }) => (
        <button key={key} className="text-crt/28 transition-colors hover:text-crt/72">
          {glyph} {reactions[key]} {label.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
