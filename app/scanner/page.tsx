import { ScannerClient } from '@/components/ScannerClient';
import { getRecoveredSignals, getScannerStats } from '@/lib/supabase/repository';

export const dynamic = 'force-dynamic';

export default async function ScannerPage() {
  const [approvedSignals, stats] = await Promise.all([
    getRecoveredSignals('approved'),
    getScannerStats(),
  ]);

  return <ScannerClient approvedSignals={approvedSignals} stats={stats} />;
}
