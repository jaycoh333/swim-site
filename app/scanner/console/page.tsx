import { notFound } from 'next/navigation';
import { AmbientGrid } from '@/components/AmbientGrid';
import {
  getScannerSources,
  getRecoveredSignals,
  getScannerStats,
} from '@/lib/supabase/repository';
import { ScannerConsoleClient } from '@/components/ScannerConsoleClient';

export const dynamic = 'force-dynamic';

export default async function ScannerConsolePage() {
  if (process.env.CURATOR_QUEUE_ENABLED !== 'true') notFound();

  const [sources, pending, reviewing, ready, stats] = await Promise.all([
    getScannerSources(),
    getRecoveredSignals('pending'),
    getRecoveredSignals('reviewing'),
    getRecoveredSignals('rebirth-ready'),
    getScannerStats(),
  ]);

  const enabledSources = sources.filter((s) => s.enabled);

  return (
    <div className="relative min-h-screen pt-[80px] md:pt-[100px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-[0.015]" />
      <ScannerConsoleClient
        sources={sources}
        enabledSources={enabledSources}
        initialReviewSignals={[...pending, ...reviewing]}
        initialReadySignals={ready}
        stats={stats}
      />
    </div>
  );
}
