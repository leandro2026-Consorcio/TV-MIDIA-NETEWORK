'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift, Laptop, Loader2, MonitorPlay, RefreshCw, Tv, Wallet } from 'lucide-react';
import { activateOrganicParticipantAction, createOrganicScreenAction, getOrganicDashboardAction, pairOrganicScreenAction, reserveOrganicRewardAction } from '@/app/actions/organic-network';

export default function OrganicNetworkPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState({ displayName: '', city: '', state: 'MT' });
  const [screen, setScreen] = useState({ name: '', deviceType: 'organic_tv' as 'organic_tv' | 'organic_windows_monitor', idleMinutes: 5 });
  const [pairing, setPairing] = useState<Record<string, string>>({});
  const [redemptionCode, setRedemptionCode] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getOrganicDashboardAction();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activate = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    const result = await activateOrganicParticipantAction(profile);
    setMessage(result.success ? 'Participação orgânica ativada.' : result.error || 'Falha ao ativar.');
    setBusy(false); if (result.success) await load();
  };

  const addScreen = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    const result = await createOrganicScreenAction({ name: screen.name, deviceType: screen.deviceType, idleStartSeconds: screen.idleMinutes * 60 });
    setMessage(result.success ? 'Tela criada. Abra /organic-tv no dispositivo e informe o código abaixo.' : result.error || 'Falha ao criar tela.');
    setBusy(false); if (result.success) { setScreen({ ...screen, name: '' }); await load(); }
  };

  const pair = async (screenId: string) => {
    setBusy(true); setMessage('');
    const result = await pairOrganicScreenAction(screenId, pairing[screenId] || '');
    setMessage(result.success ? 'Tela pareada e pronta para receber programação.' : result.error || 'Falha no pareamento.');
    setBusy(false); if (result.success) await load();
  };

  const reserve = async (rewardId: string) => {
    setBusy(true); setMessage('');
    const result = await reserveOrganicRewardAction(rewardId);
    if (result.success) { setRedemptionCode(result.code); setMessage('Benefício reservado. Guarde o código até o resgate.'); await load(); }
    else setMessage(result.error || 'Não foi possível reservar.');
    setBusy(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-cyan-400" /></div>;

  if (!data?.participant) return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div><h1 className="text-3xl font-black text-white">Ativar Rede Orgânica</h1><p className="mt-2 text-slate-400">Disponibilize sua TV ou Monitor Windows quando estiver sem uso e acumule microcréditos para benefícios locais.</p></div>
      <form onSubmit={activate} className="space-y-4 rounded-3xl border border-cyan-400/20 bg-slate-900 p-7">
        <input required placeholder="Seu nome" value={profile.displayName} onChange={e => setProfile({ ...profile, displayName: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
        <div className="grid gap-4 sm:grid-cols-[1fr_100px]"><input required placeholder="Cidade" value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" /><input required maxLength={2} value={profile.state} onChange={e => setProfile({ ...profile, state: e.target.value.toUpperCase() })} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 uppercase" /></div>
        <label className="flex gap-3 text-sm text-slate-300"><input required type="checkbox" /> Concordo em participar com exibições técnicas validadas, fator residencial 0,01 e limites antifraude.</label>
        <button disabled={busy} className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">Ativar minha tela orgânica</button>
      </form>
    </div>
  );

  const p = data.participant;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-white">Minha Rede Orgânica</h1><p className="mt-1 text-slate-400">TV e Monitor Windows residenciais usam fator 0,01.</p></div><button onClick={() => void load()} className="rounded-xl border border-slate-700 p-3"><RefreshCw className="h-4 w-4" /></button></div>
      {message && <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-200">{message}</div>}
      {redemptionCode && <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5"><p className="text-xs uppercase text-amber-300">Código do benefício</p><strong className="mt-2 block font-mono text-3xl tracking-widest text-white">{redemptionCode}</strong><p className="mt-2 text-xs text-slate-400">O código completo é mostrado somente agora. Guarde-o com segurança.</p></div>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric icon={Wallet} label="Disponível" value={Number(p.available_balance).toFixed(4)} />
        <Metric icon={RefreshCw} label="Pendente (48h)" value={Number(p.pending_balance).toFixed(4)} />
        <Metric icon={MonitorPlay} label="Telas orgânicas" value={String(data.screens.length)} />
      </div>
      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={addScreen} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-black">Adicionar tela orgânica</h2>
          <input required placeholder="Nome da tela" value={screen.name} onChange={e => setScreen({ ...screen, name: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
          <select value={screen.deviceType} onChange={e => setScreen({ ...screen, deviceType: e.target.value as any })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"><option value="organic_tv">TV residencial</option><option value="organic_windows_monitor">Monitor Windows residencial</option></select>
          {screen.deviceType === 'organic_windows_monitor' && <p className="rounded-xl bg-violet-400/10 p-3 text-xs text-violet-200">O Monitor Windows poderá iniciar com o computador, abrir em modo quiosque e entrar na programação após o tempo de inatividade.</p>}
          <label className="block text-sm text-slate-400">Iniciar após inatividade (minutos)<input type="number" min={0} max={1440} value={screen.idleMinutes} onChange={e => setScreen({ ...screen, idleMinutes: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" /></label>
          <button disabled={busy} className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">Cadastrar tela</button>
        </form>
        <div className="space-y-3">
          <h2 className="text-xl font-black">Minhas telas</h2>
          {data.screens.length === 0 && <p className="rounded-2xl border border-slate-800 p-5 text-sm text-slate-400">Nenhuma tela cadastrada.</p>}
          {data.screens.map((s: any) => <div key={s.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center gap-3">{s.device_type === 'organic_windows_monitor' ? <Laptop className="text-violet-300" /> : <Tv className="text-cyan-300" />}<div><strong>{s.name}</strong><p className="text-xs text-slate-400">{s.device_type === 'organic_windows_monitor' ? 'Monitor Windows residencial' : 'TV residencial'} · {s.status}</p></div></div>{s.status === 'pending_pairing' && <div className="mt-4 flex gap-2"><input maxLength={6} placeholder="Código de /organic-tv" value={pairing[s.id] || ''} onChange={e => setPairing({ ...pairing, [s.id]: e.target.value.toUpperCase() })} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono uppercase" /><button type="button" onClick={() => void pair(s.id)} className="rounded-xl bg-violet-500 px-4 text-sm font-bold">Parear</button></div>}</div>)}
        </div>
      </section>
      <section><h2 className="text-xl font-black">Benefícios disponíveis</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.rewards.map((r: any) => <article key={r.id} className="rounded-2xl border border-amber-300/20 bg-slate-900 p-5"><Gift className="text-amber-300" /><h3 className="mt-3 font-black">{r.title}</h3><p className="mt-1 text-xs text-slate-400">{r.companies?.trade_name} · {r.quantity_available} disponíveis</p><p className="mt-3 text-lg font-black text-amber-300">{Number(r.credits_required).toFixed(2)} créditos</p><button disabled={busy || Number(p.available_balance) < Number(r.credits_required)} onClick={() => void reserve(r.id)} className="mt-4 w-full rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-40">Reservar benefício</button></article>)}</div></section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: any) { return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><Icon className="h-5 w-5 text-cyan-300" /><strong className="mt-4 block text-2xl">{value}</strong><span className="text-xs text-slate-400">{label}</span></div>; }
