'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <header className="fixed left-0 right-0 top-0 z-[9990] border-b border-crt/15 bg-void/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="font-mono text-xl tracking-[.2em] text-crt crt-text-dim hover:crt-text transition-all"
        >
          $SWIM
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link text-sm font-mono tracking-widest ${pathname === href ? 'active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Status pill */}
        <div className="hidden items-center gap-2 md:flex">
          <span
            className="h-1.5 w-1.5 rounded-full bg-crt animate-pulse-glow"
            aria-hidden="true"
          />
          <span className="text-xs text-crt/40 tracking-widest font-mono">CONNECTED</span>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(v => !v)}
          className="flex flex-col gap-1.5 p-2 md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          <span className={`h-px w-5 bg-crt transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`h-px w-5 bg-crt transition-opacity ${open ? 'opacity-0' : ''}`} />
          <span className={`h-px w-5 bg-crt transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-crt/10 bg-void md:hidden"
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col gap-0 px-4 py-4">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`nav-link py-3 text-base font-mono tracking-widest border-b border-crt/10 last:border-0 ${
                    pathname === href ? 'active' : ''
                  }`}
                >
                  › {label}
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
