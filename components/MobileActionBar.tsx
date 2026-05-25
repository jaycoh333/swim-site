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
      className="md:hidden fixed bottom-0 left-0 right-0 z-[9980] border-t border-crt/18"
      style={{ background: 'rgba(2,3,3,0.98)' }}
      aria-label="Quick actions"
    >
      <div className="mobile-bar-safe grid grid-cols-5">
        {ACTIONS.map(({ href, label, glyph, post }) => {
          const isActive = !post && pathname === href.split('?')[0];
          return (
            <Link
              key={label}
              href={href}
              className={[
                'mobile-action py-3.5',
                post
                  ? 'mobile-action-post text-crt'
                  : isActive
                    ? 'text-crt'
                    : 'text-crt/45',
              ].join(' ')}
            >
              <span
                className="leading-none"
                style={{ fontSize: post ? '1.45rem' : '1.2rem' }}
              >
                {glyph}
              </span>
              <span
                className="uppercase tracking-[0.12em]"
                style={{ fontSize: post ? '11px' : '10px' }}
              >
                {label}
              </span>
              {isActive && (
                <span
                  className="mt-0.5 h-px w-6 bg-crt/55"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
