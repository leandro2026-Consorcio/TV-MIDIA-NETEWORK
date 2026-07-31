'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  createSellerPayoutBatchAction, 
  getSellerPayoutBatchesAction, 
  getSellerPayoutBatchDetailsAction, 
  addEligibleItemsToBatchAction, 
  approveSellerPayoutBatchAction, 
  cancelSellerPayoutBatchAction, 
  executeSellerPayoutBatchAction 
} from '@/app/actions/seller-payout-transfers';
import { getSellerPayoutEligibilityForAdminAction } from '@/app/actions/seller-payouts';
import { 
  ShieldCheck, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  PlusCircle, 
  Play, 
  XCircle, 
  Layers, 
  Eye, 
  FileText 
} from 'lucide-react';

export default function AdminSellerPayoutTransfersPage() {
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [batchItems, setBatchItems] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal de Adicionar Itens Elegíveis
  const [addItemsModalOpen, setAddItemsModalOpen] = useState(false);
  const [eligibleItems, setEligibleItems] = useState<any[]>([]);
  const [selectedEligibilityIds, setSelectedEligibilityIds] = useState<string[]>([]);

  // Modal de Cancelamento com Motivo
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelBatchId, setCancelBatchId] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const supabase = createClient();

  const loadBatches = async () => {
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

      const res = await getSellerPayoutBatchesAction();
      if (res.success) {
        setBatches(res.batches || []);
      } else {
        setError(res.error || 'Erro ao carregar lotes de repasse.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleCreateBatch = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await createSellerPayoutBatchAction();
    if (!res.success) {
      setError(res.error || 'Erro ao criar lote.');
    } else {
      setSuccess(`Lote ${res.batch?.batch_number} criado com sucesso!`);
      await loadBatches();
    }
    setActionLoading(false);
  };

  const handleSelectBatch = async (batch: any) => {
    setSelectedBatch(batch);
    const res = await getSellerPayoutBatchDetailsAction(batch.id);
    if (res.success) {
      setBatchItems(res.items || []);
    }
  };

  const handleOpenAddItemsModal = async (batch: any) => {
    setSelectedBatch(batch);
    setActionLoading(true);

    const res = await getSellerPayoutEligibilityForAdminAction({ status: 'eligible' });
    if (res.success) {
      setEligibleItems(res.eligibilities || []);
      setSelectedEligibilityIds([]);
      setAddItemsModalOpen(true);
    } else {
      setError(res.error || 'Erro ao buscar itens elegíveis.');
    }
    setActionLoading(false);
  };

  const handleConfirmAddItems = async () => {
    if (selectedEligibilityIds.length === 0) {
      setError('Selecione pelo menos um item para adicionar ao lote.');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await addEligibleItemsToBatchAction(selectedBatch.id, selectedEligibilityIds);
    if (!res.success) {
      setError(res.error || 'Erro ao adicionar itens ao lote.');
    } else {
      setSuccess(`${res.addedCount} itens adicionados ao lote com sucesso! Total: R$ ${((res.addedAmountCents || 0) / 100).toFixed(2)}`);
      setAddItemsModalOpen(false);
      await loadBatches();
      if (selectedBatch) handleSelectBatch(selectedBatch);
    }
    setActionLoading(false);
  };

  const handleApproveBatch = async (batchId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await approveSellerPayoutBatchAction(batchId);
    if (!res.success) {
      setError(res.error || 'Erro ao aprovar lote.');
    } else {
      setSuccess('Lote de repasse APROVADO pelo Master Admin!');
      await loadBatches();
    }
    setActionLoading(false);
  };

  const handleExecuteBatch = async (batchId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await executeSellerPayoutBatchAction(batchId);
    if (!res.success) {
      setError(res.error || 'Erro ao executar lote.');
    } else {
      setSuccess(`Lote executado com sucesso! Sucesso: ${res.successCount} | Falhas: ${res.failureCount}`);
      await loadBatches();
      if (selectedBatch) handleSelectBatch(selectedBatch);
    }
    setActionLoading(false);
  };

  const handleOpenCancelModal = (batchId: string) => {
    setCancelBatchId(batchId);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handleConfirmCancelModal = async () => {
    if (!cancelReason.trim()) {
      setError('É obrigatório informar o motivo do cancelamento.');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await cancelSellerPayoutBatchAction(cancelBatchId, cancelReason);
    if (!res.success) {
      setError(res.error || 'Erro ao cancelar lote.');
    } else {
      setSuccess('Lote de repasse cancelado com sucesso.');
      setCancelModalOpen(false);
      await loadBatches();
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
          Apenas Administradores Globais possuem acesso à gestão de lotes de transferência pós-entrega.
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
            <ShieldCheck className="w-6 h-6 text-purple-400" /> Gestão de Lotes de Transferência (Master)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Montagem, aprovação e execução de lotes pós-entrega com liquidação server-side e baixa contábil idempotente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateBatch}
            disabled={actionLoading}
            className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
          >
            <PlusCircle className="w-4 h-4" /> Criar Lote de Repasse
          </button>

          <button
            onClick={loadBatches}
            disabled={actionLoading}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} /> Atualizar
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

      {/* Tabela de Lotes de Repasse */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3">Lotes Registrados ({batches.length})</h3>

        {batches.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">
            Nenhum lote de repasse criado até o momento. Clique em "Criar Lote de Repasse" para começar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-sans">Número do Lote</th>
                  <th className="py-3 px-4">Qtd. Itens</th>
                  <th className="py-3 px-4 text-emerald-400">Total Lote (R$)</th>
                  <th className="py-3 px-4 font-sans">Status</th>
                  <th className="py-3 px-4 font-sans">Data de Criação</th>
                  <th className="py-3 px-4 text-right font-sans">Ações Master</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 font-sans">
                      <strong className="block text-white font-mono">{b.batch_number}</strong>
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-300">
                      {b.total_items} itens
                    </td>

                    <td className="py-3 px-4 font-bold text-emerald-400">
                      R$ {((b.total_amount_cents || 0) / 100).toFixed(2)}
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          b.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : b.status === 'approved'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : b.status === 'draft' || b.status === 'pending_approval'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(b.created_at).toLocaleDateString('pt-BR')}
                    </td>

                    <td className="py-3 px-4 text-right font-sans space-x-1.5">
                      <button
                        onClick={() => handleSelectBatch(b)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-2 py-1 rounded text-[11px] transition"
                      >
                        Detalhes
                      </button>

                      {(b.status === 'draft' || b.status === 'pending_approval') && (
                        <>
                          <button
                            onClick={() => handleOpenAddItemsModal(b)}
                            disabled={actionLoading}
                            className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold px-2 py-1 rounded text-[11px] border border-purple-500/30 transition"
                          >
                            + Add Itens
                          </button>

                          <button
                            onClick={() => handleApproveBatch(b.id)}
                            disabled={actionLoading}
                            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold px-2 py-1 rounded text-[11px] border border-emerald-500/30 transition"
                          >
                            Aprovar
                          </button>
                        </>
                      )}

                      {b.status === 'approved' && (
                        <button
                          onClick={() => handleExecuteBatch(b.id)}
                          disabled={actionLoading}
                          className="bg-emerald-500 hover:bg-emerald-600 font-bold text-slate-950 px-3 py-1 rounded text-[11px] transition flex items-center gap-1 shadow-md shadow-emerald-500/20"
                        >
                          <Play className="w-3 h-3 fill-current" /> Executar Lote
                        </button>
                      )}

                      {b.status !== 'completed' && b.status !== 'cancelled' && (
                        <button
                          onClick={() => handleOpenCancelModal(b.id)}
                          disabled={actionLoading}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold px-2 py-1 rounded text-[11px] border border-rose-500/30 transition"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detalhes do Lote Selecionado */}
      {selectedBatch && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
          <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center justify-between">
            <span>Itens do Lote {selectedBatch.batch_number} ({batchItems.length})</span>
            <span className="text-xs text-purple-400 font-mono">
              Total: R$ {((selectedBatch.total_amount_cents || 0) / 100).toFixed(2)}
            </span>
          </h3>

          {batchItems.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              Nenhum item adicionado a este lote ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-sans">Empresa Exibidora</th>
                    <th className="py-2.5 px-4">Pedido / Campanha</th>
                    <th className="py-2.5 px-4">Carteira Asaas</th>
                    <th className="py-2.5 px-4 text-emerald-400">Valor (R$)</th>
                    <th className="py-2.5 px-4 font-sans">Status Item</th>
                    <th className="py-2.5 px-4 font-sans">Comprovante Transferência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {batchItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-950/50 transition">
                      <td className="py-2.5 px-4 font-sans">
                        <strong className="block text-white">{item.seller?.trade_name || 'Exibidora'}</strong>
                      </td>

                      <td className="py-2.5 px-4">
                        <span className="block text-slate-300">Pedido #{item.ad_offer_order_id.slice(0, 8)}</span>
                        {item.campaign && <span className="text-[10px] text-purple-400">{item.campaign.name}</span>}
                      </td>

                      <td className="py-2.5 px-4 font-mono text-slate-400">
                        {item.asaas_wallet_id || '—'}
                      </td>

                      <td className="py-2.5 px-4 font-bold text-emerald-400">
                        R$ {(item.amount_cents / 100).toFixed(2)}
                      </td>

                      <td className="py-2.5 px-4 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.status === 'transferred'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.status === 'ready'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">
                        {item.asaas_transfer_id ? (
                          <span className="text-emerald-400 font-bold">{item.asaas_transfer_id}</span>
                        ) : (
                          item.error_message || '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Seleção de Itens Elegíveis */}
      {addItemsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Adicionar Itens Elegíveis ao Lote {selectedBatch?.batch_number}</h3>
            <p className="text-xs text-slate-400">
              Selecione os pedidos com elegibilidade comprovada da Fase 5D para incluir neste lote de repasse.
            </p>

            {eligibleItems.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center">
                Nenhum item elegível disponível no momento. Conclua entregas de veiculação e homologue cadastros.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {eligibleItems.map((elig) => {
                  const isChecked = selectedEligibilityIds.includes(elig.id);
                  return (
                    <div
                      key={elig.id}
                      onClick={() => {
                        if (isChecked) setSelectedEligibilityIds(selectedEligibilityIds.filter((id) => id !== elig.id));
                        else setSelectedEligibilityIds([...selectedEligibilityIds, elig.id]);
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                        isChecked ? 'bg-purple-500/10 border-purple-500/40 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <strong className="block text-xs text-white">{elig.seller?.trade_name || 'Exibidora'}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">Pedido #{elig.ad_offer_order_id.slice(0, 8)}</span>
                      </div>

                      <div className="text-right">
                        <strong className="block text-xs text-emerald-400 font-mono">
                          R$ {(elig.eligible_amount_cents / 100).toFixed(2)}
                        </strong>
                        <span className="text-[9px] text-purple-400 font-mono uppercase">{elig.eligibility_status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setAddItemsModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmAddItems}
                disabled={actionLoading || selectedEligibilityIds.length === 0}
                className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-5 py-2 rounded-xl text-xs transition shadow-lg shadow-purple-500/20"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar ao Lote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento de Lote */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Cancelar Lote de Repasse</h3>
            <p className="text-xs text-slate-400">
              Informe o motivo do cancelamento deste lote.
            </p>

            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition"
              >
                Voltar
              </button>

              <button
                onClick={handleConfirmCancelModal}
                disabled={actionLoading}
                className="bg-rose-500 hover:bg-rose-600 font-bold text-white px-5 py-2 rounded-xl text-xs transition shadow-lg shadow-rose-500/20"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
