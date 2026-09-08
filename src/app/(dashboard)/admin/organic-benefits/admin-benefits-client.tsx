'use client';

import { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  Sliders,
  DollarSign,
  Gift,
  Building2,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { masterReviewBenefitAction } from '@/app/actions/organic-benefits';

const money = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

interface AdminBenefitsClientProps {
  benefits: any[];
  config: any;
}

export function AdminBenefitsClient({ benefits: initialBenefits, config }: AdminBenefitsClientProps) {
  const [benefits, setBenefits] = useState<any[]>(initialBenefits);
  const [filter, setFilter] = useState('all');
  const [selectedBenefit, setSelectedBenefit] = useState<any | null>(null);
  const [approvedPrice, setApprovedPrice] = useState<number>(0);
  const [reviewNotes, setReviewNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const openReview = (b: any) => {
    setSelectedBenefit(b);
    setApprovedPrice(Number(b.approved_unit_value || b.announced_unit_value || 0));
    setReviewNotes(b.review_notes || '');
    setMsg(null);
  };

  const handleReview = async (status: 'active' | 'rejected' | 'paused') => {
    if (!selectedBenefit) return;
    setBusy(true);
    setMsg(null);

    const res = await masterReviewBenefitAction(
      selectedBenefit.id,
      Number(approvedPrice),
      status,
      reviewNotes.trim() || undefined
    );

    setBusy(false);
    if (res.success) {
      setMsg({ type: 'ok', text: `Benefício atualizado com sucesso para: ${status}.` });
      setBenefits((prev) =>
        prev.map((b) =>
          b.id === selectedBenefit.id
            ? {
                ...b,
                status,
                approved_unit_value: Number(approvedPrice),
                approved_promotional_value: Number(res.data.approved_promotional_value),
                credits_required: res.data.credits_required,
                review_notes: reviewNotes,
              }
            : b
        )
      );
      setSelectedBenefit(null);
    } else {
      setMsg({ type: 'err', text: res.error || 'Falha ao processar revisão.' });
    }
  };

  const filtered = benefits.filter((b) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return b.status === 'pending_review';
    if (filter === 'suspicious') return b.is_suspicious_price;
    if (filter === 'active') return b.status === 'active';
    if (filter === 'rejected') return b.status === 'rejected';
    if (filter === 'exhausted') return b.status === 'exhausted' || b.quantity_available === 0;
    if (filter === 'expired') return b.status === 'expired';
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-400">Administração Master</p>
          <h1 className="mt-1 text-3xl font-black text-white">Gestão de Benefícios & Prêmios</h1>
          <p className="mt-1 text-sm text-slate-400">
            Aprovação, ajuste de valor anunciado e auditoria de direitos de divulgação da Rede Orgânica.
          </p>
        </div>
      </header>

      {/* Regras Ativas do Master */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-cyan-400" />
          <h2 className="font-black text-white">Parâmetros Ativos de Conversão</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-slate-500 font-bold uppercase">Fator Pontos × R$</span>
            <p className="mt-1 text-lg font-black text-white">{config?.points_per_brl || '1.0'} pt / R$ 1</p>
            <p className="text-[10px] text-slate-400">Arredondamento: {config?.rounding_mode || 'round'}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-slate-500 font-bold uppercase">Conversão em Inserções</span>
            <p className="mt-1 text-lg font-black text-white">{config?.media_insertions_per_brl || '0.5'} ins / R$ 1</p>
            <p className="text-[10px] text-slate-400">Teto: {config?.max_granted_insertions || 5000} inserções</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-slate-500 font-bold uppercase">Alerta de Preço Suspeito</span>
            <p className="mt-1 text-lg font-black text-amber-400">{money(Number(config?.suspicious_price_threshold || 500))}</p>
            <p className="text-[10px] text-slate-400">Exige análise manual</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-slate-500 font-bold uppercase">Validade Padrão do Cupom</span>
            <p className="mt-1 text-lg font-black text-white">{config?.default_coupon_validity_days || 7} dias</p>
            <p className="text-[10px] text-slate-400">Devolução de pontos ao expirar</p>
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'all', label: `Todos (${benefits.length})` },
          { id: 'pending', label: `Pendentes de Análise (${benefits.filter((b) => b.status === 'pending_review').length})` },
          { id: 'suspicious', label: `Preço Suspeito (${benefits.filter((b) => b.is_suspicious_price).length})` },
          { id: 'active', label: `Ativos (${benefits.filter((b) => b.status === 'active').length})` },
          { id: 'exhausted', label: `Esgotados (${benefits.filter((b) => b.quantity_available === 0).length})` },
          { id: 'rejected', label: `Rejeitados (${benefits.filter((b) => b.status === 'rejected').length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              filter === t.id
                ? 'bg-cyan-400 text-slate-950'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            msg.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Review Modal / Drawer */}
      {selectedBenefit && (
        <div className="rounded-3xl border border-cyan-500/30 bg-slate-900 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-white">Revisão de Benefício #{selectedBenefit.id.slice(0, 8)}</h3>
            <button onClick={() => setSelectedBenefit(null)} className="text-xs text-slate-400 hover:text-white">
              Fechar
            </button>
          </div>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div className="space-y-2 text-xs text-slate-300">
              <p>
                <strong>Empresa:</strong> {selectedBenefit.companies?.trade_name}
              </p>
              <p>
                <strong>Título:</strong> {selectedBenefit.title}
              </p>
              <p>
                <strong>Descrição:</strong> {selectedBenefit.description || '—'}
              </p>
              <p>
                <strong>Valor Anunciado Informado:</strong>{' '}
                <span className="font-mono font-bold text-white">{money(Number(selectedBenefit.announced_unit_value))}</span>
              </p>
              <p>
                <strong>Estoque Ofertado:</strong> {selectedBenefit.quantity_total} unidades
              </p>
              <p>
                <strong>Validade:</strong> {new Date(selectedBenefit.expires_at).toLocaleDateString('pt-BR')}
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <label className="block text-xs font-bold text-slate-300">
                Valor Unitário Aprovado (R$)
                <input
                  type="number"
                  step="0.01"
                  min="0.10"
                  required
                  value={approvedPrice}
                  onChange={(e) => setApprovedPrice(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-mono text-white"
                />
                <span className="mt-1 block text-[10px] text-slate-500">
                  O valor aprovado serve de base para o cálculo econômico de pontuação e de direitos de divulgação.
                </span>
              </label>

              <label className="block text-xs font-bold text-slate-300">
                Observações / Motivo do Ajuste
                <input
                  placeholder="Ex.: Valor ajustado para a média praticada na região."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-white"
                />
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleReview('active')}
                  className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400"
                >
                  Aprovar Benefício
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleReview('paused')}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Pausar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleReview('rejected')}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
                >
                  Rejeitar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Benefits Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
            <tr>
              <th className="p-3.5">Benefício</th>
              <th className="p-3.5">Empresa</th>
              <th className="p-3.5">Valor Informado</th>
              <th className="p-3.5">Valor Aprovado</th>
              <th className="p-3.5">Pontos</th>
              <th className="p-3.5">Estoque</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Nenhum benefício encontrado com este filtro.
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr key={b.id} className="hover:bg-slate-950/40">
                  <td className="p-3.5 font-bold text-white">
                    {b.title}
                    {b.is_suspicious_price && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                        Preço alto
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-300">{b.companies?.trade_name || '—'}</td>
                  <td className="p-3.5 font-mono text-slate-400">{money(Number(b.announced_unit_value || 0))}</td>
                  <td className="p-3.5 font-mono font-bold text-white">
                    {b.approved_unit_value ? money(Number(b.approved_unit_value)) : 'Pendente'}
                  </td>
                  <td className="p-3.5 text-cyan-300 font-bold">{Number(b.credits_required || 0).toFixed(0)} pts</td>
                  <td className="p-3.5 text-slate-300">
                    {b.quantity_available} / {b.quantity_total}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                        b.status === 'active'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : b.status === 'pending_review'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                          : b.status === 'rejected'
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                          : 'border-slate-700 bg-slate-800 text-slate-400'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => openReview(b)}
                      className="rounded-lg bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20"
                    >
                      Revisar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
