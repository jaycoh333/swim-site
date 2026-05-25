import { HomeClient } from '@/components/HomeClient';

// Always SSR so any future dynamic data appears immediately.
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <HomeClient />;
}
