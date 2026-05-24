'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type LineType = 'system' | 'success' | 'warn' | 'data' | 'em' | 'gap';

interface BootLine {
  text: string;
  delay: number;
  type: LineType;
}

const LINES: BootLine[] = [
  { text: 'SWIM NETWORK PROTOCOL v0.1.0', delay: 0, type: 'system' },
  { text: 'INITIALIZING SECURE CHANNEL...', delay: 500, type: 'system' },
  { text: 'LOCATING NODES...', delay: 1000, type: 'system' },
  { text: 'NODES FOUND: MANY', delay: 1600, type: 'success' },
  { text: 'IDENTITY CHECK: BYPASSED', delay: 2100, type: 'warn' },
  { text: 'ANONYMOUS ROUTING: ACTIVE', delay: 2600, type: 'success' },
  { text: '', delay: 3000, type: 'gap' },
  { text: 'IDENTIFIED USERS: 0', delay: 3200, type: 'data' },
  { text: 'CONNECTED PARTICIPANTS: UNKNOWN', delay: 3700, type: 'data' },
  { text: 'ARCHIVE INTEGRITY: VERIFIED', delay: 4200, type: 'success' },
  { text: '', delay: 4600, type: 'gap' },
  { text: 'YOU ARE NOT A USER.', delay: 4900, type: 'em' },
  { text: 'YOU ARE A PARTICIPANT.', delay: 5500, type: 'em' },
  { text: '', delay: 5900, type: 'gap' },
  { text: 'WELCOME TO SWIM.', delay: 6200, type: 'success' },
];

const TOTAL_DURATION = 6200 + 1200; // last line + hold
const FADE_START = TOTAL_DURATION;

interface BootSequenceProps {
  onComplete?: () => void;
}

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState<number[]>([]);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Only run boot sequence once per browser session
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('swim-boot')) {
      onComplete?.();
      return;
    }
    setVisible(true);

    const timers: ReturnType<typeof setTimeout>[] = [];

    LINES.forEach((line, i) => {
      timers.push(setTimeout(() => setShown(prev => [...prev, i]), line.delay));
    });

    timers.push(setTimeout(() => setFading(true), FADE_START));
    timers.push(setTimeout(() => {
      setDone(true);
      sessionStorage.setItem('swim-boot', '1');
      onComplete?.();
    }, FADE_START + 700));

    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || done) return null;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.7 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-void"
        >
          {/* Scanlines on boot screen */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.08) 2px,rgba(0,0,0,.08) 4px)',
            }}
          />

          <div className="relative w-full max-w-xl overflow-y-auto px-6 pt-20 pb-12 max-h-[100dvh] sm:max-h-none sm:overflow-visible sm:px-8 sm:pt-0 sm:pb-0">
            <div className="mb-8 text-center">
              <div className="text-xs tracking-[.3em] text-crt/30 uppercase">
                ── SWIM NETWORK ──
              </div>
            </div>
            <div className="space-y-1">
              {LINES.map((line, i) => (
                <AnimatePresence key={i}>
                  {shown.includes(i) && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18 }}
                      className={lineClass(line.type)}
                    >
                      {line.type === 'gap' ? (
                        <span>&nbsp;</span>
                      ) : (
                        <>
                          <span className="mr-3 text-crt/30">›</span>
                          {line.text}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              ))}
              {shown.length > 0 && shown.length < LINES.length && (
                <span
                  className="ml-6 inline-block h-4 w-2 animate-blink bg-crt"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function lineClass(type: LineType) {
  const base = 'font-mono tracking-wide leading-7';
  switch (type) {
    case 'system': return `${base} text-crt/50 text-sm`;
    case 'success': return `${base} text-crt text-sm crt-text-dim`;
    case 'warn': return `${base} text-amber text-sm`;
    case 'data': return `${base} text-crt/70 text-sm`;
    case 'em':
      return `${base} text-phosphor text-base crt-text`;
    default: return base;
  }
}
