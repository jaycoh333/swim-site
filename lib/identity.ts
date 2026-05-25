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

/**
 * Returns a stable device fingerprint stored in localStorage.
 * Used as anon_fingerprint for reaction deduplication — never tied to identity.
 * Regenerates only if localStorage is cleared (acceptable UX).
 */
export function getFingerprint(): string {
  try {
    const KEY = 'swim-fp';
    const stored = localStorage.getItem(KEY);
    if (stored) return stored;
    // crypto.getRandomValues is available in all modern browsers
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const fp = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(KEY, fp);
    return fp;
  } catch {
    // Storage blocked (private mode, etc.) — ephemeral fallback
    return Math.random().toString(36).slice(2, 18) + Date.now().toString(36);
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
