import { redirect } from 'next/navigation';
import { getCollaborativeNetworkDashboardAction } from '@/app/actions/collaborative-network';
import CollaborativeNetworkClient from './collaborative-network-client';

export default async function CollaborativeNetworkPage() {
  const result = await getCollaborativeNetworkDashboardAction();
  if (!result.success) redirect('/login');
  return <CollaborativeNetworkClient initialData={result} />;
}
