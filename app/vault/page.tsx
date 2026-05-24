'use client';

import { motion } from 'framer-motion';
import { AmbientGrid } from '@/components/AmbientGrid';
import { GlitchText } from '@/components/GlitchText';
import { PixelButton } from '@/components/PixelButton';

const VAULT_ROOMS = [
  {
    id: 'V-001',
    name: 'THE DEEP ARCHIVE',
    description: 'Pre-2002 entries. The oldest transmissions. Things that were never meant to be found.',
    requirement: '100 $SWIM',
    locked: true,
  },
  {
    id: 'V-002',
    name: 'ENCRYPTED CONFESSIONS',
    description: 'High-signal confessions that requested additional anonymity. Double-layered. Unindexed.',
    requirement: '250 $SWIM',
    locked: true,
  },
  {
    id: 'V-003',
    name: 'THE SIGNAL ROOM',
    description: 'Live encrypted transmissions. Real-time. Unmonitored. What happens here stays here.',
    requirement: '500 $SWIM',
    locked: true,
  },
  {
    id: 'V-004',
    name: 'GHOST IDENTITIES',
    description: 'Premium temporary handles with custom expiry. Branded sigils. Untraceable sessions.',
    requirement: '50 $SWIM',
    locked: true,
  },
  {
    id: 'V-005',
    name: 'THE THEORY CHAMBER',
    description: 'Collaborative anonymous research threads. Long-form. Cited. Deeply strange.',
    requirement: '150 $SWIM',
    locked: true,
  },
  {
    id: 'V-006',
    name: 'ARCHIVE BOOSTS',
    description: 'Amplify entries. Increase signal strength. Surface buried transmissions. Rewrite the order.',
    requirement: '75 $SWIM',
    locked: true,
  },
];

export default function VaultPage() {
  return (
    <div className="relative min-h-screen pt-16">
      <AmbientGrid className="pointer-events-none fixed inset-0 opacity-40" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <div className="mb-2 text-xs tracking-[.3em] text-crt/25 uppercase">
            SWIM NETWORK // TOKEN-GATED
          </div>
          <GlitchText
            as="h1"
            intensity="medium"
            className="crt-text font-terminal text-5xl tracking-wide uppercase"
          >
            THE VAULT
          </GlitchText>
          <p className="mt-3 text-sm text-crt/40 tracking-widest">
            Access requires $SWIM. Token-gated. No exceptions.
          </p>
        </motion.div>

        {/* Access denied banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8 border border-amber/40 bg-amber/5 p-4 text-center"
        >
          <p className="amber-glow text-base tracking-widest uppercase">
            ⚠ ACCESS DENIED — WALLET NOT CONNECTED
          </p>
          <p className="mt-1 text-xs text-crt/35 tracking-widest">
            Connect a wallet holding $SWIM to unlock vault rooms
          </p>
        </motion.div>

        {/* Vault rooms grid */}
        <div className="grid gap-5 md:grid-cols-2">
          {VAULT_ROOMS.map((room, i) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.08 }}
              className="panel relative overflow-hidden p-5 opacity-60"
            >
              {/* Lock overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-5xl text-crt/8 select-none">⌒</span>
              </div>

              <div className="relative">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="text-[11px] text-crt/30 tracking-widest">{room.id}</div>
                    <h2 className="mt-1 text-base tracking-widest text-crt/60 uppercase">{room.name}</h2>
                  </div>
                  <div className="border border-crt/20 px-3 py-1 text-xs text-crt/35 tracking-widest">
                    LOCKED
                  </div>
                </div>
                <p className="text-sm text-crt/40 leading-relaxed">{room.description}</p>
                <div className="mt-4 text-xs text-crt/25 tracking-widest">
                  REQUIRES: {room.requirement}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Token info */}
        <div className="mt-10 border border-crt/15 p-8 text-center">
          <p className="text-lg text-crt/50 tracking-widest uppercase">HOW TO ACCESS</p>
          <ol className="mt-6 space-y-3 text-sm text-crt/40 text-left max-w-md mx-auto">
            <li><span className="text-crt/25">01.</span> Acquire $SWIM tokens</li>
            <li><span className="text-crt/25">02.</span> Connect your wallet (coming Phase 3)</li>
            <li><span className="text-crt/25">03.</span> Vault rooms unlock automatically based on balance</li>
            <li><span className="text-crt/25">04.</span> No names. No verification. Just $SWIM.</li>
          </ol>
          <div className="mt-8">
            <PixelButton size="md" className="opacity-50 cursor-not-allowed">
              CONNECT WALLET (COMING SOON)
            </PixelButton>
          </div>
        </div>
      </div>
    </div>
  );
}
