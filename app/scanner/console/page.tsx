import { notFound } from 'next/navigation';
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
    /* scanner-console-modern overrides VT323 font + CRT green from body */
    <div className="scanner-console-modern relative min-h-screen bg-[#0b0e10] pt-[80px] md:pt-[100px]">
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
