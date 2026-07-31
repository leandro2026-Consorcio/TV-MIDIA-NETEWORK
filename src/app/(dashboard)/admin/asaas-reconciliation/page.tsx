'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  getAsaasReconciliationSummaryAction, 
  getAsaasPaymentsListAction, 
  getAsaasPaymentEventsAction, 
  getAsaasPaymentAnomaliesAction, 
  syncAsaasPaymentFromAdminAction, 
  reprocessAsaasPaymentEventAction, 
  markAsaasEventReviewedAction 
} from '@/app/actions/asaas-reconciliation';
import { convertAdOfferOrderToCampaignAction } from '@/app/actions/marketplace';
import { 
  ShieldCheck, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  ListFilter, 
  ExternalLink, 
  FileText, 
  Megaphone, 
  Eye, 
  Check, 
  XCircle, 
  Activity, 
  Building2 
} from 'lucide-react';
import Link from 'next/link';

export default function AsaasReconciliationAdminPage() {
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'anomalies' | 'charges' | 'webhooks'>('anomalies');
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [summary, setSummary] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  // Filtros
  const [chargeStatusFilter, setChargeStatusFilter] = useState('all');
  const [webhookStatusFilter, setWebhookStatusFilter] = useState('all');

  // Modal de Parecer
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [reviewStatus, setReviewStatus] = useState<'reviewed' | 'ignored' | 'resolved'>('resolved');
  const [reviewNotes, setReviewNotes] = useState('');

  const supabase = createClient();

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // A. Verificar permissão de Master Admin
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

      // B. Carregar Dados
      const [sumRes, anomRes, ordRes, evRes] = await Promise.all([
        getAsaasReconciliationSummaryAction(),
        getAsaasPaymentAnomaliesAction(),
        getAsaasPaymentsListAction({ status: chargeStatusFilter }),
        getAsaasPaymentEventsAction({ processingStatus: webhookStatusFilter }),
      ]);

      if (sumRes.success) setSummary(sumRes.summary);
      if (anomRes.success) setAnomalies(anomRes.anomalies || []);
      if (ordRes.success) setOrders(ordRes.orders || []);
      if (evRes.success) setEvents(evRes.events || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [chargeStatusFilter, webhookStatusFilter]);

  // Ações de Conciliação
  const handleSyncOrder = async (orderId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await syncAsaasPaymentFromAdminAction(orderId);
    if (!res.success) {
      setError(res.error || 'Erro ao sincronizar cobrança com Asaas.');
    } else {
      setSuccess(`Cobrança sincronizada! Status: ${res.paymentStatus}`);
      await loadAllData();
    }
    setActionLoading(false);
  };

  const handleReprocessEvent = async (eventId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await reprocessAsaasPaymentEventAction(eventId);
    if (!res.success) {
      setError(res.error || 'Erro ao reprocessar evento.');
    } else {
      setSuccess('Evento de webhook reprocessado com sucesso!');
      await loadAllData();
    }
    setActionLoading(false);
  };

  const handleConvertToCampaign = async (orderId: string) => {
    setActionLoading(true);
    setError(null);

    const res = await convertAdOfferOrderToCampaignAction(orderId);
    if (!res.success) {
      setError(res.error || 'Erro ao converter pedido em campanha.');
    } else {
      setSuccess('Pedido convertido em campanha comercial com sucesso!');
      await loadAllData();
    }
    setActionLoading(false);
  };

  const handleSaveReview = async () => {
    if (!selectedAnomaly) return;
    setActionLoading(true);
    setError(null);

    const res = await markAsaasEventReviewedAction({
      eventId: selectedAnomaly.eventId,
      orderId: selectedAnomaly.orderId,
      reviewStatus,
      notes: reviewNotes,
    });

    if (!res.success) {
      setError(res.error || 'Erro ao salvar revisão.');
    } else {
      setSuccess('Parecer contábil salvo com sucesso!');
      setReviewModalOpen(false);
      setSelectedAnomaly(null);
      setReviewNotes('');
      await loadAllData();
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

  // Bloqueio de Acesso para Empresas Comuns
  if (isMaster === false) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Acesso Restrito ao Master Admin</h2>
        <p className="text-xs text-slate-400">
          O Painel de Conciliação Financeira do Asaas é exclusivo para Administradores Globais da Plataforma.
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
            <ShieldCheck className="w-6 h-6 text-purple-400" /> Painel de Conciliação e Auditoria Asaas
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Auditoria financeira global, inspeção de webhooks, detecção de anomalias e conciliação de cobranças.
          </p>
        </div>

        <button
          onClick={loadAllData}
          disabled={actionLoading}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} /> Atualizar Painel
        </button>
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

      {/* Grid de KPIs Financeiros e Volumetria */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Volume Bruto Gerado</span>
          <strong className="text-xl font-bold text-white block">
            R$ {((summary?.totalGrossCents || 0) / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-purple-400 font-mono">{summary?.chargesCount || 0} Cobranças no Total</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Pago Confirmado</span>
          <strong className="text-xl font-bold text-emerald-400 block">
            R$ {((summary?.totalConfirmedCents || 0) / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-emerald-500/80 font-mono">Quitação Confirmada</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Pendente em Aberto</span>
          <strong className="text-xl font-bold text-amber-400 block">
            R$ {((summary?.totalPendingCents || 0) / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-amber-500/80 font-mono">Aguardando Pagamento</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Eventos Webhook Asaas</span>
          <strong className="text-xl font-bold text-sky-400 block font-mono">
            {summary?.totalEventsCount || 0}
          </strong>
          <span className="text-[10px] text-slate-500 font-mono">
            {summary?.processedEventsCount} ok • {summary?.duplicateEventsCount} dup • {summary?.failedEventsCount} erro
          </span>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('anomalies')}
          className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'anomalies'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Alertas & Anomalias ({anomalies.length})
        </button>

        <button
          onClick={() => setActiveTab('charges')}
          className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'charges'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" /> Cobranças Asaas ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('webhooks')}
          className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'webhooks'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" /> Inspetor de Webhooks ({events.length})
        </button>
      </div>

      {/* ABA 1: ALERTAS E ANOMALIAS */}
      {activeTab === 'anomalies' && (
        <div className="space-y-4">
          {anomalies.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">Nenhuma Anomalia Encontrada</h3>
              <p className="text-xs text-slate-400">
                Todas as cobranças, eventos de webhook e pedidos estão perfeitamente conciliados e consistentes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {anomalies.map((anom) => (
                <div
                  key={anom.id}
                  className={`bg-slate-900 border p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl ${
                    anom.severity === 'high' ? 'border-rose-500/30' : 'border-amber-500/30'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          anom.severity === 'high'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {anom.severity}
                      </span>
                      <strong className="text-white text-sm">{anom.title}</strong>
                    </div>
                    <p className="text-xs text-slate-300">{anom.description}</p>
                    {anom.orderId && (
                      <span className="text-[10px] text-purple-400 font-mono block">
                        ID Pedido: {anom.orderId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {anom.orderId && (
                      <button
                        onClick={() => handleSyncOrder(anom.orderId)}
                        disabled={actionLoading}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Sincronizar API
                      </button>
                    )}

                    {anom.eventId && (
                      <button
                        onClick={() => handleReprocessEvent(anom.eventId)}
                        disabled={actionLoading}
                        className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-semibold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1"
                      >
                        <Activity className="w-3.5 h-3.5" /> Reprocessar Evento
                      </button>
                    )}

                    {anom.type === 'paid_no_campaign' && (
                      <button
                        onClick={() => handleConvertToCampaign(anom.orderId)}
                        disabled={actionLoading}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1"
                      >
                        <Megaphone className="w-3.5 h-3.5" /> Converter em Campanha
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSelectedAnomaly(anom);
                        setReviewModalOpen(true);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-xl text-xs transition"
                    >
                      Parecer Contábil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: COBRANÇAS ASAAS */}
      {activeTab === 'charges' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
            <h3 className="font-bold text-white text-base">Relatório de Cobranças por Pedido</h3>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filtrar por Status:</span>
              <select
                value={chargeStatusFilter}
                onChange={(e) => setChargeStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="all">Todos os Status</option>
                <option value="paid_asaas">paid_asaas</option>
                <option value="paid_manual">paid_manual</option>
                <option value="pending_asaas">pending_asaas</option>
                <option value="overdue">overdue</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-sans">Pedido / Oferta</th>
                  <th className="py-3 px-4 font-sans">Comprador</th>
                  <th className="py-3 px-4 font-sans">Vendedor</th>
                  <th className="py-3 px-4">Valor Bruto</th>
                  <th className="py-3 px-4">Asaas ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right font-sans">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 font-sans">
                      <strong className="block text-white">{ord.offer?.title || 'Plano de Mídia'}</strong>
                      <span className="text-[10px] text-slate-500 font-mono">ID: {ord.id}</span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-300">
                      {ord.buyer?.trade_name || ord.buyer_name || 'Anunciante'}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-300">
                      {ord.seller?.trade_name}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">
                      R$ {(ord.gross_amount_cents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-purple-400">
                      {ord.asaas_payment_id || '—'}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ord.payment_status === 'paid_asaas' || ord.payment_status === 'paid_manual'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : ord.payment_status === 'overdue'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {ord.payment_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-sans space-x-2">
                      <Link
                        href={`/ad-offer-orders/${ord.id}/payment`}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-2.5 py-1 rounded-lg text-[11px] transition inline-flex items-center gap-1"
                      >
                        Checkout
                      </Link>

                      {ord.asaas_payment_id && (
                        <button
                          onClick={() => handleSyncOrder(ord.id)}
                          disabled={actionLoading}
                          className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-bold px-2.5 py-1 rounded-lg text-[11px] transition inline-flex items-center gap-1"
                        >
                          Sync
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: INSPETOR DE WEBHOOKS */}
      {activeTab === 'webhooks' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
            <h3 className="font-bold text-white text-base">Inspetor de Eventos Webhook Asaas (`asaas_payment_events`)</h3>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Status Processamento:</span>
              <select
                value={webhookStatusFilter}
                onChange={(e) => setWebhookStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="all">Todos</option>
                <option value="processed">processed</option>
                <option value="duplicate_ignored">duplicate_ignored</option>
                <option value="failed">failed</option>
                <option value="ignored">ignored</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-sans">Evento Asaas</th>
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Pedido ID</th>
                  <th className="py-3 px-4">Status Processamento</th>
                  <th className="py-3 px-4 font-sans">Data Recebimento</th>
                  <th className="py-3 px-4 text-right font-sans">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4">
                      <strong className="block text-white">{ev.event_type}</strong>
                      <span className="text-[10px] text-slate-500">{ev.webhook_idempotency_key}</span>
                    </td>
                    <td className="py-3 px-4 text-purple-400">{ev.asaas_payment_id}</td>
                    <td className="py-3 px-4 text-sky-400">{ev.ad_offer_order_id || '—'}</td>
                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ev.processing_status === 'processed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : ev.processing_status === 'duplicate_ignored'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {ev.processing_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      {new Date(ev.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => handleReprocessEvent(ev.id)}
                        disabled={actionLoading}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-2.5 py-1 rounded-lg text-[11px] transition"
                      >
                        Reprocessar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Parecer Contábil */}
      {reviewModalOpen && selectedAnomaly && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Parecer Contábil de Conciliação</h3>
            <p className="text-xs text-slate-400">
              Registre a resolução ou justificativa para o alerta selecionado.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Status do Parecer</label>
                <select
                  value={reviewStatus}
                  onChange={(e: any) => setReviewStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                >
                  <option value="resolved">Resolvido (resolved)</option>
                  <option value="reviewed">Revisado sem ação (reviewed)</option>
                  <option value="ignored">Ignorar alerta (ignored)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Observações Contábeis / Justificativa</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder="Insira notas explicativas ou detalhes do ajuste..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setReviewModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition"
              >
                Cancelar
              </button>

              <button
                onClick={handleSaveReview}
                disabled={actionLoading}
                className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-5 py-2 rounded-xl text-xs transition shadow-lg shadow-purple-500/20"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Parecer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
