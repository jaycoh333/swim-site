'use client';

import { GhostIdentity } from '@/lib/forum-types';

interface GhostPanelProps {
  ghost: GhostIdentity;
}

export function GhostPanel({ ghost }: GhostPanelProps) {
  return (
    <div className="panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-crt/12 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 bg-crt/60 animate-pulse-glow"
            aria-hidden="true"
          />
          <span className="text-[12px] uppercase tracking-[0.26em] text-phosphor/65">
            {ghost.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-crt/22">
          <span>session</span>
          <span className="blink text-crt/35">█</span>
        </div>
      </div>

      {/* Identity grid */}
      <div className="grid gap-0 md:grid-cols-[80px_1fr]">
        {/* Sigil */}
        <div className="archive-stat flex items-center justify-center border-b border-crt/10 p-3 md:border-b-0 md:border-r">
          <pre className="ghost-sigil select-none">
            {ghost.sigil.join('\n')}
          </pre>
        </div>

        {/* Data */}
        <div className="space-y-2.5 p-3 text-[0.95rem] leading-tight">
          <div>
            <div className="mb-0.5 text-[9px] uppercase tracking-[0.24em] text-crt/25">handle</div>
            <div className="text-crt crt-text-dim">{ghost.handle}</div>
          </div>

          <div className="grid grid-cols-2 gap-x-3">
            <div>
              <div className="mb-0.5 text-[9px] uppercase tracking-[0.24em] text-crt/25">joined</div>
              <div className="text-crt/55">{ghost.joinedAt}</div>
            </div>
            <div>
              <div className="mb-0.5 text-[9px] uppercase tracking-[0.24em] text-crt/25">echoes</div>
              <div className="text-crt/55">{ghost.echoesReceived}</div>
            </div>
          </div>

          <div>
            <div className="mb-0.5 text-[9px] uppercase tracking-[0.24em] text-crt/25">active boards</div>
            <div className="text-crt/42 text-[0.88rem]">{ghost.activeCategories.join(' · ')}</div>
          </div>
        </div>
      </div>

      {/* Participant philosophy */}
      <div className="participant-label px-3 py-2.5">
        <div className="space-y-0.5 text-[10px] uppercase tracking-[0.22em]">
          <div className="text-crt/35">you are not a user.</div>
          <div className="text-crt/55">you are a participant.</div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-3 py-2 text-[9px] uppercase tracking-[0.22em]">
        <span className="text-crt/22">ghost expires: session</span>
        <button className="text-crt/35 hover:text-crt/65 transition-colors">
          [ regenerate ]
        </button>
      </div>
    </div>
  );
}
