'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { 
  getReceivedMediaRequestsAction, 
  getSentMediaRequestsAction, 
  approveMediaRequestAction, 
  rejectMediaRequestAction, 
  cancelMediaRequestAction 
} from '@/app/actions/marketplace';
import { convertAdOfferOrderToCampaignAction } from '@/app/actions/commercial-campaigns';
import { Inbox, Send, CheckCircle2, XCircle, AlertCircle, Loader2, Calendar, MessageSquare, Image as ImageIcon, ShieldCheck, Megaphone } from 'lucide-react';

export default function MediaRequestsPage() {
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');

  const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);

  // Rejection State
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  const loadRequests = async (companyId: string) => {
    try {
      setLoading(true);
      const [recRes, sentRes] = await Promise.all([
        getReceivedMediaRequestsAction(companyId),
        getSentMediaRequestsAction(companyId),
      ]);

      if (recRes.success) setReceivedRequests(recRes.requests || []);
      if (sentRes.success) setSentRequests(sentRes.requests || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: userComps } = await (supabase.from('companies') as any)
          .select('*, company_users!inner(user_id)')
          .eq('company_users.user_id', user.id)
          .eq('company_users.is_active', true);

        if (userComps && userComps.length > 0) {
          setUserCompanies(userComps as Company[]);
          const initialId = userComps[0].id;
          setSelectedCompanyId(initialId);
          await loadRequests(initialId);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [supabase]);

  const handleCompanyChange = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    await loadRequests(companyId);
  };

  const handleApprove = async (orderId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await approveMediaRequestAction(orderId);
    if (!res.success) {
      setError(res.error || 'Erro ao aprovar solicitação.');
    } else {
      setSuccess('Solicitação de mídia APROVADA com sucesso!');
      await loadRequests(selectedCompanyId);
    }
    setActionLoading(false);
  };

  const handleConfirmReject = async () => {
    if (!rejectingOrderId || !rejectionReason.trim()) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await rejectMediaRequestAction(rejectingOrderId, rejectionReason);
    if (!res.success) {
      setError(res.error || 'Erro ao rejeitar solicitação.');
    } else {
      setSuccess('Solicitação rejeitada com motivo registrado.');
      setRejectingOrderId(null);
      setRejectionReason('');
      await loadRequests(selectedCompanyId);
    }
    setActionLoading(false);
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm('Deseja cancelar esta solicitação de veiculação?')) return;
    setActionLoading(true);
    setError(null);

    const res = await cancelMediaRequestAction(orderId);
    if (!res.success) {
      setError(res.error || 'Erro ao cancelar solicitação.');
    } else {
      setSuccess('Solicitação cancelada.');
      await loadRequests(selectedCompanyId);
    }
    setActionLoading(false);
  };

  const handleConvertToCampaign = async (orderId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await convertAdOfferOrderToCampaignAction(orderId);
    if (!res.success) {
      setError(res.error || 'Erro ao converter pedido em campanha.');
    } else {
      setSuccess('Pedido convertido com sucesso em Campanha Comercial Marketplace!');
      await loadRequests(selectedCompanyId);
    }
    setActionLoading(false);
  };

  if (loading && receivedRequests.length === 0 && sentRequests.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const currentRequests = activeTab === 'received' ? receivedRequests : sentRequests;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Central de Solicitações de Mídia</h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerencie o aceite comercial das solicitações de veiculação entre empresas parceiras da rede.
          </p>
        </div>

        {userCompanies.length > 1 && (
          <select
            value={selectedCompanyId}
            onChange={(e) => handleCompanyChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs font-medium focus:outline-none focus:border-purple-500"
          >
            {userCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.trade_name}
              </option>
            ))}
          </select>
        )}
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

      {/* Abas de Navegação */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-xs transition ${
            activeTab === 'received'
              ? 'border-purple-500 text-purple-400 bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Inbox className="w-4 h-4" /> Solicitações Recebidas ({receivedRequests.length})
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-xs transition ${
            activeTab === 'sent'
              ? 'border-purple-500 text-purple-400 bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Send className="w-4 h-4" /> Solicitações Enviadas ({sentRequests.length})
        </button>
      </div>

      {/* Lista de Solicitações */}
      <div className="space-y-4">
        {currentRequests.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">Nenhuma solicitação encontrada</h3>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              {activeTab === 'received'
                ? 'Sua empresa ainda não recebeu solicitações de veiculação para seus planos de mídia.'
                : 'Sua empresa ainda não enviou solicitações de veiculação no marketplace.'}
            </p>
          </div>
        ) : (
          currentRequests.map((req) => (
            <div
              key={req.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl hover:border-slate-700 transition"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <span className="text-xs text-purple-400 font-bold block">
                    {activeTab === 'received'
                      ? `Comprador: ${req.buyer?.trade_name || req.buyer_name || 'Empresa Parceira'}`
                      : `Exibidora: ${req.seller?.trade_name || 'Empresa Exibidora'}`}
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5">{req.offer?.title || 'Plano de Mídia'}</h3>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                    req.approval_status === 'approved'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : req.approval_status === 'rejected'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : req.approval_status === 'cancelled'
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {(req.approval_status || 'pending').replace('_', ' ')}
                </span>
              </div>

              {/* Mensagem e Detalhes */}
              {req.request_message && (
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block">MENSAGEM DA SOLICITAÇÃO:</span>
                  <p className="italic">"{req.request_message}"</p>
                </div>
              )}

              {req.approval_status === 'rejected' && req.rejection_reason && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
                  <strong>Motivo da Rejeição:</strong> {req.rejection_reason}
                </div>
              )}

              {/* Grid Transacional de Valores Congelados */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block font-sans">Valor Congelado</span>
                  <strong className="text-white">R$ {(req.gross_amount_cents / 100).toFixed(2)}</strong>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block font-sans">Créditos Comprados</span>
                  <strong className="text-amber-400">{req.credits_amount} CR</strong>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block font-sans">Mídia Anexada</span>
                  <strong className="text-slate-300 font-sans truncate block">
                    {req.media?.title || 'Não anexada'}
                  </strong>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block font-sans">Período Solicitado</span>
                  <span className="text-slate-300 text-[11px] block">
                    {req.requested_start_date ? `${req.requested_start_date} a ${req.requested_end_date || 'A combinar'}` : 'A combinar'}
                  </span>
                </div>
              </div>

              {/* Ações */}
              <div className="flex justify-end gap-2 text-xs pt-2 border-t border-slate-800">
                {/* Botão de Conversão em Campanha Comercial */}
                {req.approval_status === 'approved' && req.payment_status === 'paid_manual' && !req.campaign_id && (
                  <button
                    onClick={() => handleConvertToCampaign(req.id)}
                    disabled={actionLoading}
                    className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
                  >
                    <Megaphone className="w-4 h-4" /> Converter em Campanha
                  </button>
                )}

                {req.campaign_id && (
                  <Link
                    href={`/campaigns/${req.campaign_id}`}
                    className="bg-slate-800 hover:bg-slate-700 font-bold text-purple-400 border border-purple-500/30 px-4 py-2 rounded-xl transition flex items-center gap-1.5"
                  >
                    <Megaphone className="w-4 h-4 text-purple-400" /> Ver Campanha
                  </Link>
                )}

                {activeTab === 'received' && req.approval_status === 'pending_approval' && (
                  <>
                    <button
                      onClick={() => setRejectingOrderId(req.id)}
                      disabled={actionLoading}
                      className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> Rejeitar
                    </button>
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={actionLoading}
                      className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4 fill-slate-950" /> Aprovar Solicitação
                    </button>
                  </>
                )}

                {activeTab === 'sent' && req.approval_status === 'pending_approval' && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    disabled={actionLoading}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl transition"
                  >
                    Cancelar Solicitação
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DE REJEIÇÃO COM MOTIVO */}
      {rejectingOrderId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Rejeitar Solicitação de Mídia</h3>
            <p className="text-xs text-slate-400">Informe o motivo da rejeição para notificar a empresa anunciante.</p>
            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Não temos grade disponível para este segmento no período solicitado..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingOrderId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs"
              >
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
