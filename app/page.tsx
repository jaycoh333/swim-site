import { HomeClient } from '@/components/HomeClient';
import { getRecoveredSignals, getScannerStats, hasSupabase } from '@/lib/supabase/repository';
import { signalsToTerminalFeed } from '@/lib/terminal-feed';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [approvedSignals, stats] = await Promise.all([
    getRecoveredSignals('approved'),
    getScannerStats(),
  ]);

  const terminalFeed = signalsToTerminalFeed(approvedSignals ?? []);

  return (
    <HomeClient
      terminalFeed={terminalFeed}
      stats={stats}
      isLive={hasSupabase}
    />
  );
}
