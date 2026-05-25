'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const NAV_LINKS = [
  { href: '/archive',              label: 'ARCHIVE' },
  { href: '/threads',              label: 'THREADS' },
  { href: '/threads?compose=true', label: 'POST' },
  { href: '/signal',               label: 'SIGNAL' },
];

const MOBILE_NAV_LINKS = [
  { href: '/',                     label: 'HOME' },
  { href: '/archive',              label: 'ARCHIVE' },
  { href: '/threads',              label: 'THREADS' },
  { href: '/threads?compose=true', label: 'POST A STORY' },
  { href: '/signal',               label: 'SIGNAL' },
];

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
    <header className="fixed left-0 right-0 top-0 z-[9990] border-b border-crt/12 bg-[rgba(3,5,4,.98)]">

      {/* ── Main row ── */}
      <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-6 px-6 py-4 md:min-h-[96px] md:px-12">

        {/* Brand */}
        <Link
          href="/"
          aria-label="SWIM home"
          className="flex flex-shrink-0 items-center gap-4 text-crt/88 transition-colors hover:text-crt"
        >
          <Image
            src="/images/swim-sigil-logo.jpg"
            alt=""
            width={64}
            height={64}
            className="nav-sigil flex-shrink-0"
          />
          <span className="font-mono text-[1.4rem] tracking-[0.20em] md:text-[1.75rem]">$SWIM</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-4 md:flex" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link forum-tab px-5 py-3 text-[18px] tracking-[0.16em] ${
                !href.includes('?') && pathname === href ? 'active border-crt/35 text-crt' : ''
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right — status blip (desktop) + hamburger (mobile) */}
        <div className="flex flex-shrink-0 items-center gap-4">
          {/* Live status — desktop only */}
          <div className="hidden items-center gap-3 md:flex">
            <AnimatePresence mode="wait">
              <motion.span
                key={statusIdx}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.22 }}
                className="text-[13px] uppercase tracking-[0.16em] text-crt/52"
              >
                {STATUS_LINES[statusIdx]}
              </motion.span>
            </AnimatePresence>
            <span className="h-2 w-2 animate-pulse-glow bg-crt/55" aria-hidden="true" />
          </div>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="forum-tab flex flex-col gap-[5px] px-3.5 py-3 md:hidden"
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            <span className={`h-px w-6 bg-crt transition-transform ${open ? 'translate-y-[9px] rotate-45' : ''}`} />
            <span className={`h-px w-6 bg-crt transition-opacity ${open ? 'opacity-0' : ''}`} />
            <span className={`h-px w-6 bg-crt transition-transform ${open ? '-translate-y-[5px] -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown ── */}
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
            <div className="px-6 py-3">
              <div className="mb-3 text-[13px] uppercase tracking-[0.20em] text-crt/48">
                {STATUS_LINES[statusIdx]}
                <span className="ml-2 blink text-crt/45">█</span>
              </div>
              {MOBILE_NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-crt/10 px-2 py-4 text-[18px] tracking-[0.18em] last:border-b-0 ${
                    pathname === href ? 'text-crt' : 'text-crt/72'
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
