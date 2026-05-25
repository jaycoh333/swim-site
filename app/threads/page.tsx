import { getThreads } from '@/lib/supabase/repository';
import { mockDb } from '@/lib/mock-db';
import { ThreadsClient } from '@/components/ThreadsClient';

// Always SSR so newly created threads appear immediately without a cache delay.
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ThreadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const initialCategory =
    typeof sp.category === 'string' ? sp.category : null;
  const initialCompose = sp.compose === 'true';

  const [threads, ghost, draft, categories] = await Promise.all([
    getThreads('ALL'),
    Promise.resolve(mockDb.getGhostIdentity()),
    Promise.resolve(mockDb.getCreateThreadDraft()),
    Promise.resolve(mockDb.getSeededCategories()),
  ]);

  return (
    <ThreadsClient
      initialThreads={threads}
      initialCategory={initialCategory}
      initialCompose={initialCompose}
      ghost={ghost}
      draft={draft}
      categories={categories}
    />
  );
}
