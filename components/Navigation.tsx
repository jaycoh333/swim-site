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
    <header className="fixed left-0 right-0 top-0 z-[9990] border-b border-crt/10 bg-[rgba(3,5,4,.97)]">

      {/* ── Main row — plain flex, no absolute positioning ── */}
      <div className="mx-auto flex min-h-[64px] max-w-7xl items-center justify-between px-5 py-2 md:min-h-[72px] md:px-8">

        {/* Brand — left-aligned, flex-shrink-0 so it never compresses */}
        <Link
          href="/"
          aria-label="SWIM home"
          className="flex flex-shrink-0 items-center gap-3 text-crt/85 transition-colors hover:text-crt"
        >
          <Image
            src="/images/swim-sigil-logo.jpg"
            alt=""
            width={56}
            height={56}
            className="nav-sigil flex-shrink-0"
          />
          <span className="font-mono text-[1.15rem] tracking-[0.24em] md:text-[1.32rem]">$SWIM</span>
        </Link>

        {/* Desktop nav links — center section */}
        <nav className="hidden items-center gap-2 md:flex" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link forum-tab px-4 py-2 text-[13px] tracking-[0.18em] ${
                !href.includes('?') && pathname === href ? 'active border-crt/35 text-crt' : ''
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right — status ticker + blip (desktop only) + mobile hamburger */}
        <div className="flex flex-shrink-0 items-center gap-3">
          {/* Status + blip — desktop only */}
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

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="forum-tab flex flex-col gap-1.5 px-3 py-2.5 md:hidden"
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            <span className={`h-px w-5 bg-crt transition-transform ${open ? 'translate-y-[6px] rotate-45' : ''}`} />
            <span className={`h-px w-5 bg-crt transition-opacity ${open ? 'opacity-0' : ''}`} />
            <span className={`h-px w-5 bg-crt transition-transform ${open ? '-translate-y-[6px] -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── BBS status bar (desktop only) ── */}
      <div className="nav-status-bar hidden items-center gap-5 overflow-hidden px-8 py-0.5 text-[9px] uppercase tracking-[0.26em] text-crt/20 md:flex">
        <span className="signal-bar text-crt/30">SIG:■■■□□</span>
        <span>ver: 2001.5.15</span>
        <span>nodes: 247</span>
        <span>archive: sealed</span>
        <span className="truncate text-crt/12">| ghost mode active | no identity required | swim protocol v0.1</span>
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
            <div className="px-4 py-2">
              <div className="mb-2 px-2 pt-1 text-[9px] uppercase tracking-[0.26em] text-crt/25">
                {STATUS_LINES[statusIdx]}
                <span className="ml-2 blink text-crt/35">█</span>
              </div>
              {MOBILE_NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-crt/10 px-2 py-3.5 text-[15px] tracking-[0.2em] last:border-b-0 ${
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
