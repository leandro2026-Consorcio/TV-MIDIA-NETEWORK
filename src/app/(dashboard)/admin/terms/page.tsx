'use client';

import { useState, useEffect } from 'react';
import { 
  getActiveTermsAction, 
  createPlatformTermAction, 
  publishPlatformTermAction, 
  getCompaniesComplianceStatusAction 
} from '@/app/actions/terms';
import { FileText, PlusCircle, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Building2, Eye, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';

export default function MasterTermsManagementPage() {
  const [terms, setTerms] = useState<any[]>([]);
  const [complianceList, setComplianceList] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form de Novo Termo
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTermType, setNewTermType] = useState('general_terms');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const termsRes = await getActiveTermsAction();
      if (termsRes.success) {
        setTerms(termsRes.terms || []);
      }

      const compRes = await getCompaniesComplianceStatusAction();
      if (compRes.success) {
        setComplianceList(compRes.complianceList || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      setError('Título e conteúdo são obrigatórios.');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await createPlatformTermAction(newTermType, newTitle, newContent);
    if (!res.success) {
      setError(res.error || 'Erro ao criar termo.');
    } else {
      setSuccess(`Novo termo de uso (Versão ${res.term?.version}) criado e publicado com sucesso!`);
      setShowCreateModal(false);
      setNewTitle('');
      setNewContent('');
      await loadData();
    }
    setActionLoading(false);
  };

  const handleToggleActive = async (termId: string, currentActive: boolean) => {
    setActionLoading(true);
    setError(null);

    const res = await publishPlatformTermAction(termId, !currentActive);
    if (!res.success) {
      setError(res.error || 'Erro ao alterar status do termo.');
    } else {
      setSuccess(`Status do termo atualizado com sucesso.`);
      await loadData();
    }
    setActionLoading(false);
  };

  if (loading && terms.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Conformidade & Regras Operacionais
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-400" /> Termos de Uso e Aceites Comerciais
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestão de versões dos termos da plataforma e auditoria de empresas em conformidade jurídica.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
        >
          <PlusCircle className="w-4 h-4" /> Criar Novo Termo / Versão
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

      {/* Lista de Termos Ativos Vigentes */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-purple-400" /> Termos de Uso Ativos na Plataforma ({terms.length})
        </h3>

        {terms.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">Nenhum termo ativo cadastrado no momento.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {terms.map((t) => (
              <div key={t.id} className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {t.term_type} (v{t.version})
                    </span>
                    <h4 className="font-bold text-white text-sm mt-1">{t.title}</h4>
                  </div>
                  <button
                    onClick={() => handleToggleActive(t.id, t.is_active)}
                    disabled={actionLoading}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg transition border ${
                      t.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {t.is_active ? 'ATIVO' : 'INATIVO'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 line-clamp-3 bg-slate-900 p-3 rounded-lg border border-slate-800/80">
                  {t.content}
                </p>
                <span className="text-[10px] text-slate-500 block">
                  Publicado em: {new Date(t.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabela de Auditoria de Conformidade por Empresa */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-purple-400" /> Auditoria de Conformidade das Empresas Cadastradas
        </h3>

        {complianceList.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">Nenhuma empresa encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Cidade / Estado</th>
                  <th className="py-3 px-4 font-mono">Termos Aceitos</th>
                  <th className="py-3 px-4 font-mono">Status de Conformidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {complianceList.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 text-white font-sans font-bold">
                      {c.trade_name}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      {c.city} - {c.state}
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      {c.acceptedCount} / {c.totalActiveTermsCount} termos
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          c.isFullyCompliant
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {c.isFullyCompliant ? 'Conforme 100%' : 'Aceite Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação de Novo Termo */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-purple-400" /> Criar Novo Termo de Uso da Plataforma
            </h3>

            <form onSubmit={handleCreateTerm} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tipo de Termo</label>
                <select
                  value={newTermType}
                  onChange={(e) => setNewTermType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="general_terms">Termos Gerais de Uso (general_terms)</option>
                  <option value="network_participation">Participação na Rede (network_participation)</option>
                  <option value="media_policy">Política de Mídia e Conteúdo (media_policy)</option>
                  <option value="marketplace_terms">Termos Comerciais do Marketplace (marketplace_terms)</option>
                  <option value="financial_discount_policy">Política de Abatimento Financeiro (financial_discount_policy)</option>
                  <option value="advertiser_terms">Termos para Anunciantes (advertiser_terms)</option>
                  <option value="display_partner_terms">Termos para Exibidores (display_partner_terms)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Título do Termo</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Política de Conteúdo e Responsabilidade v2"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Conteúdo do Termo</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={6}
                  placeholder="Escreva a íntegra dos termos e regras operacionais..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publicar Termo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
