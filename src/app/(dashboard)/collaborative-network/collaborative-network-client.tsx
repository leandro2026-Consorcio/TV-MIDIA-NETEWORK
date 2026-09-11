'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, CalendarClock, CircleDollarSign, Handshake, Megaphone, Network, ShieldCheck, Tv, Users } from 'lucide-react';
import { acceptCollaborativeOfferAction, createCollaborativeCampaignAction, setCollaborativeChannelAction } from '@/app/actions/collaborative-network';

const destinationOptions = [
  ['ownTvs', 'Minhas TVs', Tv], ['ownInstagram', 'Meu Instagram', Network], ['ownFacebook', 'Meu Facebook', Network],
  ['ownTikTok', 'Meu TikTok (manual)', Network], ['collaborativeTvs', 'Rede de TVs', Tv],
  ['collaborativeBusinesses', 'Páginas Empresariais', Handshake], ['collaborativeCreators', 'Creators', Users],
] as const;

export default function CollaborativeNetworkClient({ initialData }: { initialData: any }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'campaigns' | 'opportunities' | 'channels'>('campaigns');
  const [form, setForm] = useState<any>({ companyId: initialData.companies[0]?.id || '', name: '', description: '', startsOn: '', endsOn: '', rewardMode: 'mpm_credits', budgetTotal: 0, recurrence: 'once', ownTvs: true, ownInstagram: false, ownFacebook: false, ownTikTok: false, collaborativeTvs: false, collaborativeBusinesses: false, collaborativeCreators: false });
  const enabled = Boolean(initialData.flags.collaborative_media_network_enabled);
  const companyIds = useMemo(() => new Set(initialData.companies.map((company: any) => company.id)), [initialData.companies]);
  const participantChannels = useMemo(() => initialData.channels.filter((channel: any) =>
    (channel.owner_type === 'creator' && channel.owner_id === initialData.creator?.id)
    || (channel.owner_type === 'company' && companyIds.has(channel.owner_id))), [initialData.channels, initialData.creator?.id, companyIds]);
  const creatorChannels = useMemo(() => participantChannels.filter((channel: any) => channel.owner_type === 'creator'), [participantChannels]);

  function submitCampaign(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    startTransition(async () => {
      const result = await createCollaborativeCampaignAction({ ...form, budgetTotal: Number(form.budgetTotal) });
      if (!result.success) return setMessage(result.error || 'Falha ao criar campanha.');
      router.push(`/campaigns/${result.campaignId}`); router.refresh();
    });
  }

  return <div className="max-w-7xl mx-auto space-y-6">
    <div className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/30 p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[.22em] text-purple-400">MPM V1</p><h1 className="mt-1 text-3xl font-black text-white">Rede Colaborativa Multicanal</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">Uma campanha, vários criativos, TVs próprias, redes conectadas, empresas participantes e Creators — com reserva e liquidação auditáveis.</p></div>
        <div className={`rounded-full border px-4 py-2 text-xs font-black ${enabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}><ShieldCheck className="mr-2 inline h-4 w-4" />{enabled ? 'PILOTO ATIVO' : 'ROLLOUT CONTROLADO PELO MASTER'}</div>
      </div>
    </div>

    <div className="flex gap-2 overflow-x-auto">
      {([['campaigns','Campanhas'],['opportunities','Oportunidades'],['channels','Minha Página na Rede']] as const).map(([key,label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab===key?'bg-purple-600 text-white':'bg-slate-900 text-slate-400 hover:text-white'}`}>{label}</button>)}
    </div>

    {message && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">{message}</div>}

    {tab === 'campaigns' && <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
      <form onSubmit={submitCampaign} className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div><h2 className="text-xl font-black text-white">Nova Campanha Multicanal</h2><p className="text-sm text-slate-500">O mesmo campaign_id será usado em todos os destinos.</p></div>
        <select required value={form.companyId} onChange={e=>setForm({...form,companyId:e.target.value})} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white">{initialData.companies.map((c:any)=><option key={c.id} value={c.id}>{c.trade_name}</option>)}</select>
        <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nome da campanha" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
        <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Objetivo e mensagem" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
        <div><p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Onde quero divulgar?</p><div className="grid gap-2 sm:grid-cols-2">{destinationOptions.map(([key,label,Icon])=><label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300"><input type="checkbox" checked={Boolean(form[key])} onChange={e=>setForm({...form,[key]:e.target.checked})} /><Icon className="h-4 w-4 text-purple-400" />{label}</label>)}</div></div>
        <div className="grid gap-3 sm:grid-cols-2"><select value={form.recurrence} onChange={e=>setForm({...form,recurrence:e.target.value})} className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white"><option value="once">Uma vez</option><option value="daily">Todos os dias</option><option value="weekly">Uma vez por semana</option><option value="specific_days">Dias específicos</option><option value="custom_period">Período personalizado</option></select><select value={form.rewardMode} onChange={e=>setForm({...form,rewardMode:e.target.value})} className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white"><option value="mpm_credits">Créditos MPM</option><option value="media_rights">Direito de Mídia</option></select></div>
        <div className="grid gap-3 sm:grid-cols-3"><input type="date" value={form.startsOn} onChange={e=>setForm({...form,startsOn:e.target.value})} className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" /><input type="date" value={form.endsOn} onChange={e=>setForm({...form,endsOn:e.target.value})} className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" /><input type="number" min="0" step="0.01" value={form.budgetTotal} onChange={e=>setForm({...form,budgetTotal:e.target.value})} placeholder="Orçamento" className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" /></div>
        <button disabled={pending || !enabled} className="w-full rounded-xl bg-purple-600 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{pending?'Criando…':enabled?'Criar campanha em rascunho':'Aguardando liberação do Master'}</button>
      </form>
      <div className="space-y-3"><h2 className="text-xl font-black text-white">Campanhas</h2>{initialData.campaigns.length===0?<Empty text="Nenhuma campanha multicanal criada."/>:initialData.campaigns.map((c:any)=>{const b=c.collaborative_campaign_budget_summary?.[0]||{};return <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex justify-between gap-3"><div><h3 className="font-bold text-white">{c.name}</h3><p className="text-xs text-slate-500">{c.status} · {c.reward_mode==='media_rights'?'Direito de Mídia':'Créditos MPM'}</p></div><Megaphone className="h-5 w-5 text-purple-400" /></div><div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs"><Metric label="Total" value={b.total??c.budget_total}/><Metric label="Disponível" value={b.available??c.budget_total}/><Metric label="Reservado" value={b.reserved??0}/><Metric label="Consumido" value={b.consumed??0}/></div></div>})}</div>
    </div>}

    {tab === 'opportunities' && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{initialData.offers.length===0?<Empty text="Nenhuma oportunidade elegível agora."/>:initialData.offers.map((offer:any)=><div key={offer.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-black uppercase text-purple-400">{offer.offer_type==='open'?'Oferta aberta':'Oferta direcionada'}</p><h3 className="mt-1 text-lg font-black text-white">{offer.campaigns?.name}</h3><p className="text-sm text-slate-400">{offer.campaigns?.companies?.trade_name}</p><div className="mt-4 space-y-2 text-sm text-slate-300"><p><BadgeCheck className="mr-2 inline h-4 w-4 text-emerald-400"/>{offer.format}</p><p><CircleDollarSign className="mr-2 inline h-4 w-4 text-amber-400"/>{offer.reward_amount} {offer.reward_mode==='media_rights'?'Direito de Mídia':'Créditos MPM'}</p><p><CalendarClock className="mr-2 inline h-4 w-4 text-sky-400"/>{offer.total_slots-offer.accepted_slots} vagas restantes</p></div><button disabled={pending||!initialData.creator} onClick={()=>startTransition(async()=>{const r=await acceptCollaborativeOfferAction(offer.id,'creator',initialData.creator.id,creatorChannels[0]?.id);setMessage(r.success?'Oferta aceita e orçamento reservado.':r.error||'Falha.');router.refresh();})} className="mt-5 w-full rounded-xl bg-purple-600 py-2.5 text-sm font-black text-white disabled:opacity-40">ACEITAR OFERTA</button></div>)}</div>}

    {tab === 'channels' && <div className="space-y-4"><div><h2 className="text-xl font-black text-white">Participar da Rede Colaborativa</h2><p className="text-sm text-slate-500">Conexão social não ativa participação automaticamente. Faça opt-in por canal, separadamente para Creator e Empresa.</p></div>{participantChannels.length===0?<Empty text="Nenhum canal Creator ou Empresa conectado para configurar."/>:participantChannels.map((channel:any)=><ChannelCard key={channel.id} channel={channel} pending={pending} onSave={(input:any)=>startTransition(async()=>{const r=await setCollaborativeChannelAction(input);setMessage(r.success?'Canal atualizado.':r.error||'Falha.');router.refresh();})}/>)}</div>}
  </div>;
}

function Metric({label,value}:{label:string;value:any}) { return <div className="rounded-lg bg-slate-950 p-2"><p className="text-slate-500">{label}</p><b className="text-white">{Number(value||0).toLocaleString('pt-BR')}</b></div>; }
function Empty({text}:{text:string}) { return <div className="col-span-full rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center text-sm text-slate-500">{text}</div>; }
function ChannelCard({channel,pending,onSave}:{channel:any;pending:boolean;onSave:(input:any)=>void}) { const [enabled,setEnabled]=useState(Boolean(channel.participation_enabled)); const formats=channel.provider==='tiktok'?['tiktok_video']:['story','feed','reel']; return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-black text-white">{channel.display_name}</h3><p className="text-xs uppercase text-slate-500">{channel.owner_type==='creator'?'Creator':'Empresa'} · {channel.provider} · {channel.provider==='tiktok'?'manual enquanto Direct Post estiver pendente':'com aprovação'}</p></div><label className="flex items-center gap-2 text-sm font-bold text-slate-300"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Participar</label></div><div className="mt-4 flex flex-wrap gap-2">{formats.map(f=><span key={f} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{f}</span>)}</div><button disabled={pending} onClick={()=>onSave({channelId:channel.id,ownerType:channel.owner_type,ownerId:channel.owner_id,enabled,formats,monthlyLimit:4,minimumReward:0,approvalMode:'manual'})} className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-xs font-black text-white">Salvar opt-in</button></div>; }
