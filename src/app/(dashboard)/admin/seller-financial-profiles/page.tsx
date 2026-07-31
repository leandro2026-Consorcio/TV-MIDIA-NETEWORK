'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  getSellerFinancialProfilesForAdminAction, 
  approveSellerFinancialProfileAction, 
  rejectSellerFinancialProfileAction, 
  suspendSellerFinancialProfileAction, 
  createOrLinkAsaasSubAccountAction 
} from '@/app/actions/seller-financial-profiles';
import { 
  Building2, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  CreditCard, 
  Eye, 
  Ban, 
  Link as LinkIcon 
} from 'lucide-react';

export default function AdminSellerFinancialProfilesPage() {
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State para Rejeição / Suspensão
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'reject' | 'suspend'>('reject');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [reasonNotes, setReasonNotes] = useState('');

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

      const res = await getSellerFinancialProfilesForAdminAction({
        verificationStatus: statusFilter,
      });

      if (res.success) {
        setProfiles(res.profiles || []);
      } else {
        setError(res.error || 'Erro ao carregar cadastros financeiros.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // Ações do Master Admin
  const handleApprove = async (companyId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await approveSellerFinancialProfileAction(companyId);
    if (!res.success) {
      setError(res.error || 'Erro ao aprovar cadastro.');
    } else {
      setSuccess('Cadastro financeiro da exibidora APROVADO com sucesso!');
      await loadData();
    }
    setActionLoading(false);
  };

  const handleOpenReasonModal = (companyId: string, action: 'reject' | 'suspend') => {
    setSelectedCompanyId(companyId);
    setModalAction(action);
    setReasonNotes('');
    setModalOpen(true);
  };

  const handleConfirmReasonModal = async () => {
    if (!reasonNotes.trim()) {
      setError('É obrigatório informar a justificativa.');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    let res: any;
    if (modalAction === 'reject') {
      res = await rejectSellerFinancialProfileAction(selectedCompanyId, reasonNotes);
    } else {
      res = await suspendSellerFinancialProfileAction(selectedCompanyId, reasonNotes);
    }

    if (!res.success) {
      setError(res.error || 'Erro ao atualizar cadastro.');
    } else {
      setSuccess(`Cadastro financeiro ${modalAction === 'reject' ? 'REJEITADO' : 'SUSPENSO'} com sucesso!`);
      setModalOpen(false);
      await loadData();
    }
    setActionLoading(false);
  };

  const handleLinkAsaasSubaccount = async (companyId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await createOrLinkAsaasSubAccountAction(companyId);
    if (!res.success) {
      setError(res.error || 'Erro ao vincular subconta Asaas.');
    } else {
      setSuccess(`Identificador de Subconta Asaas vinculado: ${res.asaasAccountId}`);
      await loadData();
    }
    setActionLoading(false);
  };

  // Funções de Mascaramento para Segurança
  const maskDocument = (doc: string) => {
    if (!doc) return '—';
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}.***.***-${clean.slice(9)}`;
    }
    return `${clean.slice(0, 2)}.***.***/${clean.slice(8, 12)}-**`;
  };

  const maskAccount = (acc: string) => {
    if (!acc) return '—';
    return `***${acc.slice(-3)}`;
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
          Apenas Administradores Globais possuem acesso à gestão financeira dos exibidores.
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
            <ShieldCheck className="w-6 h-6 text-purple-400" /> Homologação Financeira de Exibidores
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Revisão contábil, aprovação de cadastros fiscais/bancários e vínculo de subcontas Asaas.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={actionLoading}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} /> Atualizar Lista
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabela de Perfis Financeiros */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <h3 className="font-bold text-white text-base">Cadastros Fiscais & Bancários ({profiles.length})</h3>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filtrar Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs rounded-xl px-3 py-1.5 focus:outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="pending_review">pending_review (Em Análise)</option>
              <option value="approved">approved (Aprovados)</option>
              <option value="rejected">rejected (Rejeitados)</option>
              <option value="suspended">suspended (Suspensos)</option>
              <option value="draft">draft (Rascunho)</option>
            </select>
          </div>
        </div>

        {profiles.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-8 text-center">
            Nenhum cadastro financeiro encontrado com o filtro selecionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-sans">Empresa Exibidora</th>
                  <th className="py-3 px-4">Documento / Razão Social</th>
                  <th className="py-3 px-4">Dados Bancários</th>
                  <th className="py-3 px-4 font-sans">Status Verificação</th>
                  <th className="py-3 px-4 font-sans">Subconta Asaas</th>
                  <th className="py-3 px-4 text-right font-sans">Ações Master</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 font-sans">
                      <strong className="block text-white">{p.company?.trade_name || 'Exibidora'}</strong>
                      <span className="text-[10px] text-purple-400">{p.responsible_name}</span>
                    </td>

                    <td className="py-3 px-4">
                      <strong className="block text-slate-200 font-sans">{p.legal_name}</strong>
                      <span className="text-[10px] text-slate-400">
                        {p.document_type?.toUpperCase()}: {maskDocument(p.document_number)}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="block text-slate-300">
                        {p.bank_name} ({p.bank_code})
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Ag: {p.bank_agency} • Cc: {maskAccount(p.bank_account)}-{p.bank_account_digit}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.verification_status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : p.verification_status === 'pending_review'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : p.verification_status === 'rejected' || p.verification_status === 'suspended'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {p.verification_status}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.asaas_status === 'created' || p.asaas_status === 'active'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {p.asaas_status}
                      </span>
                      {p.asaas_account_id && (
                        <span className="text-[9px] text-slate-500 block font-mono">
                          {p.asaas_account_id}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-sans space-x-1.5">
                      {p.verification_status !== 'approved' && (
                        <button
                          onClick={() => handleApprove(p.company_id)}
                          disabled={actionLoading}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold px-2 py-1 rounded-lg text-[11px] border border-emerald-500/30 transition"
                        >
                          Aprovar
                        </button>
                      )}

                      {p.verification_status !== 'rejected' && (
                        <button
                          onClick={() => handleOpenReasonModal(p.company_id, 'reject')}
                          disabled={actionLoading}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold px-2 py-1 rounded-lg text-[11px] border border-rose-500/30 transition"
                        >
                          Rejeitar
                        </button>
                      )}

                      {p.verification_status === 'approved' && !p.asaas_account_id && (
                        <button
                          onClick={() => handleLinkAsaasSubaccount(p.company_id)}
                          disabled={actionLoading}
                          className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold px-2 py-1 rounded-lg text-[11px] border border-purple-500/30 transition"
                        >
                          Vincular Subconta
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

      {/* Modal de Rejeição ou Suspensão com Motivo Obrigatório */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {modalAction === 'reject' ? 'Rejeitar Cadastro Financeiro' : 'Suspender Cadastro Financeiro'}
            </h3>
            <p className="text-xs text-slate-400">
              Informe a justificativa ou o motivo da inconformidade. Esta mensagem ficará visível para a empresa exibidora.
            </p>

            <textarea
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo (Ex: CNPJ inconsistente com a Razão Social, Conta bancária inválida)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmReasonModal}
                disabled={actionLoading}
                className="bg-rose-500 hover:bg-rose-600 font-bold text-white px-5 py-2 rounded-xl text-xs transition shadow-lg shadow-rose-500/20"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
