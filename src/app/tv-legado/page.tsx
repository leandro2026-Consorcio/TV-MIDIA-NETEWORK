import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function LegacyTvPage() {
  const cookieStore = cookies();
  const deviceToken = cookieStore.get('rede_indoor_device_token')?.value;
  const pendingPairing = cookieStore.get('mpm_tv_pairing_code')?.value
    && cookieStore.get('mpm_tv_pairing_secret')?.value;

  if (deviceToken) {
    redirect('/tv?legado=1');
  }
  if (pendingPairing) redirect('/api/tv/pairing/status');

  redirect('/api/tv/pairing/start');
}
