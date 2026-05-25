/**
 * /scanner/queue — curator signal review interface.
 *
 * ACCESS GATE:
 *   Set CURATOR_QUEUE_ENABLED=true in .env.local to access this page.
 *   When not set, the page returns 404 (does not reveal the route exists).
 *
 *   Future phase: replace this env gate with real session-based auth
 *   (Supabase Auth or NextAuth with curator role check).
 *
 * This page requires the SUPABASE_SERVICE_ROLE_KEY to be set so that
 * getRecoveredSignals() can read from the recovered_signals table (no anon access).
 */

import { notFound } from 'next/navigation';
import { SignalQueueClient } from '@/components/SignalQueueClient';
import { getRecoveredSignals } from '@/lib/supabase/repository';

export const dynamic = 'force-dynamic';

export default async function QueuePage() {
  // CURATOR GATE — set CURATOR_QUEUE_ENABLED=true in .env.local to unlock.
  // Returns 404 so the route doesn't leak its existence to unauthenticated users.
  if (process.env.CURATOR_QUEUE_ENABLED !== 'true') {
    notFound();
  }

  // Fetch all status buckets in parallel.
  // In production these queries use the service role key (bypasses RLS).
  const [pending, approved, archived, rejected] = await Promise.all([
    getRecoveredSignals('pending'),
    getRecoveredSignals('approved'),
    getRecoveredSignals('archived'),
    getRecoveredSignals('rejected'),
  ]);

  return (
    <SignalQueueClient
      pending={pending}
      approved={approved}
      archived={archived}
      rejected={rejected}
    />
  );
}
