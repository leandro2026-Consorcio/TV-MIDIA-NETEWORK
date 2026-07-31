'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  getMasterFinancialSummaryAction, 
  applySellerMonthlyDiscountAction 
} from '@/app/actions/financial-reports';
import { DollarSign, ShieldAlert, TrendingUp, Percent, Clock, CheckCircle2, AlertCircle, Loader2, Filter, Receipt, MinusCircle, Building2, Calendar, FileText } from 'lucide-react';

export default function MasterFinancialReportsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtros
  const [statusFilter, setStatusFilter] = useState('');

  // Modal de Abatimento
  const [selectedLedger, setSelectedLedger] = useState<any | null>(null);
  const [discountAmountCents, setDiscountAmountCents] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');

  const loadFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMasterFinancialSummaryAction({
        financialStatus: statusFilter || undefined,
      });

      if (!res.success) {
        setError(res.error || 'Erro ao carregar relatórios financeiros.');
        return;
      }

      setSummary(res.summary);
      setLedgers(res.ledgers || []);
      setDiscounts(res.discounts || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [statusFilter]);

  const handleOpenDiscountModal = (ledger: any) => {
    setSelectedLedger(ledger);
    setDiscountAmountCents(ledger.amount_available_cents || 0);
    setDiscountReason(`Abatimento na mensalidade referente às exibições do pedido ${ledger.ad_offer_order_id.substring(0, 8)}`);
  };

  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLedger) return;

    if (discountAmountCents <= 0) {
      setError('O valor do abatimento deve ser maior que zero.');
      return;
    }

    if (discountAmountCents > selectedLedger.amount_available_cents) {
      setError('O valor do abatimento excede o saldo disponível.');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await applySellerMonthlyDiscountAction(
      selectedLedger.id,
      discountAmountCents,
      discountReason
    );

    if (!res.success) {
      setError(res.error || 'Erro ao aplicar abatimento.');
    } else {
      setSuccess(`Abatimento de R$ ${(discountAmountCents / 100).toFixed(2)} aplicado com sucesso na mensalidade!`);
      setSelectedLedger(null);
      await loadFinancialData();
    }
    setActionLoading(false);
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Módulo Gerencial Master
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" /> Relatórios Financeiros da Plataforma
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Consolidado de receita bruta, taxa da plataforma, saldos do exibidor e concessão de abatimento de mensalidades.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Cards de Métricas Financeiras */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              RECEITA BRUTA TOTAL VENDIDA
            </span>
            <div className="text-3xl font-extrabold text-white mt-1 font-mono">
              R$ {(summary.totalGrossCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">{summary.totalOrdersCount} pedido(s) comercializado(s)</p>
          </div>

          <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block font-mono">
              COMISSÃO DA PLATAFORMA (TAKE RATE)
            </span>
            <div className="text-3xl font-extrabold text-emerald-400 mt-1 font-mono">
              R$ {(summary.totalPlatformFeeCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Retenção de serviços da plataforma</p>
          </div>

          <div className="bg-slate-900 border border-purple-500/30 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider block font-mono">
              LÍQUIDO TOTAL DOS EXIBIDORES
            </span>
            <div className="text-3xl font-extrabold text-purple-400 mt-1 font-mono">
              R$ {(summary.totalSellerNetCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Valor gerado para as empresas exibidoras</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              SALDO PENDENTE (EM VEICULAÇÃO)
            </span>
            <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">
              R$ {(summary.totalPendingCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Aguardando 100% da entrega de inserções</p>
          </div>

          <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block font-mono">
              SALDO DISPONÍVEL P/ ABATIMENTO
            </span>
            <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
              R$ {(summary.totalAvailableCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Entregas concluídas liberadas para mensalidade</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              VALOR JÁ ABATIDO DE MENSALIDADES
            </span>
            <div className="text-2xl font-bold text-slate-300 mt-1 font-mono">
              R$ {(summary.totalUsedDiscountCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Abatimentos manuais concedidos pelo Master</p>
          </div>
        </div>
      )}

      {/* Filtros e Tabela de Livro Financeiro */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Receipt className="w-5 h-5 text-purple-400" /> Entradas Financeiras por Exibidor
          </h3>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
            >
              <option value="">Todos os Status Financeiros</option>
              <option value="pending_delivery">Pendente de Entrega (pending_delivery)</option>
              <option value="available">Disponível (available)</option>
              <option value="partially_used">Parcialmente Utilizado (partially_used)</option>
              <option value="used_for_discount">Totalmente Abatido (used_for_discount)</option>
            </select>
          </div>
        </div>

        {ledgers.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">Nenhum registro financeiro encontrado com os filtros selecionados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Empresa Exibidora</th>
                  <th className="py-3 px-4">Compradora</th>
                  <th className="py-3 px-4 font-mono">Bruto</th>
                  <th className="py-3 px-4 font-mono">Comissão</th>
                  <th className="py-3 px-4 font-mono">Líquido</th>
                  <th className="py-3 px-4 font-mono">Disponível</th>
                  <th className="py-3 px-4 font-mono">Status Financ.</th>
                  <th className="py-3 px-4 text-right">Ação Master</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {ledgers.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 text-white font-sans font-bold">
                      {l.seller?.trade_name || 'Exibidora'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      {l.buyer?.trade_name || 'Compradora'}
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      R$ {(l.gross_amount_cents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-emerald-400">
                      R$ {(l.platform_fee_cents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-purple-300 font-bold">
                      R$ {(l.seller_net_cents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">
                      R$ {(l.amount_available_cents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          l.financial_status === 'available'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : l.financial_status === 'pending_delivery'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}
                      >
                        {l.financial_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      {l.amount_available_cents > 0 ? (
                        <button
                          onClick={() => handleOpenDiscountModal(l)}
                          className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-3 py-1.5 rounded-lg transition text-[11px] flex items-center gap-1 ml-auto"
                        >
                          <MinusCircle className="w-3.5 h-3.5" /> Abater Mensalidade
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Sem saldo disponível</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Histórico de Abatimentos Concedidos */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" /> Histórico de Abatimentos Concedidos em Mensalidades
        </h3>

        {discounts.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">Nenhum abatimento manual aplicado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Empresa Beneficiada</th>
                  <th className="py-3 px-4 font-mono">Valor Abatido</th>
                  <th className="py-3 px-4">Motivo / Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {discounts.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      {new Date(d.applied_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-purple-300 font-sans font-bold">
                      {d.seller?.trade_name || 'Exibidora'}
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">
                      R$ {(d.amount_cents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans">
                      {d.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Concessão de Abatimento Manual */}
      {selectedLedger && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MinusCircle className="w-5 h-5 text-purple-400" /> Abater Mensalidade da Plataforma
            </h3>
            <p className="text-xs text-slate-400">
              Conceder abatimento no valor da mensalidade para <strong className="text-white">{selectedLedger.seller?.trade_name}</strong> utilizando o saldo disponível de entregas concluídas.
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Saldo Disponível Atual:</span>
                <strong className="text-emerald-400 font-mono">R$ {(selectedLedger.amount_available_cents / 100).toFixed(2)}</strong>
              </div>
            </div>

            <form onSubmit={handleApplyDiscount} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Valor a Abater (R$ em Centavos)</label>
                <input
                  type="number"
                  value={discountAmountCents}
                  onChange={(e) => setDiscountAmountCents(Number(e.target.value))}
                  max={selectedLedger.amount_available_cents}
                  min={1}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Valor formatado: R$ {(discountAmountCents / 100).toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Motivo / Justificativa</label>
                <textarea
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  rows={3}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLedger(null)}
                  disabled={actionLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Abatimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
