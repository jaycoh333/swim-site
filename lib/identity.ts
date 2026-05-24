'use client';

import { useState, useEffect } from 'react';

export type IdentityMode = 'anon' | 'ghost';

export interface SwimIdentity {
  mode: IdentityMode;
  handle: string;
  sessionKey: string;
}

const ANON_HANDLES = [
  'ANON', 'UNKNOWN NODE', 'GHOST', 'UNIDENTIFIED', 'NULL SOURCE',
];

const GHOST_HANDLES = [
  'STATIC_VEIL', 'REDACTED_033', 'DEADCHANNEL', 'MEMORYLEAK',
  'NORTHDRIFT', 'SIGNALBLEED', 'NULL_RELAY', 'LOSTCARRIER',
  'FRAGMENT_08', 'VOIDREADER', 'DARK_MODEM', 'ARCHIVE_X',
  'SIGNAL_GHOST', 'DEEPECHO', 'COLDMIRROR', 'DRIFT_NODE',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomKey(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function buildIdentity(mode: IdentityMode, customHandle?: string): SwimIdentity {
  return {
    mode,
    handle: mode === 'anon' ? pick(ANON_HANDLES) : (customHandle ?? pick(GHOST_HANDLES)),
    sessionKey: randomKey(),
  };
}

export function saveIdentity(identity: SwimIdentity): void {
  try {
    localStorage.setItem('swim-identity', JSON.stringify(identity));
  } catch {
    // storage unavailable — silently continue
  }
}

export function loadStoredIdentity(): SwimIdentity | null {
  try {
    const raw = localStorage.getItem('swim-identity');
    return raw ? (JSON.parse(raw) as SwimIdentity) : null;
  } catch {
    return null;
  }
}

export function useIdentity() {
  const [identity, setIdentityState] = useState<SwimIdentity | null>(null);

  useEffect(() => {
    const stored = loadStoredIdentity();
    if (stored) {
      setIdentityState(stored);
    } else {
      const fresh = buildIdentity('anon');
      saveIdentity(fresh);
      setIdentityState(fresh);
    }
  }, []);

  function setMode(mode: IdentityMode, customHandle?: string) {
    const next = buildIdentity(mode, customHandle);
    saveIdentity(next);
    setIdentityState(next);
  }

  function regenerate() {
    if (!identity) return;
    const next = buildIdentity(identity.mode);
    saveIdentity(next);
    setIdentityState(next);
  }

  return { identity, setMode, regenerate };
}
