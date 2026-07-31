'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Company, Segment, CompanyNetworkPreferences } from '@/types';
import { getCompanyNetworkPreferencesAction, updateCompanyNetworkPreferencesAction } from '@/app/actions/network';
import { Settings2, ShieldBan, Save, CheckCircle2, AlertCircle, Loader2, Building2, Layers } from 'lucide-react';

export default function NetworkSettingsPage() {
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [allSegments, setAllSegments] = useState<Segment[]>([]);

  // Preferences State
  const [acceptsNetworkAds, setAcceptsNetworkAds] = useState(true);
  const [maxGradePercent, setMaxGradePercent] = useState<string>('10');
  const [requiresManualApproval, setRequiresManualApproval] = useState(true);
  const [blockedCompanies, setBlockedCompanies] = useState<string[]>([]);
  const [blockedSegments, setBlockedSegments] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  const loadPreferences = async (companyId: string) => {
    try {
      setLoading(true);
      const res = await getCompanyNetworkPreferencesAction(companyId);
      if (res.success && res.preferences) {
        const prefs = res.preferences as CompanyNetworkPreferences;
        setAcceptsNetworkAds(Boolean(prefs.accepts_network_ads));
        setMaxGradePercent(String(prefs.max_external_grade_percentage ?? 10));
        setRequiresManualApproval(Boolean(prefs.requires_manual_approval));
        setBlockedCompanies(prefs.blocked_companies || []);
        setBlockedSegments(prefs.blocked_segments || []);
        setNotes(prefs.notes || '');
      }
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

        // 1. Carregar Empresas do Usuário
        const { data: userComps } = await (supabase.from('companies') as any)
          .select('*, company_users!inner(user_id, role)')
          .eq('company_users.user_id', user.id)
          .eq('company_users.is_active', true);

        if (userComps && userComps.length > 0) {
          setUserCompanies(userComps as Company[]);
          const initialId = userComps[0].id;
          setSelectedCompanyId(initialId);
          await loadPreferences(initialId);
        }

        // 2. Carregar Todas as Empresas (para lista de bloqueios de concorrentes)
        const { data: compList } = await (supabase.from('companies') as any)
          .select('*')
          .order('trade_name');
        setAllCompanies((compList || []) as Company[]);

        // 3. Carregar Todos os Segmentos (para lista de bloqueios de segmento)
        const { data: segList } = await (supabase.from('segments') as any)
          .select('*')
          .order('name');
        setAllSegments((segList || []) as Segment[]);
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
    await loadPreferences(companyId);
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const res = await updateCompanyNetworkPreferencesAction(selectedCompanyId, {
      accepts_network_ads: acceptsNetworkAds,
      max_external_grade_percentage: parseFloat(maxGradePercent),
      requires_manual_approval: requiresManualApproval,
      blocked_companies: blockedCompanies,
      blocked_segments: blockedSegments,
      notes: notes || null,
    });

    if (!res.success) {
      setError(res.error || 'Erro ao salvar preferências da rede.');
      setSaving(false);
      return;
    }

    setSuccess('Preferências da rede atualizadas com sucesso!');
    setSaving(false);
  };

  const toggleBlockedCompany = (companyIdToToggle: string) => {
    setBlockedCompanies((prev) =>
      prev.includes(companyIdToToggle) ? prev.filter((id) => id !== companyIdToToggle) : [...prev, companyIdToToggle]
    );
  };

  const toggleBlockedSegment = (segmentIdToToggle: string) => {
    setBlockedSegments((prev) =>
      prev.includes(segmentIdToToggle) ? prev.filter((id) => id !== segmentIdToToggle) : [...prev, segmentIdToToggle]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Preferências da Rede Colaborativa</h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure o aceite de anúncios parceiros, o limite de grade e bloqueie concorrentes ou segmentos.
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

      <form onSubmit={handleSavePreferences} className="space-y-6">
        {/* Painel Principal de Configurações */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 shadow-xl text-xs">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="bg-purple-500/10 p-2.5 rounded-xl text-purple-400 border border-purple-500/20">
              <Settings2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Aceite e Limite da Grade Externa</h2>
              <p className="text-slate-400">Controle a exibição de mídia de empresas parceiras na sua TV</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <div>
                <label className="font-bold text-white text-sm block">Aceitar Anúncios da Rede Colaborativa</label>
                <p className="text-slate-400 text-xs mt-0.5">Permite que mídias aprovadas de parceiros rodem na sua TV em troca de inventário</p>
              </div>
              <input
                type="checkbox"
                checked={acceptsNetworkAds}
                onChange={(e) => setAcceptsNetworkAds(e.target.checked)}
                className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <div>
                <label className="font-bold text-white text-sm block">Aprovação Manual Obrigatória</label>
                <p className="text-slate-400 text-xs mt-0.5">Exige aceite manual antes que uma mídia de parceiro entre no ar na sua TV</p>
              </div>
              <input
                type="checkbox"
                checked={requiresManualApproval}
                onChange={(e) => setRequiresManualApproval(e.target.checked)}
                className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Limite Máximo da Grade Externa (%)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxGradePercent}
                onChange={(e) => setMaxGradePercent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Sugerido: 10% (ex: em uma grade de 10 mídias, no máximo 1 mídia da rede será veiculada)</p>
            </div>
          </div>
        </div>

        {/* Bloqueio de Concorrentes (Empresas e Segmentos) */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 shadow-xl text-xs">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="bg-rose-500/10 p-2.5 rounded-xl text-rose-400 border border-rose-500/20">
              <ShieldBan className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Bloqueio de Concorrentes Diretos & Segmentos</h2>
              <p className="text-slate-400">Anúncios das empresas ou segmentos selecionados nunca serão exibidos nas suas TVs</p>
            </div>
          </div>

          {/* Seleção de Empresas Bloqueadas */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-purple-400" /> Bloquear Empresas Específicas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950 border border-slate-800 rounded-xl">
              {allCompanies
                .filter((c) => c.id !== selectedCompanyId)
                .map((comp) => {
                  const isBlocked = blockedCompanies.includes(comp.id);
                  return (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => toggleBlockedCompany(comp.id)}
                      className={`px-3 py-2 rounded-lg text-left transition flex items-center justify-between border ${
                        isBlocked
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate max-w-[200px]">{comp.trade_name}</span>
                      {isBlocked && <span className="text-[10px] text-rose-400 font-mono">Bloqueada</span>}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Seleção de Segmentos Bloqueados */}
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" /> Bloquear Segmentos Inteiros
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950 border border-slate-800 rounded-xl">
              {allSegments.map((seg) => {
                const isBlocked = blockedSegments.includes(seg.id);
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => toggleBlockedSegment(seg.id)}
                    className={`px-3 py-2 rounded-lg text-left transition flex items-center justify-between border ${
                      isBlocked
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate max-w-[200px]">{seg.name}</span>
                    {isBlocked && <span className="text-[10px] text-rose-400 font-mono">Bloqueado</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Preferências de Rede
          </button>
        </div>
      </form>
    </div>
  );
}
