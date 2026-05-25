'use client';

import { ReactionSet } from '@/lib/forum-types';

interface ReactionBarProps {
  reactions: ReactionSet;
  compact?: boolean;
}

const REACTIONS: Array<{ key: keyof ReactionSet; label: string; glyph: string }> = [
  { key: 'echo',    label: 'Echo',      glyph: '~'  },
  { key: 'witness', label: 'Witnessed', glyph: '◉'  },
  { key: 'signal',  label: 'Signal',    glyph: '▲'  },
  { key: 'ripple',  label: 'Archived',  glyph: '⊟'  },
  { key: 'dive',    label: 'Glitch',    glyph: '↯'  },
];

export function ReactionBar({ reactions, compact = false }: ReactionBarProps) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 ${compact ? 'text-[11px]' : 'text-[12px]'} uppercase tracking-[0.14em]`}>
      {REACTIONS.map(({ key, label, glyph }) => (
        <span key={key} className="text-crt/35">
          {glyph} {reactions[key]} {label}
        </span>
      ))}
    </div>
  );
}
