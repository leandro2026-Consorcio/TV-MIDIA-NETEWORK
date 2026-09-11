import { redirect } from 'next/navigation';
import { Clock3, GitBranch, Network, RadioTower, ShieldCheck } from 'lucide-react';
import { createMultichannelRuleFormAction, decideMultichannelApprovalFormAction, getMultichannelDashboardAction } from '@/app/actions/multichannel-automations';

const pill = (on: boolean) => `rounded-full px-2.5 py-1 text-xs font-black ${on ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}`;
const card = 'rounded-2xl border border-slate-800 bg-slate-950/70 p-5';

export default async function MultichannelAutomationsPage() {
  const data = await getMultichannelDashboardAction();
  if (!data.success) redirect('/login');
  const owners = [...data.companies.map((c: any) => ({ value: `company:${c.id}`, label: `Empresa · ${c.trade_name}` })), ...(data.creator ? [{ value: `creator:${data.creator.id}`, label: `Creator · ${data.creator.display_name}` }] : [])];
  return <div className="mx-auto max-w-7xl space-y-7">
    <section className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/30 p-7">
      <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-400">MPM Fase 3</p>
      <h1 className="mt-2 text-3xl font-black text-white">Automações Multicanal</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-400">TV ↔ MPM ↔ Instagram ↔ Facebook ↔ TikTok, com aprovação, rastreabilidade, anti-loop e mídia canônica. Nenhuma publicação comercial é feita enquanto os flags estiverem desligados.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {Object.entries(data.flags).map(([key, on]) => <span key={key} className={pill(Boolean(on))}>{key.replaceAll('_', ' ')}: {on ? 'ON' : 'OFF'}</span>)}
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-4">
      <Metric icon={<GitBranch/>} label="Regras" value={data.rules.length}/><Metric icon={<Clock3/>} label="Aprovações" value={data.approvals.length}/>
      <Metric icon={<RadioTower/>} label="Eventos recentes" value={data.events.length}/><Metric icon={<ShieldCheck/>} label="Profundidade padrão" value="3"/>
    </section>

    <section className={card}>
      <h2 className="text-xl font-black text-white">Nova regra</h2>
      <p className="mt-1 text-sm text-slate-500">O padrão seguro é aprovação. “Todos elegíveis” exige confirmação avançada explícita.</p>
      <form action={createMultichannelRuleFormAction} className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Nome"><input name="name" required minLength={3} className="input" placeholder="Ex.: Campanha institucional → canais próprios"/></Field>
        <Field label="Owner"><select name="owner" required className="input"><option value="">Selecione</option>{owners.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
        <Field label="Origem"><select name="source" required className="input"><option value="mpm">MPM / campanha</option>{data.channels.map((c:any)=><option key={c.id} value={`social:${c.id}`}>{c.provider} · {c.display_name}</option>)}{data.screens.map((s:any)=><option key={s.id} value={`tv:${s.id}`}>TV · {s.name}</option>)}</select></Field>
        <Field label="Campanha (opcional)"><select name="campaign_id" className="input"><option value="">Qualquer campanha elegível</option>{data.campaigns.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Elegibilidade"><select name="eligibility_mode" className="input"><option value="campaigns_mpm">Campanhas MPM</option><option value="mpm_created">Criado no MPM</option><option value="hashtag">Hashtag</option><option value="all_eligible">Todos elegíveis (avançado)</option></select></Field>
        <Field label="Hashtag (se aplicável)"><input name="required_hashtag" className="input" placeholder="#midiapormidia"/></Field>
        <Field label="Modo"><select name="mode" className="input"><option value="approval">Aprovação</option><option value="off">Desligado</option><option value="automatic">Automático</option><option value="automatic_temporary">Automático temporário</option></select></Field>
        <Field label="Fallback"><select name="fallback_mode" className="input"><option value="approval">Aprovação</option><option value="off">Desligado</option></select></Field>
        <Field label="Início temporário"><input name="starts_at" type="datetime-local" className="input"/></Field>
        <Field label="Fim temporário"><input name="ends_at" type="datetime-local" className="input"/></Field>
        <div className="md:col-span-2">
          <p className="mb-2 text-sm font-bold text-slate-300">Destinos</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.channels.map((c:any)=><Check key={c.id} value={`social:${c.id}:${c.provider}`} label={`${c.provider} · ${c.display_name}${c.direct_post_capable?'':' · manual'}`}/>) }
          {data.screens.map((s:any)=><Check key={s.id} value={`tv:${s.id}`} label={`TV · ${s.name}`}/>) }
          {data.playlists.map((p:any)=><Check key={p.id} value={`playlist:${p.id}`} label={`Playlist · ${p.name}`}/>) }
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-amber-300"><input type="checkbox" name="advanced_confirmed"/> Confirmo o filtro avançado “todos elegíveis”</label>
        <div className="md:text-right"><button className="rounded-xl bg-cyan-500 px-5 py-2.5 font-black text-slate-950 hover:bg-cyan-400">Criar regra segura</button></div>
      </form>
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <div className={card}><h2 className="text-xl font-black text-white">Fila de aprovação</h2><div className="mt-4 space-y-3">
        {data.approvals.map((a:any)=><div key={a.id} className="rounded-xl border border-slate-800 p-4"><p className="font-bold text-white">{a.propagation_targets?.target_key}</p><p className="text-xs text-slate-500">Expira em {new Date(a.expires_at).toLocaleString('pt-BR')}</p><form action={decideMultichannelApprovalFormAction} className="mt-3 flex gap-2"><input type="hidden" name="task_id" value={a.id}/><button name="decision" value="approve" className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-bold text-emerald-300">Aprovar</button><button name="decision" value="reject" className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-sm font-bold text-rose-300">Rejeitar</button></form></div>)}
        {!data.approvals.length&&<Empty text="Nenhuma aprovação pendente."/>}
      </div></div>
      <div className={card}><h2 className="text-xl font-black text-white">Capabilities observadas</h2><div className="mt-4 space-y-3">{data.capabilities.map((c:any)=><div key={c.provider} className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 p-4"><div><p className="font-black capitalize text-white">{c.provider}</p><p className="text-xs text-slate-500">{c.evidence}</p></div><span className={pill(c.automatic_publish_capable)}>{String(c.detection_mode).toUpperCase()}</span></div>)}</div></div>
    </section>

    <section className={card}><h2 className="text-xl font-black text-white">Regras configuradas</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr><th className="pb-3">Regra</th><th>Origem</th><th>Modo</th><th>Destinos</th><th>Status</th></tr></thead><tbody>{data.rules.map((r:any)=><tr key={r.id} className="border-t border-slate-800 text-slate-300"><td className="py-3 font-bold text-white">{r.name}</td><td>{r.source_kind}</td><td>{r.mode}</td><td>{r.multichannel_rule_targets?.length||0}</td><td>{r.status}</td></tr>)}</tbody></table>{!data.rules.length&&<Empty text="Nenhuma regra criada."/>}</div></section>
  </div>;
}

function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string|number}) { return <div className={card}><div className="h-5 w-5 text-cyan-400">{icon}</div><p className="mt-3 text-3xl font-black text-white">{value}</p><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p></div>; }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="space-y-1.5 text-sm font-bold text-slate-300"><span>{label}</span>{children}</label>; }
function Check({value,label}:{value:string;label:string}) { return <label className="flex items-center gap-2 rounded-xl border border-slate-800 p-3 text-sm text-slate-300"><input type="checkbox" name="destinations" value={value}/>{label}</label>; }
function Empty({text}:{text:string}) { return <p className="py-7 text-center text-sm text-slate-500">{text}</p>; }
