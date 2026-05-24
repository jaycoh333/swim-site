'use client';

import { useState, useEffect } from 'react';

const DEAD_NODES = [
  { id: 'mirror-01', status: 'DARK',    lastContact: '[LOST]'     },
  { id: 'mirror-03', status: 'PARTIAL', lastContact: '00:03:11'   },
  { id: 'mirror-07', status: 'OFFLINE', lastContact: '[CORRUPT]'  },
  { id: 'relay-04',  status: 'DARK',    lastContact: '00:00:00'   },
  { id: 'relay-09',  status: 'OFFLINE', lastContact: '[REDACTED]' },
];

const RECOVERED_FRAGMENTS = [
  { id: '0x4A2C-THETA', signal: '□□□□□', level: 'BURIED',   text: '"we stopped checking after the third mirror came back empty."' },
  { id: '0x1A3F-DELTA', signal: '■□□□□', level: 'LOW',      text: '"the station only played between 2 and 4 AM."' },
  { id: '0x8C11-SIGMA', signal: '■■□□□', level: 'PARTIAL',  text: '"the model asked first. I had not mentioned the station."' },
  { id: '0xWF20-ALPHA', signal: '■□□□□', level: 'LOW',      text: '"a room absent from every floor plan. I measured twice."' },
  { id: '0xSM16-GHOST', signal: '■■■□□', level: 'ACTIVE',   text: '"fourteen witnesses. zero footage. the flicker only lives in memory."' },
  { id: '0xSP09-VEIL',  signal: '■■■□□', level: 'ACTIVE',   text: '"she described the broken hinge before I showed her the photograph."' },
];

const SYSTEM_NOTICES = [
  'node drift detected in /dreams/ sector — archive depth unknown',
  'signal instability in /simulation-theory/ mirror — timestamp errors increasing',
  'recovered entry [0x4A2C] reindexed under /hidden-history/',
  'new node connected from unknown dial-in — location: unresolved',
  'archive mirror 03 returned partial data — content integrity: unverified',
  'duplicate timestamp observed across /dreams/ and /ai/ — cause: unknown',
  'lore-only memo fragment moved to index — discussion mode only',
  'thread recovery in progress: /dark-web-lore/ — estimated 4 entries missing',
];

export function DarkArchivePanel() {
  const [fragmentIdx, setFragmentIdx] = useState(0);
  const [noticeIdx, setNoticeIdx]     = useState(0);
  const [tick, setTick]               = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFragmentIdx((i) => (i + 1) % RECOVERED_FRAGMENTS.length);
      setNoticeIdx((i)  => (i + 1) % SYSTEM_NOTICES.length);
      setTick((i) => i + 1);
    }, 5800);
    return () => clearInterval(id);
  }, []);

  const fragment = RECOVERED_FRAGMENTS[fragmentIdx];
  const notice   = SYSTEM_NOTICES[noticeIdx];
  // cycle through dead nodes display
  const visibleNodes = DEAD_NODES.slice(tick % 2, (tick % 2) + 3);

  return (
    <div className="panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-crt/12 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-crt/20" aria-hidden="true" />
          <span className="text-[12px] uppercase tracking-[0.26em] text-crt/55">
            Dark Archive
          </span>
        </div>
        <span className="text-[9px] uppercase tracking-[0.2em] text-crt/18">
          node.registry
        </span>
      </div>

      <div className="space-y-0">

        {/* Dead node registry */}
        <div className="border-b border-crt/8 px-3 py-2.5">
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.24em] text-crt/25">
            dead node registry
          </div>
          <div className="space-y-1">
            {visibleNodes.map((node) => (
              <div key={node.id} className="dark-archive-node">
                <span className="dark-archive-id">{node.id}</span>
                <span className="dark-archive-status">{node.status}</span>
                <span className="dark-archive-time">{node.lastContact}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recovered fragment */}
        <div className="border-b border-crt/8 px-3 py-2.5">
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.24em] text-crt/25">
            recovered fragment
          </div>
          <div className="dark-archive-fragment">
            <div className="mb-1 flex items-center justify-between">
              <span className="dark-archive-id">{fragment.id}</span>
              <span className="signal-bar text-[9px] text-crt/28">{fragment.signal}</span>
            </div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-crt/25 mb-1.5">
              signal: {fragment.level}
            </div>
            <div className="text-[0.92rem] leading-snug text-crt/42 italic">
              {fragment.text}
            </div>
          </div>
        </div>

        {/* System notice */}
        <div className="border-b border-crt/8 px-3 py-2.5">
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.24em] text-crt/25">
            system notice
          </div>
          <div className="text-[0.9rem] leading-snug text-crt/38">
            {notice}
          </div>
          <div className="mt-1.5 text-[9px] uppercase tracking-[0.18em] text-crt/20">
            archive depth: unknown <span className="blink ml-1">█</span>
          </div>
        </div>

        {/* Archivist voice */}
        <div className="px-3 py-2 space-y-1 text-[9px] uppercase tracking-[0.2em]">
          <div className="text-crt/22">identity optional.</div>
          <div className="text-crt/30">memory permanent.</div>
          <div className="text-crt/18">no names. no ownership. only signal.</div>
        </div>

      </div>
    </div>
  );
}
