'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const NAV_LINKS = [
  { href: '/archive',     label: 'ARCHIVE' },
  { href: '/threads',     label: 'THREADS' },
  { href: '/confessions', label: 'CONFESSIONS' },
  { href: '/vault',       label: 'VAULT' },
  { href: '/map',         label: 'MAP' },
  { href: '/signal',      label: 'SIGNAL' },
];

// Mobile dropdown includes Home; desktop nav relies on the $SWIM logo pill
const MOBILE_NAV_LINKS = [
  { href: '/',            label: 'HOME' },
  ...NAV_LINKS,
];

// Rotating status messages — BBS-style
const STATUS_LINES = [
  'all channels open',
  'archive: sealed / stable',
  'ghost mode: active',
  'no identity required',
  'signal: ■■■□□  stable',
  'nodes: 247  anonymous',
  'no tracking. no names.',
  'the archive remembers.',
];

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setStatusIdx((i) => (i + 1) % STATUS_LINES.length),
      4200,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <header className="fixed left-0 right-0 top-0 z-[9990] border-b border-crt/10 bg-[rgba(3,5,4,.97)]">
      {/* ── Main row ─── */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-1.5 md:px-5">
        {/* Logo */}
        <Link
          href="/"
          className="border border-crt/14 px-3 py-1 font-mono text-base tracking-[0.3em] text-crt/82 transition-colors hover:text-crt md:text-lg"
        >
          $SWIM
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main navigation">
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

        {/* Status + signal */}
        <div className="hidden items-center gap-3 md:flex">
          <AnimatePresence mode="wait">
            <motion.span
              key={statusIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="text-[9px] uppercase tracking-[0.2em] text-crt/28"
            >
              {STATUS_LINES[statusIdx]}
            </motion.span>
          </AnimatePresence>
          <span className="h-1.5 w-1.5 bg-crt/55 animate-pulse-glow" aria-hidden="true" />
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="forum-tab flex flex-col gap-1 px-3 py-2 md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          <span className={`h-px w-5 bg-crt transition-transform ${open ? 'translate-y-[5px] rotate-45' : ''}`} />
          <span className={`h-px w-5 bg-crt transition-opacity ${open ? 'opacity-0' : ''}`} />
          <span className={`h-px w-5 bg-crt transition-transform ${open ? '-translate-y-[5px] -rotate-45' : ''}`} />
        </button>
      </div>

      {/* ── BBS status bar (desktop only) ─── */}
      <div className="nav-status-bar hidden px-4 py-0.5 text-[9px] uppercase tracking-[0.26em] text-crt/20 md:flex items-center gap-5 overflow-hidden">
        <span className="signal-bar text-crt/30">SIG:■■■□□</span>
        <span>ver: 2001.5.15</span>
        <span>nodes: 247</span>
        <span>archive: sealed</span>
        <span className="text-crt/12 truncate">| ghost mode active | no identity required | swim protocol v0.1</span>
      </div>

      {/* ── Mobile dropdown ─── */}
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
              <div className="mb-2 px-3 pt-1 text-[9px] uppercase tracking-[0.26em] text-crt/25">
                {STATUS_LINES[statusIdx]}
                <span className="ml-2 blink text-crt/35">█</span>
              </div>
              {MOBILE_NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-crt/10 px-3 py-3 text-sm tracking-[0.22em] last:border-b-0 ${
                    pathname === href ? 'text-crt' : 'text-crt/55'
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
