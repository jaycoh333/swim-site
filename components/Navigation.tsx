'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

const NAV_LINKS = [
  { href: '/archive', label: 'ARCHIVE' },
  { href: '/threads', label: 'THREADS' },
  { href: '/confessions', label: 'CONFESSIONS' },
  { href: '/vault', label: 'VAULT' },
  { href: '/map', label: 'MAP' },
  { href: '/signal', label: 'SIGNAL' },
];

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed left-0 right-0 top-0 z-[9990] border-b border-crt/10 bg-[rgba(3,6,5,.94)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-1.5 md:px-5">
        <Link
          href="/"
          className="border border-crt/14 px-3 py-1 font-mono text-base tracking-[0.3em] text-crt/82 transition-colors hover:text-crt md:text-lg"
        >
          $SWIM
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link forum-tab px-2.5 py-1.5 text-[11px] tracking-[0.22em] ${
                pathname === href ? 'active border-crt/35 text-crt' : ''
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 border border-crt/12 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-crt/40 md:flex">
          <span className="h-1.5 w-1.5 bg-crt/70" aria-hidden="true" />
          currently drifting through SWIM
        </div>

        <button
          onClick={() => setOpen((value) => !value)}
          className="forum-tab flex flex-col gap-1 px-3 py-2 md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          <span className={`h-px w-5 bg-crt transition-transform ${open ? 'translate-y-[5px] rotate-45' : ''}`} />
          <span className={`h-px w-5 bg-crt transition-opacity ${open ? 'opacity-0' : ''}`} />
          <span className={`h-px w-5 bg-crt transition-transform ${open ? '-translate-y-[5px] -rotate-45' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-crt/10 bg-[rgba(4,7,5,.985)] md:hidden"
            aria-label="Mobile navigation"
          >
            <div className="px-3 py-2">
              <div className="mb-2 px-3 pt-1 text-[10px] uppercase tracking-[0.22em] text-crt/34">
                currently drifting through SWIM
              </div>
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-crt/10 px-3 py-2.5 text-sm tracking-[0.22em] last:border-b-0 ${
                    pathname === href ? 'text-crt' : 'text-crt/65'
                  }`}
                >
                  &gt; {label}
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
