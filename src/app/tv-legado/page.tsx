import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

interface LegacyTvPageProps {
  searchParams?: { novo?: string };
}

export default function LegacyTvPage({ searchParams }: LegacyTvPageProps) {
  const cookieStore = cookies();
  const deviceToken = cookieStore.get('rede_indoor_device_token')?.value;
  const pendingPairing = cookieStore.get('mpm_tv_pairing_code')?.value
    && cookieStore.get('mpm_tv_pairing_secret')?.value;

  if (searchParams?.novo === '1') {
    redirect('/api/tv/pairing/start?force=1');
  }
  if (deviceToken) {
    redirect('/tv?legado=1');
  }
  if (pendingPairing) redirect('/api/tv/pairing/status');

  redirect('/api/tv/pairing/start');
}
