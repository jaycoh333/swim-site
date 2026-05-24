'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

const ROTATING_STATUS = [
  'all channels open',
  'ghost mode: active',
  'no identity required',
  'signal stable — ■■■□□',
  'archive: sealed',
  'the network remembers.',
  'you are a participant.',
  'swim protocol v0.1',
];

interface SwimHeaderProps {
  participants: number;
  clock: string;
  statusIdx: number;
}

export function SwimHeader({
  participants,
  clock,
  statusIdx,
}: SwimHeaderProps) {
  const statusMsg = ROTATING_STATUS[statusIdx % ROTATING_STATUS.length];

  return (
    <div className="swim-header" role="banner">

      {/* ── Background image layer (aria-hidden — purely decorative) ── */}
      <div className="swim-header-bg-layer" aria-hidden="true">
        <Image
          src="/images/swim-header-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
        <div className="swim-header-dim" />
        <div className="swim-header-scanlines" />
        <div className="swim-header-vignette" />
        <div className="swim-header-bottom-fade" />
      </div>

      {/* ── Overlay content (all real HTML, fully interactive) ── */}
      <div className="swim-header-content">

        {/* Top status bar — minimal on mobile, more detail on desktop */}
        <div className="swim-header-meta" aria-label="System status">
          <span className="swim-meta-item">
            <span className="swim-meta-value">{participants}</span>
            <span className="swim-meta-label"> online</span>
          </span>
          <span className="swim-meta-item hidden sm:flex">
            <span className="swim-meta-label">sig:</span>
            <span className="swim-meta-value">■■■□□</span>
          </span>
          <span className="swim-meta-item hidden md:flex">
            <span className="swim-meta-label">archive:</span>
            <span className="swim-meta-value">sealed</span>
          </span>
          <span className="blink swim-meta-blink ml-auto" aria-hidden="true">█</span>
        </div>

        {/* Masthead — entire area is a clickable home link */}
        <Link href="/" className="swim-header-masthead" aria-label="SWIM home">
          <p className="swim-header-eyebrow">someone who isn&apos;t me</p>
          <h1 className="swim-header-logo">$SWIM</h1>
          <p className="swim-header-subline">
            no accounts&nbsp;·&nbsp;no ids&nbsp;·&nbsp;no tracking
          </p>
        </Link>

        {/* Rotating status strip — visible sm and up only */}
        <div
          className="swim-header-status-strip"
          aria-live="polite"
          aria-label="Network status"
        >
          <span className="swim-status-clock">{clock}</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={statusIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="swim-header-status-msg"
            >
              {statusMsg}
            </motion.span>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
