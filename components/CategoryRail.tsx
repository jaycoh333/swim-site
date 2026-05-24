'use client';

import { CATEGORY_COLORS } from '@/lib/forum-types';

// Terminal-style glyph for each category
const GLYPHS: Record<string, string> = {
  Stories:             '[>]',
  Philosophy:          '[?]',
  Technology:          '[#]',
  UFOs:                '[O]',
  Dreams:              '[~]',
  Art:                 '[*]',
  Music:               '[♪]',
  'Crypto Trench':     '[$]',
  Politics:            '[!]',
  Paranormal:          '[^]',
  AI:                  '[@]',
  About:               '[i]',
  Confessions:         '[∿]',
  Survival:            '[=]',
  Psychedelics:        '[%]',
  'Lost Media':        '[░]',
  'Hidden History':    '[▓]',
  'Internet Lore':     '[≡]',
  'Simulation Theory': '[∞]',
  'Conspiracy Theory': '[?!]',
  'Occult Archives':   '[⊛]',
  Relationships:       '[♡]',
  Spirituality:        '[◎]',
  'Dark Web Lore':     '[■]',
  'Black Projects':    '[▪]',
  'Shadow Systems':    '[//]',
  'Forbidden Tech':    '[Δ]',
  'Redacted Files':    '[██]',
  'Censored History':  '[--]',
  'Whistleblower Files': '[!>]',
  'Corporate Secrets': '[$$]',
  'Surveillance State':'[●]',
  Psyops:              '[Ψ]',
  'Weird Encounters':  '[??]',
  'Internet Mysteries':'[?∿]',
  'Unsolved Events':   '[◆]',
  'Addiction Recovery':'[+]',
};

function glyph(cat: string): string {
  return GLYPHS[cat] ?? '[.]';
}

interface CategoryRailProps {
  categories: readonly string[];
  active?: string | null;
  onSelect?: (cat: string | null) => void;
}

export function CategoryRail({ categories, active, onSelect }: CategoryRailProps) {
  return (
    <div className="category-rail border-b border-crt/12">
      <div className="category-rail-track">
        {/* ALL entry */}
        <button
          onClick={() => onSelect?.(null)}
          className={`category-portal ${!active ? 'category-portal-active' : ''}`}
          style={{ '--category': '#86d46e' } as React.CSSProperties}
        >
          <span className="category-glyph">[∷]</span>
          <span className="category-name">ALL</span>
          <span className="category-blip" />
        </button>

        {categories.map((cat) => {
          const color = CATEGORY_COLORS[cat] ?? '#86d46e';
          const isActive = active === cat;
          return (
            <button
              key={cat}
              onClick={() => onSelect?.(isActive ? null : cat)}
              className={`category-portal ${isActive ? 'category-portal-active' : ''}`}
              style={{ '--category': color } as React.CSSProperties}
              title={cat}
            >
              <span className="category-glyph">{glyph(cat)}</span>
              <span className="category-name">{cat}</span>
              <span className="category-blip" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
