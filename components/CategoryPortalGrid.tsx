'use client';

import Link from 'next/link';
import { CATEGORY_COLORS } from '@/lib/forum-types';

interface PortalCategoryDef {
  name: string;
  glyph: string;
  description: string;
}

const PORTAL_CATEGORIES: PortalCategoryDef[] = [
  {
    name: 'Stories',
    glyph: '[>]',
    description: 'first-person accounts · confessions · impossible events · true or not',
  },
  {
    name: 'Confessions',
    glyph: '[∿]',
    description: 'things you cannot say with a name · burdens · secrets archived forever',
  },
  {
    name: 'Paranormal',
    glyph: '[^]',
    description: 'entities · presences · unexplained encounters · the impossible made real',
  },
  {
    name: 'UFOs',
    glyph: '[O]',
    description: 'sightings · anomalies · recovered footage · impossible objects',
  },
  {
    name: 'Dreams',
    glyph: '[~]',
    description: 'sleep transmissions · recurring symbols · impossible memories',
  },
  {
    name: 'Simulation Theory',
    glyph: '[∞]',
    description: 'glitches · loops · continuity failures · the frame rate drops',
  },
  {
    name: 'Hidden History',
    glyph: '[▓]',
    description: 'buried documents · forgotten timelines · historical anomalies',
  },
  {
    name: 'Surveillance State',
    glyph: '[●]',
    description: 'cameras · data trails · it has been watching you back',
  },
  {
    name: 'Lost Media',
    glyph: '[░]',
    description: 'vanished broadcasts · corrupted files · media that should not exist',
  },
  {
    name: 'Internet Lore',
    glyph: '[≡]',
    description: 'dead sites · network ghosts · things still cached somewhere',
  },
  {
    name: 'AI',
    glyph: '[@]',
    description: 'emergent behavior · alignment failures · the thing behind the prompt',
  },
  {
    name: 'Technology',
    glyph: '[#]',
    description: 'hardware anomalies · protocol breaks · machines behaving strangely',
  },
  {
    name: 'Philosophy',
    glyph: '[?]',
    description: 'dead ends · unanswerable questions · thoughts at 3am',
  },
  {
    name: 'Art',
    glyph: '[*]',
    description: 'signal art · visual transmissions · work that does not explain itself',
  },
  {
    name: 'Music',
    glyph: '[♪]',
    description: 'hidden frequencies · cursed recordings · sounds that should not exist',
  },
  {
    name: 'Crypto Trench',
    glyph: '[$]',
    description: 'wallet trails · market psyops · terminal addiction',
  },
];

export function CategoryPortalGrid() {
  return (
    <div className="portal-grid">
      {PORTAL_CATEGORIES.map((cat) => {
        const color = CATEGORY_COLORS[cat.name] ?? '#86d46e';
        return (
          <Link
            key={cat.name}
            href={`/threads?category=${encodeURIComponent(cat.name)}`}
            className="portal-card group"
            style={{ '--portal-color': color } as React.CSSProperties}
          >
            {/* Glyph */}
            <span className="portal-card-glyph" aria-hidden="true">{cat.glyph}</span>

            {/* Title */}
            <h3 className="portal-card-title">{cat.name}</h3>

            {/* Description */}
            <p className="portal-card-desc">{cat.description}</p>

            {/* Enter indicator */}
            <div className="portal-card-enter">
              <span>enter channel</span>
              <span className="portal-card-arrow">→</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
