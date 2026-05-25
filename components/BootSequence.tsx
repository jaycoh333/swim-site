'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

type LineType = 'system' | 'success' | 'warn' | 'data' | 'em' | 'gap';

interface BootLine {
  text: string;
  delay: number;
  type: LineType;
}

const LINES: BootLine[] = [
  { text: 'SWIM NETWORK PROTOCOL v0.1.0',       delay: 0,    type: 'system'  },
  { text: 'INITIALIZING SECURE CHANNEL...',      delay: 500,  type: 'system'  },
  { text: 'LOCATING NODES...',                   delay: 1000, type: 'system'  },
  { text: 'NODES FOUND: MANY',                   delay: 1600, type: 'success' },
  { text: 'IDENTITY CHECK: BYPASSED',            delay: 2100, type: 'warn'    },
  { text: 'ANONYMOUS ROUTING: ACTIVE',           delay: 2600, type: 'success' },
  { text: '',                                    delay: 3000, type: 'gap'     },
  { text: 'IDENTIFIED USERS: 0',                 delay: 3200, type: 'data'    },
  { text: 'CONNECTED PARTICIPANTS: UNKNOWN',     delay: 3700, type: 'data'    },
  { text: 'ARCHIVE INTEGRITY: VERIFIED',         delay: 4200, type: 'success' },
  { text: '',                                    delay: 4600, type: 'gap'     },
  { text: 'YOU ARE NOT A USER.',                 delay: 4900, type: 'em'      },
  { text: 'YOU ARE A PARTICIPANT.',              delay: 5500, type: 'em'      },
  { text: '',                                    delay: 5900, type: 'gap'     },
  { text: 'WELCOME TO SWIM.',                    delay: 6200, type: 'success' },
];

const TOTAL_DURATION = 6200 + 1200;
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
          {/* Full-viewport scanlines */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.08) 2px,rgba(0,0,0,.08) 4px)',
            }}
          />

          {/*
            Terminal panel
            ─────────────
            Mobile:  w-[90vw] gives a real width narrower than the viewport so the outer
                     flex actually centers it. Panel border/bg/glow added for classified feel.
            Desktop: w-full up to max-w-xl (original behavior). Panel chrome stripped via sm: overrides.
          */}
          <div className="relative w-[90vw] max-w-xl overflow-y-auto border border-crt/20 bg-[rgba(2,4,3,0.96)] px-6 py-7 boot-panel-glow max-h-[85vh] sm:w-full sm:max-h-none sm:overflow-visible sm:border-0 sm:bg-transparent sm:px-8 sm:py-0 sm:shadow-none">

            {/* Panel header */}
            <div className="mb-5 sm:mb-8">
              {/* Sigil mark — mobile only */}
              <div className="mb-3 flex justify-center sm:hidden">
                <Image
                  src="/images/swim-sigil-logo.jpg"
                  alt=""
                  width={52}
                  height={52}
                  className="rounded-full border border-crt/18 boot-sigil-mark"
                />
              </div>
              <div className="text-center text-[10px] uppercase tracking-[0.32em] text-crt/38">
                SWIM NETWORK // CLASSIFIED ACCESS
              </div>
              {/* Divider line below header — mobile only */}
              <div className="mt-3 h-px bg-crt/12 sm:hidden" />
            </div>

            {/* Terminal lines */}
            <div className="space-y-0.5">
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
  // Mobile: text-base (16px) / text-lg (18px) for emphasis — readable without being huge
  // Desktop (sm+): text-sm (14px) / text-base (16px) — original compact terminal feel
  const base = 'font-mono tracking-wide leading-8 sm:leading-7';
  switch (type) {
    case 'system':  return `${base} text-base sm:text-sm text-crt/50`;
    case 'success': return `${base} text-base sm:text-sm text-crt crt-text-dim`;
    case 'warn':    return `${base} text-base sm:text-sm text-amber`;
    case 'data':    return `${base} text-base sm:text-sm text-crt/70`;
    case 'em':      return `${base} text-lg sm:text-base text-phosphor crt-text`;
    default:        return base;
  }
}
