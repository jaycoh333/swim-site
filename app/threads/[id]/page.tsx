import { THREAD_SEED } from '@/lib/seed-data';
import { ThreadView } from '@/components/ThreadView';

export function generateStaticParams() {
  return THREAD_SEED.map((t) => ({ id: t.id }));
}

type Params = Promise<{ id: string }>;

export default async function ThreadPage({ params }: { params: Params }) {
  const { id } = await params;
  return <ThreadView threadId={id} />;
}
