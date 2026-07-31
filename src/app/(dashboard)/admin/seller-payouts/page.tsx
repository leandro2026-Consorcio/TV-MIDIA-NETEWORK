'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  getSellerPayoutEligibilityForAdminAction, 
  getSellerPayoutSummaryAction, 
  recalculateSellerPayoutEligibilityAction, 
  createSellerPayoutSimulationAction 
} from '@/app/actions/seller-payouts';
import { 
  ShieldCheck, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  Building2, 
  Calendar, 
  Layers, 
  Play 
} from 'lucide-react';
import Link from 'next/link';

export default function AdminSellerPayoutsPage() {
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [eligibilities, setEligibilities] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal de Simulação de Lote
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().split('T')[0]);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
  const [sellersList, setSellersList] = useState<any[]>([]);

  const supabase = createClient();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsMaster(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await (supabase.from('profiles') as any)
        .select('is_master_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_master_admin) {
        setIsMaster(false);
        setLoading(false);
        return;
      }

      setIsMaster(true);

      const [sumRes, eligRes, sellersRes] = await Promise.all([
        getSellerPayoutSummaryAction(),
        getSellerPayoutEligibilityForAdminAction({ status: statusFilter }),
        (supabase.from('companies') as any).select('id, trade_name').order('trade_name'),
      ]);

      if (sumRes.success) setSummary(sumRes.summary);
      if (eligRes.success) setEligibilities(eligRes.eligibilities || []);
      if (sellersRes.data) setSellersList(sellersRes.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleRecalculateGlobal = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await recalculateSellerPayoutEligibilityAction();
    if (!res.success) {
      setError(res.error || 'Erro ao recalcular elegibilidade.');
    } else {
      setSuccess(`Elegibilidade recalculada para ${res.recalculatedCount} pedidos com sucesso!`);
      await loadData();
    }
    setActionLoading(false);
  };

  const handleCreateSimulation = async () => {
    if (!selectedSellerId) {
      setError('Selecione uma empresa exibidora para simulação.');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await createSellerPayoutSimulationAction(selectedSellerId, periodStart, periodEnd);
    if (!res.success) {
      setError(res.error || 'Erro ao criar simulação.');
    } else {
      setSuccess(`Simulação de repasse criada! Total Elegível: R$ ${((res.simulation?.total_eligible_cents || 0) / 100).toFixed(2)}`);
      setModalOpen(false);
      await loadData();
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (isMaster === false) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Acesso Restrito ao Master Admin</h2>
        <p className="text-xs text-slate-400">
          Apenas Administradores Globais possuem acesso à simulação e elegibilidade de repasses.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-400" /> Elegibilidade & Simulação de Payout (Master)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Motor de cálculo passivo de repasses futuros, verificação de proof of play e simulações por lote.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            disabled={actionLoading}
            className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
          >
            <Calendar className="w-4 h-4" /> Simular Lote
          </button>

          <button
            onClick={handleRecalculateGlobal}
            disabled={actionLoading}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} /> Recalcular Tudo
          </button>
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

      {/* Grid de KPIs Financeiros */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Volume Bruto Total</span>
          <strong className="text-xl font-bold text-white block">
            R$ {((summary?.totalGrossCents || 0) / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-purple-400 font-mono">{summary?.totalCount || 0} Registros</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Comissão da Plataforma</span>
          <strong className="text-xl font-bold text-rose-400 block font-mono">
            R$ {((summary?.totalPlatformFeeCents || 0) / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-slate-500 font-mono">Retenção de Taxa</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Líquido dos Exibidores</span>
          <strong className="text-xl font-bold text-purple-300 block font-mono">
            R$ {((summary?.totalSellerNetCents || 0) / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-slate-500 font-mono">Líquido de Ofertas</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Elegível para Repasse Futuro</span>
          <strong className="text-xl font-bold text-emerald-400 block font-mono">
            R$ {((summary?.totalEligibleCents || 0) / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-emerald-500/80 font-mono">
            {summary?.eligibleCount || 0} Aprovados • {summary?.pendingCount || 0} Bloqueados
          </span>
        </div>
      </div>

      {/* Tabela de Elegibilidades */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <h3 className="font-bold text-white text-base">Relatório Global de Elegibilidade por Pedido</h3>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Status Elegibilidade:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs rounded-xl px-3 py-1.5 focus:outline-none"
            >
              <option value="all">Todos</option>
              <option value="eligible">eligible (Apto)</option>
              <option value="pending_delivery">pending_delivery (Entrega Pendente)</option>
              <option value="pending_financial_profile">pending_financial_profile (Perfil Pendente)</option>
              <option value="pending_asaas_wallet">pending_asaas_wallet (Sem Wallet)</option>
              <option value="blocked">blocked (Bloqueado)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-sans">Vendedor / Comprador</th>
                <th className="py-3 px-4">Bruto / Comissão</th>
                <th className="py-3 px-4">Líquido Vendedor</th>
                <th className="py-3 px-4 text-emerald-400">Elegível</th>
                <th className="py-3 px-4 font-sans">Status Elegibilidade</th>
                <th className="py-3 px-4 font-sans">Motivo / Trava</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {eligibilities.map((elig) => (
                <tr key={elig.id} className="hover:bg-slate-950/50 transition">
                  <td className="py-3 px-4 font-sans">
                    <strong className="block text-white">{elig.seller?.trade_name || 'Exibidora'}</strong>
                    <span className="text-[10px] text-slate-400 block">Comprador: {elig.buyer?.trade_name || 'Anunciante'}</span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="block text-white">R$ {(elig.gross_amount_cents / 100).toFixed(2)}</span>
                    <span className="text-[10px] text-rose-400">Tx: R$ {(elig.platform_fee_cents / 100).toFixed(2)}</span>
                  </td>

                  <td className="py-3 px-4 font-bold text-slate-200">
                    R$ {(elig.seller_net_cents / 100).toFixed(2)}
                  </td>

                  <td className="py-3 px-4 font-bold text-emerald-400">
                    R$ {(elig.eligible_amount_cents / 100).toFixed(2)}
                  </td>

                  <td className="py-3 px-4 font-sans">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        elig.eligibility_status === 'eligible'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : elig.eligibility_status === 'pending_delivery'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {elig.eligibility_status.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-sans text-slate-400 text-[11px]">
                    {elig.eligibility_reason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Simulação de Lote */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Simulação de Lote de Repasse (Passivo)</h3>
            <p className="text-xs text-slate-400">
              Selecione a empresa exibidora e o período para simular o montante elegível acumulado.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Empresa Exibidora</label>
                <select
                  value={selectedSellerId}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                >
                  <option value="">Selecione uma Empresa</option>
                  {sellersList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.trade_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Data Início</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Data Fim</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition"
              >
                Cancelar
              </button>

              <button
                onClick={handleCreateSimulation}
                disabled={actionLoading}
                className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-5 py-2 rounded-xl text-xs transition shadow-lg shadow-purple-500/20"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gerar Simulação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
