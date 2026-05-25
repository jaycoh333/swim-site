import { ScannerClient } from '@/components/ScannerClient';
import { getRecoveredSignals } from '@/lib/supabase/repository';

export const dynamic = 'force-dynamic';

export default async function ScannerPage() {
  // Fetch only approved signals for the public page.
  // Pending / rejected signals are visible only in /scanner/queue (curator only).
  const approvedSignals = await getRecoveredSignals('approved');

  return <ScannerClient approvedSignals={approvedSignals} />;
}
