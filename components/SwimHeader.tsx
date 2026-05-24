'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { AsciiSigil } from '@/components/AsciiSigil';
import { CategoryRail } from '@/components/CategoryRail';

const ROTATING_STATUS = [
  'all channels open',
  'ghost mode: active',
  'no identity required',
  'signal: ■■■□□  stable',
  'archive: sealed / stable',
  'the network remembers.',
  'you are a participant.',
  'swim protocol v0.1',
];

interface SwimHeaderProps {
  participants: number;
  clock: string;
  statusIdx: number;
  categories: readonly string[];
  activeCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
}

export function SwimHeader({
  participants,
  clock,
  statusIdx,
  categories,
  activeCategory,
  onSelectCategory,
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
        {/* Darkening overlay so text remains readable */}
        <div className="swim-header-dim" />
        {/* CRT scanlines */}
        <div className="swim-header-scanlines" />
        {/* Edge vignette */}
        <div className="swim-header-vignette" />
        {/* Bottom gradient fade into forum shell */}
        <div className="swim-header-bottom-fade" />
      </div>

      {/* ── Overlay content (all real HTML, fully interactive) ── */}
      <div className="swim-header-content">

        {/* Top microdetails strip */}
        <div className="swim-header-meta" aria-label="System status">
          <span className="signal-bar">SIG:■■■□□</span>
          <span>nodes:<span className="text-crt/55">247</span></span>
          <span>online:<span className="text-crt/70">{participants}</span></span>
          <span className="hidden sm:inline">ver:2001.5.15</span>
          <span className="hidden md:inline">archive:sealed</span>
          <span className="hidden md:inline">ghost:active</span>
          <span className="blink text-crt/18">█</span>
        </div>

        {/* Masthead — SWIM logo + taglines */}
        <div className="swim-header-masthead">
          <div className="swim-header-eyebrow">
            SOMEONE WHO ISN&apos;T ME
          </div>

          <div className="swim-header-logo-row" aria-label="SWIM">
            <span className="swim-header-sigil" aria-hidden="true">
              <AsciiSigil />
            </span>
            <h1 className="swim-header-logo">$SWIM</h1>
            <span className="swim-header-sigil" aria-hidden="true">
              <AsciiSigil />
            </span>
          </div>

          <div className="swim-header-subline">
            no accounts&nbsp;·&nbsp;no ids&nbsp;·&nbsp;no tracking&nbsp;·&nbsp;just minds
          </div>
        </div>

        {/* Rotating status strip */}
        <div className="swim-header-status-strip" aria-live="polite" aria-label="Network status">
          <span className="text-crt/22">{clock}</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={statusIdx}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.22 }}
              className="swim-header-status-msg"
            >
              {statusMsg}
            </motion.span>
          </AnimatePresence>
          <span className="text-crt/22">node.anonymous</span>
        </div>

        {/* Category rail — real interactive buttons overlaid at bottom */}
        <CategoryRail
          categories={categories}
          active={activeCategory}
          onSelect={onSelectCategory}
        />
      </div>
    </div>
  );
}
