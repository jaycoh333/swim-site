'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ACTIONS: { href: string; label: string; glyph: string; post?: boolean }[] = [
  { href: '/',                      label: 'Home',    glyph: '∷' },
  { href: '/archive',               label: 'Archive', glyph: '≡' },
  { href: '/threads',               label: 'Threads', glyph: '≋' },
  { href: '/threads?compose=true',  label: 'Post',    glyph: '+', post: true },
  { href: '/signal',                label: 'Signal',  glyph: '◎' },
];

export function MobileActionBar() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[9980] border-t border-crt/15"
      style={{ background: 'rgba(2,3,3,0.97)' }}
      aria-label="Quick actions"
    >
      <div className="mobile-bar-safe grid grid-cols-5">
        {ACTIONS.map(({ href, label, glyph, post }) => {
          // Active when pathname matches, ignoring query string
          const isActive = !post && pathname === href.split('?')[0];
          return (
            <Link
              key={label}
              href={href}
              className={[
                'mobile-action py-3',
                post
                  ? 'mobile-action-post text-crt'
                  : isActive
                    ? 'text-crt'
                    : 'text-crt/32',
              ].join(' ')}
            >
              <span
                className="leading-none"
                style={{ fontSize: post ? '1.35rem' : '1.1rem' }}
              >
                {glyph}
              </span>
              <span
                className="uppercase tracking-[0.14em]"
                style={{ fontSize: '9px' }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
