'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Company, NetworkInventoryLedger } from '@/types';
import { getNetworkInventoryStatusAction, getNetworkInventoryUsageAction } from '@/app/actions/network';
import { Layers, Loader2, AlertCircle, Tv, History, ShieldCheck, Clock, ArrowUpRight } from 'lucide-react';

export default function NetworkInventoryPage() {
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const [ledgers, setLedgers] = useState<NetworkInventoryLedger[]>([]);
  const [totals, setTotals] = useState({ granted: 0, used: 0, remaining: 0 });
  const [usageHistory, setUsageHistory] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const loadData = async (companyId: string) => {
    try {
      setLoading(true);
      const statusRes = await getNetworkInventoryStatusAction(companyId);
      if (statusRes.success) {
        setLedgers(statusRes.ledgers as NetworkInventoryLedger[]);
        setTotals(statusRes.totals);
      }

      const usageRes = await getNetworkInventoryUsageAction(companyId);
      if (usageRes.success) {
        setUsageHistory(usageRes.usage || []);
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

        const { data: userComps } = await (supabase.from('companies') as any)
          .select('*, company_users!inner(user_id)')
          .eq('company_users.user_id', user.id)
          .eq('company_users.is_active', true);

        if (userComps && userComps.length > 0) {
          setUserCompanies(userComps as Company[]);
          const initialId = userComps[0].id;
          setSelectedCompanyId(initialId);
          await loadData(initialId);
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
    await loadData(companyId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Inventário Cedido à Rede</h1>
          <p className="text-slate-400 text-sm mt-1">
            Capacidade de exibição que sua TV disponibiliza para anúncios parceiros da rede colaborativa.
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

      {/* Cards de Resumo do Inventário Cedido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Inventário Concedido</span>
            <span className="text-2xl font-extrabold text-white font-mono">{totals.granted} inserções</span>
          </div>
          <div className="bg-sky-500/10 p-3 rounded-xl text-sky-400 border border-sky-500/20">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Inventário Utilizado</span>
            <span className="text-2xl font-extrabold text-purple-400 font-mono">{totals.used} inserções</span>
          </div>
          <div className="bg-purple-500/10 p-3 rounded-xl text-purple-400 border border-purple-500/20">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Inventário Restante</span>
            <span className="text-2xl font-extrabold text-emerald-400 font-mono">{totals.remaining} inserções</span>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabela de Lotes de Inventário Cedido */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h2 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-400" /> Registros de Inventário Cedido ({ledgers.length})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Origem / Tipo</th>
                <th className="py-3 px-4 font-mono">Concedido</th>
                <th className="py-3 px-4 font-mono">Utilizado</th>
                <th className="py-3 px-4 font-mono">Restante</th>
                <th className="py-3 px-4">Validade</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {ledgers.map((l) => (
                <tr key={l.id} className="hover:bg-slate-950/50 transition">
                  <td className="py-3 px-4 text-white font-sans">
                    <strong className="block text-slate-200">{l.credit_type}</strong>
                    <span className="text-[10px] text-slate-500">{l.source_type}</span>
                  </td>
                  <td className="py-3 px-4 text-sky-400 font-bold">{l.credits_granted} CR</td>
                  <td className="py-3 px-4 text-purple-400 font-bold">{l.credits_used} CR</td>
                  <td className="py-3 px-4 text-emerald-400 font-bold">{l.credits_remaining} CR</td>
                  <td className="py-3 px-4 text-slate-400 text-[11px] font-sans">
                    {l.expires_at ? new Date(l.expires_at).toLocaleDateString('pt-BR') : 'Sem expiração'}
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        l.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : l.status === 'consumed'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico de Exibições da Rede Recebidas na TV da Empresa */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h2 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <History className="w-5 h-5 text-sky-400" /> Histórico de Exibições Parceiras Recebidas ({usageHistory.length})
        </h2>

        {usageHistory.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">Nenhum anúncio da rede veiculado nas suas TVs ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Anunciante</th>
                  <th className="py-3 px-4">Mídia</th>
                  <th className="py-3 px-4 font-mono">Consumo (inserções)</th>
                  <th className="py-3 px-4">Data da Exibição</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {usageHistory.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 text-white font-sans font-bold">
                      {u.advertiser?.trade_name || 'Empresa Anunciante'}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans">
                      {u.media_assets?.title || 'Mídia'}
                    </td>
                    <td className="py-3 px-4 text-purple-400 font-bold">{u.credits_used} inserções</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] font-sans">
                      {new Date(u.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {u.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
