'use client';

import { useState, useEffect } from 'react';

const SIGNALS = [
  'ACTIVE SIGNAL DETECTED',
  'ARCHIVE NODE ONLINE',
  '$SWIM SIGNAL ACTIVE',
  'HIGH RESONANCE DETECTED',
  'GHOST PARTICIPANTS ACTIVE',
  'NEW TRANSMISSION RECEIVED',
  'WITNESS COUNT RISING',
  'ARCHIVE DRIFT IN PROGRESS',
  'MEMORY RECOVERED FROM DEAD NODE',
  'ANONYMOUS PRESENCE DETECTED',
  'SIGNAL VELOCITY RISING',
  'MOST WITNESSED THREAD ACTIVE',
  'ECHO CLUSTER DETECTED',
  'SURVEILLANCE ARCHIVE ONLINE',
  'THE NETWORK REMEMBERS.',
];

export function SignalTicker() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      const swap = setTimeout(() => {
        setIdx((i) => (i + 1) % SIGNALS.length);
        setVisible(true);
      }, 220);
      return () => clearTimeout(swap);
    }, 4400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="signal-ticker" aria-live="polite" aria-label="Live signal">
      <span className="signal-ticker-dot blink" aria-hidden="true">█</span>
      <span
        className="signal-ticker-msg"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {SIGNALS[idx]}
      </span>
      <span className="signal-ticker-suffix" aria-hidden="true">■■□□□</span>
    </div>
  );
}
