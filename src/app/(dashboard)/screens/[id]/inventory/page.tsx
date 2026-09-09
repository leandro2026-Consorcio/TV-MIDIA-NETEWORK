"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Info,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  addInventoryPreferredParticipantAction,
  configureInventoryPeriodAction,
  getScreenInventoryAction,
  setScreenInventoryParticipationAction,
  updateInventoryFeatureFlagsAction,
} from "@/app/actions/media-inventory";

const bucketInfo: Record<string, { label: string; desc: string }> = {
  own_use: {
    label: "Minha empresa",
    desc: "Espaço reservado para as mídias e anúncios da sua própria empresa.",
  },
  preferred: {
    label: "Empresas escolhidas",
    desc: "Espaço reservado para empresas parceiras que você escolher diretamente.",
  },
  partnership: {
    label: "Parcerias da Rede",
    desc: "Espaço destinado a campanhas de parceiros estratégicos da Rede MPM.",
  },
  mpm_growth: {
    label: "Crescimento da Rede",
    desc: "Espaço que pode ser usado pelo MPM para campanhas de expansão, quando previsto no seu plano.",
  },
  automatic_pool: {
    label: "Rede automática",
    desc: "Espaço disponibilizado automaticamente para anúncios compatíveis da Rede MPM.",
  },
};

function dateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ScreenInventoryPage() {
  const params = useParams();
  const rawId = params?.id;
  const screenId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [simpleOwnPercent, setSimpleOwnPercent] = useState(70);

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
    releaseUnused: true,
    releaseAfterDay: 15,
    releaseLeadDays: 7,
    growthReason: "",
  });

  const [preferredCompanyId, setPreferredCompanyId] = useState("");
  const [preferredMax, setPreferredMax] = useState(0);

  const load = useCallback(async () => {
    if (!screenId) return;
    setLoading(true);
    const result = await getScreenInventoryAction(screenId);
    if (!result.success) {
      setError(result.error || "Não foi possível carregar o inventário.");
      setLoading(false);
      return;
    }
    setData(result);
    if (result.period) {
      const byType = Object.fromEntries(result.buckets.map((b: any) => [b.bucket_type, b]));
      const cap = Number(result.period.theoretical_capacity || 0);
      const own = Number(byType.own_use?.capacity_quantity || 0);
      setForm((current) => ({
        ...current,
        periodStart: result.period.period_start,
        periodEnd: result.period.period_end,
        manualCapacity: cap,
        ownUse: own,
        preferred: Number(byType.preferred?.capacity_quantity || 0),
        partnership: Number(byType.partnership?.capacity_quantity || 0),
        mpmGrowth: Number(byType.mpm_growth?.capacity_quantity || 0),
        automaticPool: Number(byType.automatic_pool?.capacity_quantity || 0),
        releaseUnused: byType.own_use?.release_unused_owner_capacity !== false,
        releaseAfterDay: Number(byType.own_use?.release_after_day || 15),
        releaseLeadDays: Number(byType.own_use?.release_lead_days || 7),
        growthReason: byType.mpm_growth?.reason || "",
      }));
      if (cap > 0) {
        setSimpleOwnPercent(Math.round((own / cap) * 100));
      }
    }
    setLoading(false);
  }, [screenId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setNumber = (field: string, value: any) =>
    setForm((current) => ({ ...current, [field]: Math.max(0, Number(value) || 0) }));

  const featureEnabled = Boolean(
    data?.flags?.media_inventory_v2 &&
    data?.flags?.inventory_capacity_v2 &&
    data?.flags?.inventory_allocations_v2
  );

  const bucketTotal =
    form.ownUse + form.preferred + form.partnership + form.mpmGrowth + form.automaticPool;

  const handleSimplePercentChange = (pct: number) => {
    setSimpleOwnPercent(pct);
    const total = form.manualCapacity > 0 ? form.manualCapacity : 100;
    const own = Math.round((total * pct) / 100);
    const remaining = total - own;
    const pool = Math.round(remaining * 0.7);
    const pref = remaining - pool;
    setForm((prev) => ({
      ...prev,
      ownUse: own,
      preferred: pref,
      automaticPool: pool,
    }));
  };

  async function saveConfiguration(event: React.FormEvent) {
    event.preventDefault();
    if (!data?.inventory) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const result = await configureInventoryPeriodAction({
      inventoryId: data.inventory.id,
      ...form,
    });

    if (!result.success) {
      setError(result.error || "Não foi possível salvar a configuração.");
    } else {
      setSuccess("Configuração de participação e capacidade salva com sucesso.");
      await load();
    }
    setSaving(false);
  }

  async function toggleParticipation() {
    if (!data?.inventory) return;
    setSaving(true);
    setError(null);
    const result = await setScreenInventoryParticipationAction(
      data.inventory.id,
      !data.inventory.commercial_enabled
    );
    if (!result.success) setError(result.error || "Falha ao alterar participação.");
    else await load();
    setSaving(false);
  }

  async function enableFeatures() {
    setSaving(true);
    setError(null);
    const result = await updateInventoryFeatureFlagsAction({
      media_inventory_v2: true,
      inventory_capacity_v2: true,
      inventory_allocations_v2: true,
    });
    if (!result.success) setError(result.error || "Falha ao atualizar recursos.");
    else await load();
    setSaving(false);
  }

  async function addPreferred() {
    if (!data?.inventory || !preferredCompanyId || preferredMax <= 0) return;
    setSaving(true);
    setError(null);
    const result = await addInventoryPreferredParticipantAction({
      inventoryId: data.inventory.id,
      preferredCompanyId,
      priority: (data.preferred?.length || 0) + 1,
      maxInsertions: preferredMax,
      startsAt: `${form.periodStart}T00:00:00-04:00`,
      endsAt: `${form.periodEnd}T23:59:59-04:00`,
    });
    if (!result.success) setError(result.error || "Falha ao adicionar participante preferencial.");
    else {
      setPreferredCompanyId("");
      setPreferredMax(0);
      await load();
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const hasCapacity = form.manualCapacity > 0 || (data?.period?.theoretical_capacity && data.period.theoretical_capacity > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link
          href={`/screens/${screenId}`}
          className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block">Passo 2 de 4</span>
          <h1 className="text-2xl font-extrabold text-white">Como esta TV participa da Rede MPM</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Você escolhe quanto da programação quer reservar para sua própria empresa e quanto deseja compartilhar com parceiros e com a Rede MPM.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-300 space-y-3">
          <div className="flex items-center gap-2 font-bold text-emerald-200">
            <CheckCircle2 className="h-5 w-5" /> {success}
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              href={`/screens/${screenId}/content-settings`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400 transition"
            >
              CONTINUAR PARA CONTEÚDO ENTRE PROPAGANDAS <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/screens/${screenId}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-700 transition"
            >
              Voltar para a TV
            </Link>
          </div>
        </div>
      )}

      {!featureEnabled && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-200">
          <div className="flex items-center gap-2 font-bold">
            <ShieldCheck className="h-5 w-5" /> Fundação de inventário em modo de transição.
          </div>
          <p className="mt-2 text-amber-100/80">
            O player e a programação local continuam funcionando normalmente.
          </p>
          {data?.isMaster && (
            <button
              onClick={enableFeatures}
              disabled={saving}
              className="mt-4 rounded-lg bg-amber-500 px-4 py-2 font-bold text-slate-950"
            >
              Habilitar flags no Master
            </button>
          )}
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 space-y-3 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-400 border border-sky-500/20 shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">O que é capacidade da TV?</h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Capacidade é a quantidade máxima de exibições que esta TV consegue realizar durante o período. Ela é calculada considerando as horas de funcionamento do seu estabelecimento, os dias ativos, a duração das mídias e a frequência dos conteúdos informativos.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400">Status atual:</span>
              <strong className={hasCapacity ? "text-emerald-400" : "text-amber-400"}>
                {hasCapacity ? `${form.manualCapacity.toLocaleString("pt-BR")} exibições estimadas` : "Capacidade ainda não calculada"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-bold text-white text-base">Participação na Rede MPM</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {data?.inventory?.commercial_enabled
                ? "Sua TV pode receber campanhas compatíveis da Rede MPM dentro dos limites definidos."
                : "Sua TV exibe apenas sua programação própria e conteúdos permitidos."}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleParticipation}
            disabled={saving || !data?.inventory}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              data?.inventory?.commercial_enabled
                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {data?.inventory?.commercial_enabled ? "✓ Participação Ativa" : "Participação Desativada"}
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 shrink-0 text-purple-400" />
          <span>
            <strong>Importante:</strong> Disponibilizar espaço na TV não gera Crédito MPM automaticamente. O crédito é liberado conforme eventos econômicos elegíveis de campanhas reais.
          </span>
        </div>
      </section>

      <form onSubmit={saveConfiguration} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-6">
        <div>
          <h2 className="font-bold text-white text-base">Divisão da Programação</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Defina quanto espaço quer manter para suas próprias mídias e quanto liberar para parceiros da cidade.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-300">
            Quanto da TV você deseja reservar para a sua empresa?
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { pct: 50, label: "50% Minha Empresa", sub: "50% Parceiros da Rede" },
              { pct: 70, label: "70% Minha Empresa", sub: "30% Parceiros da Rede" },
              { pct: 100, label: "100% Exclusiva", sub: "Apenas mídias próprias" },
            ].map((option) => (
              <button
                type="button"
                key={option.pct}
                onClick={() => handleSimplePercentChange(option.pct)}
                className={`p-4 rounded-xl border text-left transition ${
                  simpleOwnPercent === option.pct
                    ? "border-purple-500 bg-purple-500/10 text-white shadow-md"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                }`}
              >
                <strong className="block text-xs font-bold text-slate-200">{option.label}</strong>
                <span className="block text-[10px] text-slate-400 mt-1">{option.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.releaseUnused}
              onChange={(e) => setForm((prev) => ({ ...prev, releaseUnused: e.target.checked }))}
              className="mt-0.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 h-4 w-4"
            />
            <div>
              <strong className="text-xs text-white block">Compartilhar espaço não utilizado</strong>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                Se eu não utilizar todo o espaço reservado para minha empresa, permitir que a Rede MPM utilize o restante para exibir anúncios da cidade.
              </p>
            </div>
          </label>
          <p className="text-[10px] text-slate-500 pl-7">
            Isso aumenta o aproveitamento da sua TV. O espaço só é cedido quando estiver ocioso e respeita sempre a sua grade de horários.
          </p>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1.5 transition"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAdvanced ? "Ocultar configurações avançadas" : "Configurações avançadas (ajuste numérico detalhado)"}
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-5 rounded-xl border border-slate-800/80 bg-slate-950/60 p-5 text-xs">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Início do período" type="date" value={form.periodStart} onChange={(v: string) => setForm((prev) => ({ ...prev, periodStart: v }))} />
              <Field label="Término do período" type="date" value={form.periodEnd} onChange={(v: string) => setForm((prev) => ({ ...prev, periodEnd: v }))} />
              <Field label="Capacidade máxima" value={form.manualCapacity} onChange={(v: string) => setNumber("manualCapacity", v)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-5">
              {(["ownUse", "preferred", "partnership", "mpmGrowth", "automaticPool"]).map((field) => {
                const key = field === "ownUse" ? "own_use" : field === "mpmGrowth" ? "mpm_growth" : field === "automaticPool" ? "automatic_pool" : field;
                const info = bucketInfo[key] || { label: field, desc: "" };
                return (
                  <div key={field} className="space-y-1">
                    <Field
                      label={info.label}
                      value={(form as any)[field]}
                      disabled={!data?.isMaster && (field === "partnership" || field === "mpmGrowth")}
                      onChange={(v: string) => setNumber(field, v)}
                    />
                    <p className="text-[10px] text-slate-500">{info.desc}</p>
                  </div>
                );
              })}
            </div>

            <p className={`text-xs font-mono ${bucketTotal > form.manualCapacity && form.manualCapacity > 0 ? "text-rose-400" : "text-slate-400"}`}>
              Soma das reservas: {bucketTotal} / {form.manualCapacity || "Sem limite fixado"}
            </p>

            {form.releaseUnused && (
              <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-800/50">
                <Field label="Liberar ociosidade a partir do dia do mês" value={form.releaseAfterDay} onChange={(v: string) => setNumber("releaseAfterDay", v)} />
                <Field label="Ou dias de antecedência do fim do mês" value={form.releaseLeadDays} onChange={(v: string) => setNumber("releaseLeadDays", v)} />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-purple-500 hover:bg-purple-600 px-6 py-3 font-bold text-white text-xs disabled:opacity-50 transition shadow-lg shadow-purple-500/20"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar configuração da TV
          </button>
        </div>
      </form>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-white text-base">Empresas que você gostaria de divulgar nesta TV</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Você pode escolher até 3 empresas parceiras. Quando houver campanhas elegíveis dessas empresas, elas terão prioridade dentro do espaço reservado para preferenciais. Prioridade não significa exibição ilimitada.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <select
            value={preferredCompanyId}
            onChange={(e) => setPreferredCompanyId(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white"
          >
            <option value="">Selecione uma empresa parceira...</option>
            {(data?.companies || [])
              .filter((c: any) => c.companyId !== data?.screen?.company_id)
              .map((c: any) => (
                <option key={c.companyId} value={c.companyId}>
                  {c.tradeName} {c.city ? `— ${c.city}` : ""}
                </option>
              ))}
          </select>
          <Field
            label="Máximo de exibições"
            value={preferredMax}
            onChange={(v: string) => setPreferredMax(Math.max(0, Number(v) || 0))}
          />
          <button
            type="button"
            onClick={addPreferred}
            disabled={saving || !preferredCompanyId || preferredMax <= 0}
            className="self-end rounded-xl bg-purple-500 hover:bg-purple-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40 transition"
          >
            Adicionar Parceira
          </button>
        </div>

        <div className="space-y-2 pt-2">
          {(!data?.preferred || data.preferred.length === 0) ? (
            <p className="text-xs text-slate-500 italic">Nenhuma empresa parceira prioritária definida para esta tela.</p>
          ) : (
            data.preferred.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs"
              >
                <span className="text-slate-200 font-medium">{item.preferred_company_id}</span>
                <span className="text-slate-400 font-mono">
                  Prioridade {item.priority} · Limite: {item.max_insertions} inserções
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "number",
  disabled = false,
}: {
  label: string;
  value: any;
  onChange: (val: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-slate-300">
      <span className="mb-1 block text-slate-400">{label}</span>
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-40 focus:outline-none focus:border-purple-500"
      />
    </label>
  );
}
