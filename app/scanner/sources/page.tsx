/**
 * /scanner/sources — curator source registry.
 *
 * ACCESS GATE: same as /scanner/queue — requires CURATOR_QUEUE_ENABLED=true.
 *
 * STATUS: REGISTRY ONLY — no automated fetchers connected.
 * Curators manage the list of candidate sources here.
 * Enabling a source does NOT trigger any automated scanning — that is a future phase.
 */

import { notFound } from 'next/navigation';
import { ScannerSourcesClient } from '@/components/ScannerSourcesClient';
import { getScannerSources } from '@/lib/supabase/repository';

export const dynamic = 'force-dynamic';

export default async function ScannerSourcesPage() {
  if (process.env.CURATOR_QUEUE_ENABLED !== 'true') {
    notFound();
  }

  const sources = await getScannerSources();

  return <ScannerSourcesClient sources={sources} />;
}
