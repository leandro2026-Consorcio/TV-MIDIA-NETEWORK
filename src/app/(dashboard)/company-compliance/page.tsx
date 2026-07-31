'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { 
  checkCompanyRequiredTermsAction, 
  getCompanyTermAcceptancesAction, 
  acceptPlatformTermAction 
} from '@/app/actions/terms';
import { ShieldCheck, AlertCircle, CheckCircle2, Loader2, FileText, CheckSquare, Clock, UserCheck, Sparkles } from 'lucide-react';

export default function CompanyCompliancePage() {
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const [complianceData, setComplianceData] = useState<any>(null);
  const [acceptances, setAcceptances] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal de Aceite
  const [selectedPendingTerm, setSelectedPendingTerm] = useState<any | null>(null);
  const [agreed, setAgreed] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadCompanies() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: compUsers } = await (supabase.from('company_users') as any)
        .select('company_id, company:companies(*)')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (compUsers && compUsers.length > 0) {
        const comps = compUsers.map((cu: any) => cu.company).filter(Boolean);
        setUserCompanies(comps);
        if (comps.length > 0) {
          setSelectedCompanyId(comps[0].id);
        }
      }
    }
    loadCompanies();
  }, [supabase]);

  const loadComplianceStatus = async (companyId: string) => {
    if (!companyId) return;

    try {
      setLoading(true);
      setError(null);

      const checkRes = await checkCompanyRequiredTermsAction(companyId);
      if (checkRes.success) {
        setComplianceData(checkRes);
      }

      const accRes = await getCompanyTermAcceptancesAction(companyId);
      if (accRes.success) {
        setAcceptances(accRes.acceptances || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCompanyId) {
      loadComplianceStatus(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const handleOpenAcceptModal = (term: any) => {
    setSelectedPendingTerm(term);
    setAgreed(false);
  };

  const handleAcceptTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPendingTerm || !agreed) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await acceptPlatformTermAction(
      selectedCompanyId,
      selectedPendingTerm.term_id,
      'network_settings'
    );

    if (!res.success) {
      setError(res.error || 'Erro ao formalizar aceite.');
    } else {
      setSuccess(`Aceite registrado com sucesso para o termo "${selectedPendingTerm.title}" (Versão ${selectedPendingTerm.version})!`);
      setSelectedPendingTerm(null);
      await loadComplianceStatus(selectedCompanyId);
    }
    setActionLoading(false);
  };

  if (loading && !complianceData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Banner de Conformidade */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                complianceData?.compliant
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {complianceData?.compliant ? '100% Em Conformidade' : 'Termos Pendentes'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 mt-1">
            <ShieldCheck className="w-6 h-6 text-purple-400" /> Conformidade & Aceite de Termos
          </h1>
          <p className="text-xs text-slate-400">
            Acompanhe o status jurídico da empresa e aceite os termos de uso ativos para manter sua conta liberada para todas as funções da rede.
          </p>
        </div>

        {userCompanies.length > 1 && (
          <div className="w-64">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Empresa Selecionada</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              {userCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name}
                </option>
              ))}
            </select>
          </div>
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

      {/* Alerta de Termos Pendentes de Aceite */}
      {complianceData && !complianceData.compliant && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-3 text-amber-400">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <h3 className="font-bold text-base">Atenção: Sua empresa possui {complianceData.pendingTermsCount} termo(s) pendente(s) de aceite!</h3>
          </div>
          <p className="text-xs text-slate-300">
            Para garantir a segurança jurídica e operacional da rede, é necessário formalizar o aceite dos termos vigentes abaixo:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {complianceData.pendingTerms.map((pt: any) => (
              <div key={pt.term_id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {pt.term_type} (v{pt.version})
                  </span>
                  <h4 className="font-bold text-white text-sm mt-1">{pt.title}</h4>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{pt.content}</p>
                <button
                  onClick={() => handleOpenAcceptModal(pt)}
                  className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
                >
                  <CheckSquare className="w-4 h-4" /> Ler e Aceitar Termo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico Imutável de Aceites Realizados */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-purple-400" /> Histórico Imutável de Aceites da Empresa
        </h3>

        {acceptances.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">Nenhum registro de aceite formalizado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Termo / Tipo</th>
                  <th className="py-3 px-4 font-mono">Versão</th>
                  <th className="py-3 px-4">Usuário Responsável</th>
                  <th className="py-3 px-4 font-mono">Data / Hora Aceite</th>
                  <th className="py-3 px-4 font-mono">Contexto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {acceptances.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 text-white font-sans font-bold">
                      {a.term?.title || 'Termo de Uso'}
                    </td>
                    <td className="py-3 px-4 text-purple-400 font-bold">
                      v{a.term?.version || 1}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans">
                      {a.profile?.full_name || a.profile?.email || 'Admin Empresa'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      {new Date(a.accepted_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-950 border border-slate-800">
                        {a.acceptance_context}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Aceite de Termo Pendente */}
      {selectedPendingTerm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="border-b border-slate-800 pb-3">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {selectedPendingTerm.term_type} (Versão {selectedPendingTerm.version})
              </span>
              <h3 className="text-lg font-bold text-white mt-1">{selectedPendingTerm.title}</h3>
            </div>

            <div className="overflow-y-auto flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-3 leading-relaxed">
              {selectedPendingTerm.content}
            </div>

            <form onSubmit={handleAcceptTerm} className="space-y-4 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                  className="mt-0.5 accent-purple-500 w-4 h-4 rounded"
                />
                <span className="text-xs text-slate-300 font-medium">
                  Declaro que li, compreendi e concordo integralmente com os termos e regras operacionais acima em nome da empresa.
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPendingTerm(null)}
                  disabled={actionLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !agreed}
                  className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 font-bold text-white px-5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar e Formalizar Aceite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
