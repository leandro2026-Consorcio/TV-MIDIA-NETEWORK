'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, Loader2, Save, ShieldCheck } from 'lucide-react';
import {
  addInventoryPreferredParticipantAction,
  configureInventoryPeriodAction,
  getScreenInventoryAction,
  setScreenInventoryParticipationAction,
  updateInventoryFeatureFlagsAction,
} from '@/app/actions/media-inventory';

const bucketLabels: Record<string, string> = {
  own_use: 'Uso próprio',
  preferred: 'Preferenciais',
  partnership: 'Parcerias',
  mpm_growth: 'MPM Growth',
  automatic_pool: 'Pool automático',
};

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ScreenInventoryPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);
  const [form, setForm] = useState({
    periodStart: dateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    periodEnd: dateValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    manualCapacity: 0,
    ownUse: 0,
    preferred: 0,
    partnership: 0,
    mpmGrowth: 0,
    automaticPool: 0,
    releaseUnused: false,
    releaseAfterDay: 15,
    releaseLeadDays: 7,
    growthReason: '',
  });
  const [preferredCompanyId, setPreferredCompanyId] = useState('');
  const [preferredMax, setPreferredMax] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getScreenInventoryAction(id);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setData(result);
    if (result.period) {
      const byType = Object.fromEntries(result.buckets.map((bucket: any) => [bucket.bucket_type, bucket]));
      setForm((current) => ({
        ...current,
        periodStart: result.period.period_start,
        periodEnd: result.period.period_end,
        manualCapacity: Number(result.period.theoretical_capacity),
        ownUse: Number(byType.own_use?.capacity_quantity || 0),
        preferred: Number(byType.preferred?.capacity_quantity || 0),
        partnership: Number(byType.partnership?.capacity_quantity || 0),
        mpmGrowth: Number(byType.mpm_growth?.capacity_quantity || 0),
        automaticPool: Number(byType.automatic_pool?.capacity_quantity || 0),
        releaseUnused: Boolean(byType.own_use?.release_unused_owner_capacity),
        releaseAfterDay: Number(byType.own_use?.release_after_day || 15),
        releaseLeadDays: Number(byType.own_use?.release_lead_days || 7),
        growthReason: byType.mpm_growth?.reason || '',
      }));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const setNumber = (field: string, value: string) => setForm((current) => ({ ...current, [field]: Math.max(0, Number(value) || 0) }));
  const featureEnabled = Boolean(data?.flags?.media_inventory_v2 && data?.flags?.inventory_capacity_v2 && data?.flags?.inventory_allocations_v2);
  const bucketTotal = form.ownUse + form.preferred + form.partnership + form.mpmGrowth + form.automaticPool;

  async function saveConfiguration(event: React.FormEvent) {
    event.preventDefault();
    if (!data?.inventory) return;
    setSaving(true); setError(null); setSuccess(null);
    const result = await configureInventoryPeriodAction({
      inventoryId: data.inventory.id,
      ...form,
    });
    if (!result.success) setError(result.error);
    else { setSuccess('Capacidade e bolsões salvos com auditoria.'); await load(); }
    setSaving(false);
  }

  async function toggleParticipation() {
    if (!data?.inventory) return;
    setSaving(true); setError(null);
    const result = await setScreenInventoryParticipationAction(data.inventory.id, !data.inventory.commercial_enabled);
    if (!result.success) setError(result.error); else await load();
    setSaving(false);
  }

  async function enableFeatures() {
    setSaving(true); setError(null);
    const result = await updateInventoryFeatureFlagsAction({
      media_inventory_v2: true,
      inventory_capacity_v2: true,
      inventory_allocations_v2: true,
    });
    if (!result.success) setError(result.error); else await load();
    setSaving(false);
  }

  async function addPreferred() {
    if (!data?.inventory || !preferredCompanyId || preferredMax <= 0) return;
    setSaving(true); setError(null);
    const result = await addInventoryPreferredParticipantAction({
      inventoryId: data.inventory.id,
      preferredCompanyId,
      priority: data.preferred.length + 1,
      maxInsertions: preferredMax,
      startsAt: `${form.periodStart}T00:00:00-04:00`,
      endsAt: `${form.periodEnd}T23:59:59-04:00`,
    });
    if (!result.success) setError(result.error);
    else { setPreferredCompanyId(''); setPreferredMax(0); await load(); }
    setSaving(false);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/screens/${id}`} className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <div><h1 className="text-2xl font-bold text-white">Inventário — {data?.screen?.name}</h1><p className="text-sm text-slate-400">Capacidade e reservas; nenhum Crédito MPM é criado aqui.</p></div>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}

      {!featureEnabled && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-200">
          <div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5" /> Fundação de inventário desabilitada por feature flag.</div>
          <p className="mt-2 text-amber-100/80">O player e a operação atual continuam funcionando normalmente.</p>
          {data?.isMaster && <button onClick={enableFeatures} disabled={saving} className="mt-4 rounded-lg bg-amber-500 px-4 py-2 font-bold text-slate-950">Habilitar flags do Pacote 1</button>}
        </div>
      )}

      {data?.inventory && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Capacidade', data.period?.theoretical_capacity || 0],
            ['Reservado', data.period?.reserved_capacity || 0],
            ['Entregue', data.period?.delivered_capacity || 0],
            ['Disponível', data.period?.available_capacity || 0],
            ['Origem', data.period?.calculation_source || 'não configurada'],
            ['Versão', data.period?.calculation_version || 0],
          ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-white">{String(value)}</p></div>)}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center justify-between"><div><h2 className="font-bold text-white">Participação comercial</h2><p className="text-xs text-slate-400">Disponibilizar inventário não gera crédito.</p></div><button onClick={toggleParticipation} disabled={!featureEnabled || saving || !data?.inventory} className={`rounded-lg px-4 py-2 text-sm font-bold ${data?.inventory?.commercial_enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{data?.inventory?.commercial_enabled ? 'Ativa' : 'Inativa'}</button></div>
      </div>

      <form onSubmit={saveConfiguration} className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-sky-400" /><div><h2 className="font-bold text-white">Capacidade mensal manual</h2><p className="text-xs text-slate-400">Use um valor verificável. A referência de 30.000 não é preenchida automaticamente.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Início" type="date" value={form.periodStart} onChange={(value) => setForm((current) => ({ ...current, periodStart: value }))} />
          <Field label="Fim" type="date" value={form.periodEnd} onChange={(value) => setForm((current) => ({ ...current, periodEnd: value }))} />
          <Field label="Capacidade teórica" value={form.manualCapacity} onChange={(value) => setNumber('manualCapacity', value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-5">
          {(['ownUse', 'preferred', 'partnership', 'mpmGrowth', 'automaticPool'] as const).map((field) => (
            <Field key={field} label={bucketLabels[field === 'ownUse' ? 'own_use' : field === 'mpmGrowth' ? 'mpm_growth' : field === 'automaticPool' ? 'automatic_pool' : field]} value={form[field]} disabled={!data?.isMaster && (field === 'partnership' || field === 'mpmGrowth')} onChange={(value) => setNumber(field, value)} />
          ))}
        </div>
        <p className={`text-sm ${bucketTotal > form.manualCapacity ? 'text-rose-400' : 'text-slate-400'}`}>Soma dos bolsões: {bucketTotal} / {form.manualCapacity}</p>
        <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={form.releaseUnused} onChange={(event) => setForm((current) => ({ ...current, releaseUnused: event.target.checked }))} />Liberar capacidade own_use não utilizada</label>
        {form.releaseUnused && <div className="grid gap-4 sm:grid-cols-2"><Field label="Liberar após dia" value={form.releaseAfterDay} onChange={(value) => setNumber('releaseAfterDay', value)} /><Field label="Ou dias antes do fim" value={form.releaseLeadDays} onChange={(value) => setNumber('releaseLeadDays', value)} /></div>}
        {data?.isMaster && <Field label="Motivo MPM Growth" type="text" value={form.growthReason} onChange={(value) => setForm((current) => ({ ...current, growthReason: value }))} />}
        <button type="submit" disabled={!featureEnabled || saving || bucketTotal > form.manualCapacity} className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 font-bold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar capacidade</button>
      </form>

      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div><h2 className="font-bold text-white">Empresas preferenciais</h2><p className="text-xs text-slate-400">Limite atual: {String(data?.flags?.inventory_preferred_limit ?? 3)}. Não executa matching automático.</p></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"><select value={preferredCompanyId} onChange={(event) => setPreferredCompanyId(event.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Selecione uma empresa</option>{(data?.companies || []).filter((company: any) => company.companyId !== data?.screen?.company_id).map((company: any) => <option key={company.companyId} value={company.companyId}>{company.tradeName}{company.city ? ` — ${company.city}` : ''}</option>)}</select><Field label="Máx. inserções" value={preferredMax} onChange={(value) => setPreferredMax(Math.max(0, Number(value) || 0))} /><button type="button" onClick={addPreferred} disabled={!featureEnabled || saving || !preferredCompanyId || preferredMax <= 0} className="self-end rounded-xl bg-purple-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Adicionar</button></div>
        <div className="space-y-2">{(data?.preferred || []).map((item: any) => <div key={item.id} className="flex justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm"><span className="text-slate-300">{item.preferred_company_id}</span><span className="text-slate-500">Prioridade {item.priority} · {item.max_insertions} inserções · {item.status}</span></div>)}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'number', disabled = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return <label className="block text-xs font-medium text-slate-400"><span className="mb-1 block">{label}</span><input type={type} min={type === 'number' ? 0 : undefined} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white disabled:opacity-50" /></label>;
}
