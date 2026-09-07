'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Laptop, Loader2, Maximize2, Tv } from 'lucide-react';
import { checkOrganicPairingAction, getOrganicProgrammingAction, recordOrganicPlaybackAction, requestOrganicPairingCodeAction } from '@/app/actions/organic-network';

const TOKEN_KEY = 'midia_organic_device_token';
const PAIR_KEY = 'midia_organic_pairing';

export default function OrganicTvPage() {
  const [token, setToken] = useState<string | null>(null);
  const [pairCode, setPairCode] = useState('');
  const [status, setStatus] = useState<'loading' | 'pairing' | 'playing' | 'empty' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [screen, setScreen] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const session = useRef(crypto.randomUUID());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (deviceToken: string) => {
    const result = await getOrganicProgrammingAction(deviceToken);
    if (!result.success) { setStatus('error'); setMessage(result.error || 'Player indisponível.'); return; }
    setScreen(result.screen); setItems(result.items || []); setIndex(i => result.items.length ? i % result.items.length : 0);
    setStatus(result.items.length ? 'playing' : 'empty');
    setMessage(result.items.length ? '' : 'Tela pareada. Aguardando campanhas com benefícios disponíveis.');
  }, []);

  const beginPairing = useCallback(async () => {
    const savedPair = localStorage.getItem(PAIR_KEY);
    let pair = savedPair ? JSON.parse(savedPair) : null;
    if (!pair || new Date(pair.expiresAt).getTime() <= Date.now()) {
      const secret = `${crypto.randomUUID()}_${crypto.randomUUID()}`;
      const result = await requestOrganicPairingCodeAction(secret);
      if (!result.success) { setStatus('error'); setMessage(result.error || 'Falha ao gerar pareamento.'); return; }
      pair = { code: result.code, secret, expiresAt: result.expiresAt };
      localStorage.setItem(PAIR_KEY, JSON.stringify(pair));
    }
    setPairCode(pair.code); setStatus('pairing');
    const poll = window.setInterval(async () => {
      const result = await checkOrganicPairingAction(pair.code, pair.secret);
      if (result.status === 'paired' && result.deviceToken) {
        window.clearInterval(poll); localStorage.removeItem(PAIR_KEY); localStorage.setItem(TOKEN_KEY, result.deviceToken);
        setToken(result.deviceToken); await load(result.deviceToken);
      } else if (result.status === 'expired' || result.status === 'invalid') {
        window.clearInterval(poll); localStorage.removeItem(PAIR_KEY); setStatus('error'); setMessage('Código expirado. Atualize a página para gerar outro.');
      }
    }, 2000);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) { setToken(saved); void load(saved); } else void beginPairing();
  }, [beginPairing, load]);

  useEffect(() => {
    if (!token) return;
    const refresh = window.setInterval(() => void load(token), 60_000);
    return () => window.clearInterval(refresh);
  }, [token, load]);

  const finish = useCallback(async () => {
    if (!token || !items[index]) return;
    const item = items[index];
    await recordOrganicPlaybackAction(token, { rewardId: item.rewardId, campaignId: item.campaignId, mediaId: item.mediaId, duration: item.duration, idempotencyKey: `${session.current}:${item.id}:${Date.now()}` });
    setIndex(i => (i + 1) % items.length);
  }, [index, items, token]);

  useEffect(() => {
    if (status !== 'playing' || !items[index] || items[index].mediaType !== 'image') return;
    timer.current = setTimeout(() => void finish(), Math.max(5, items[index].duration) * 1000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [finish, index, items, status]);

  const fullscreen = () => document.documentElement.requestFullscreen?.();
  const item = items[index];
  return <main className="fixed inset-0 flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black text-white">
    <button onClick={() => void fullscreen()} className="fixed bottom-4 left-4 z-50 rounded-full border border-white/20 bg-black/70 p-3"><Maximize2 /></button>
    {status === 'loading' && <Loader2 className="h-12 w-12 animate-spin text-cyan-400" />}
    {status === 'pairing' && <div className="text-center"><Tv className="mx-auto h-20 w-20 text-cyan-300" /><h1 className="mt-6 text-3xl font-black">Tela Orgânica</h1><p className="mt-3 text-slate-400">No portal, abra Rede Orgânica e informe:</p><strong className="mt-5 block font-mono text-6xl tracking-[.18em] text-cyan-300">{pairCode}</strong></div>}
    {(status === 'empty' || status === 'error') && <div className="max-w-xl p-8 text-center"><Laptop className="mx-auto h-16 w-16 text-violet-300" /><h1 className="mt-5 text-2xl font-black">{screen?.name || 'Rede Orgânica'}</h1><p className="mt-3 text-slate-400">{message}</p></div>}
    {status === 'playing' && item && <div className="h-full w-full">{item.mediaType === 'video' ? <video key={item.id} src={item.url} autoPlay muted playsInline onEnded={() => void finish()} onError={() => void finish()} className="h-full w-full object-contain" /> : <img key={item.id} src={item.url} alt={item.title} onError={() => void finish()} className="h-full w-full object-contain" />}<div className="fixed bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white/50">Tela Orgânica · fator 0,01</div></div>}
  </main>;
}
