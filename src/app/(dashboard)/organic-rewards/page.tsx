'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Loader2, QrCode } from 'lucide-react';
import { createOrganicRewardAction, getOrganicRewardsManagementAction, validateOrganicRedemptionAction } from '@/app/actions/organic-network';

export default function OrganicRewardsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [form, setForm] = useState({ companyId: '', campaignId: '', title: '', description: '', creditsRequired: 1, creditBudget: 100, quantity: 10, expiresAt: '', city: '', state: 'MT' });
  const load = useCallback(async () => { setLoading(true); const r = await getOrganicRewardsManagementAction(); setData(r); setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (data?.companies?.length && !form.companyId) setForm(f => ({ ...f, companyId: data.companies[0].id })); }, [data, form.companyId]);
  const campaigns = useMemo(() => (data?.campaigns || []).filter((c: any) => c.company_id === form.companyId), [data, form.companyId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMessage('');
    const r = await createOrganicRewardAction(form);
    setMessage(r.success ? 'Benefício publicado e campanha liberada para telas orgânicas.' : r.error || 'Falha ao cadastrar.');
    setBusy(false); if (r.success) await load();
  };
  const validate = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMessage(''); const r = await validateOrganicRedemptionAction(code);
    setMessage(r.success ? `Resgate confirmado: ${r.title}.` : r.error || 'Código inválido.'); setBusy(false); if (r.success) { setCode(''); await load(); }
  };
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-300" /></div>;
  return <div className="space-y-8">
    <div><h1 className="text-3xl font-black text-white">Brindes da Rede Orgânica</h1><p className="mt-2 text-slate-400">Uma campanha só entra em telas residenciais quando possui benefício real, estoque e orçamento promocional.</p></div>
    {message && <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-200">{message}</div>}
    {!data?.companies?.length ? <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-6 text-amber-100">Você precisa ser administrador de uma empresa para cadastrar benefícios.</div> : <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <form onSubmit={create} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="flex items-center gap-2 text-xl font-black"><Gift className="text-amber-300" /> Cadastrar benefício com estoque</h2>
        <div className="grid gap-4 sm:grid-cols-2"><Select label="Empresa" value={form.companyId} onChange={(v: string) => setForm({ ...form, companyId: v, campaignId: '' })} options={data.companies.map((x: any) => [x.id, x.trade_name])} /><Select label="Campanha" value={form.campaignId} onChange={(v: string) => setForm({ ...form, campaignId: v })} options={campaigns.map((x: any) => [x.id, x.name])} /></div>
        <Input label="Nome do benefício" required value={form.title} onChange={(v: string) => setForm({ ...form, title: v })} placeholder="Ex.: Açaí pequeno" />
        <Input label="Descrição e regras" value={form.description} onChange={(v: string) => setForm({ ...form, description: v })} placeholder="Ex.: válido de segunda a sexta" />
        <div className="grid gap-4 sm:grid-cols-3"><NumberField label="Estoque real" value={form.quantity} onChange={(v: number) => setForm({ ...form, quantity: v })} /><NumberField label="Créditos por resgate" step="0.01" value={form.creditsRequired} onChange={(v: number) => setForm({ ...form, creditsRequired: v })} /><NumberField label="Orçamento de créditos" step="0.01" value={form.creditBudget} onChange={(v: number) => setForm({ ...form, creditBudget: v })} /></div>
        <div className="grid gap-4 sm:grid-cols-3"><Input label="Cidade (opcional)" value={form.city} onChange={(v: string) => setForm({ ...form, city: v })} /><Input label="UF" value={form.state} onChange={(v: string) => setForm({ ...form, state: v.toUpperCase() })} /><Input label="Validade" type="datetime-local" required value={form.expiresAt} onChange={(v: string) => setForm({ ...form, expiresAt: v })} /></div>
        <button disabled={busy || !form.campaignId} className="w-full rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40">Publicar benefício e liberar campanha</button>
      </form>
      <form onSubmit={validate} className="h-fit space-y-4 rounded-3xl border border-violet-400/20 bg-slate-900 p-6"><h2 className="flex items-center gap-2 text-xl font-black"><QrCode className="text-violet-300" /> Validar resgate</h2><p className="text-sm text-slate-400">Digite o código apresentado pelo participante. A validação consome uma unidade reservada.</p><input required value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CÓDIGO DO CLIENTE" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono tracking-widest" /><button disabled={busy} className="w-full rounded-xl bg-violet-500 px-5 py-3 font-black">Confirmar entrega</button></form>
    </div>}
    <section><h2 className="text-xl font-black">Estoque e distribuição</h2><div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800"><table className="w-full text-left text-sm"><thead className="bg-slate-900 text-slate-400"><tr><th className="p-4">Benefício</th><th className="p-4">Empresa</th><th className="p-4">Disponível</th><th className="p-4">Reservado</th><th className="p-4">Resgatado</th><th className="p-4">Créditos distribuídos</th><th className="p-4">Status</th></tr></thead><tbody>{(data?.rewards || []).map((r: any) => <tr key={r.id} className="border-t border-slate-800"><td className="p-4 font-bold">{r.title}</td><td className="p-4">{r.companies?.trade_name}</td><td className="p-4">{r.quantity_available}</td><td className="p-4">{r.quantity_reserved}</td><td className="p-4">{r.quantity_redeemed}</td><td className="p-4">{Number(r.credits_distributed).toFixed(4)} / {Number(r.credit_budget).toFixed(2)}</td><td className="p-4">{r.status}</td></tr>)}</tbody></table></div></section>
  </div>;
}

function Input({ label, onChange, ...props }: any) { return <label className="block text-xs font-bold text-slate-400">{label}<input {...props} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white" /></label>; }
function NumberField({ label, onChange, ...props }: any) { return <Input {...props} type="number" min="0.01" required label={label} onChange={(v: string) => onChange(Number(v))} />; }
function Select({ label, options, onChange, ...props }: any) { return <label className="block text-xs font-bold text-slate-400">{label}<select {...props} required onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"><option value="">Selecione</option>{options.map(([v,l]: string[]) => <option key={v} value={v}>{l}</option>)}</select></label>; }
