import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PlayerPage from '../player/page';

interface TvPageProps {
  searchParams?: {
    parear?: string;
  };
}

export default function TvPage({ searchParams }: TvPageProps) {
  const cookieStore = cookies();
  const deviceToken = cookieStore.get('rede_indoor_device_token')?.value;
  const pendingPairing = cookieStore.get('mpm_tv_pairing_code')?.value
    && cookieStore.get('mpm_tv_pairing_secret')?.value;
  const forcePairing = searchParams?.parear === '1';

  if (forcePairing) {
    redirect('/api/tv/pairing/start?force=1');
  }
  if (!deviceToken && pendingPairing) {
    redirect('/api/tv/pairing/status');
  }
  if (!deviceToken) redirect('/api/tv/pairing/start');

  return <PlayerPage />;
}
