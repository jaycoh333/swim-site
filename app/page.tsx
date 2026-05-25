import { getHighlightedThreads, getHotThreads } from '@/lib/supabase/repository';
import { HomeClient } from '@/components/HomeClient';

// Always SSR so freshly posted threads appear immediately.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [initialHighlightedThreads, initialHotThreads] = await Promise.all([
    getHighlightedThreads(),
    getHotThreads(),
  ]);

  return (
    <HomeClient
      initialHighlightedThreads={initialHighlightedThreads}
      initialHotThreads={initialHotThreads}
    />
  );
}
