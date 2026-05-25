import { SubmitSignalClient } from '@/components/SubmitSignalClient';

export const metadata = {
  title:       'Submit Signal — SWIM',
  description: 'Submit a strange thread, archive fragment, or impossible story to the SWIM recovered signal archive.',
};

export default function SubmitSignalPage() {
  return <SubmitSignalClient />;
}
