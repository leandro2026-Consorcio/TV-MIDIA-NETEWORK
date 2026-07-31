'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { 
  getSellerPayoutEligibilityForSellerAction, 
  getSellerPayoutSummaryAction 
} from '@/app/actions/seller-payouts';
import { 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  AlertTriangle, 
  Loader2, 
  Building2, 
  Megaphone, 
  ShieldCheck, 
  ArrowUpRight 
} from 'lucide-react';
import Link from 'next/link';

export default function SellerPayoutsPage() {
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<any>(null);
  const [eligibilities, setEligibilities] = useState<any[]>([]);

  const supabase = createClient();

  const loadData = async (companyId: string) => {
    try {
      setLoading(true);
      setError(null);

      const [sumRes, eligRes] = await Promise.all([
        getSellerPayoutSummaryAction(companyId),
        getSellerPayoutEligibilityForSellerAction(companyId),
      ]);

      if (sumRes.success) setSummary(sumRes.summary);
      if (eligRes.success) setEligibilities(eligRes.eligibilities || []);
      else if (!eligRes.success) setError(eligRes.error || 'Erro ao carregar elegibilidade de repasses.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: userComps } = await (supabase.from('companies') as any)
          .select('*, company_users!inner(user_id, role)')
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

    init();
  }, []);

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

  // Verificar se a empresa possui pendência documental
  const hasProfilePending = eligibilities.some((e) => e.eligibility_status === 'pending_financial_profile');
  const hasAsaasPending = eligibilities.some((e) => e.eligibility_status === 'pending_asaas_wallet');

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-purple-400" /> Simulação & Elegibilidade de Payout (Exibidor)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Projeção e maturação dos valores de repasse por veiculação de mídia comprovada via Proof of Play.
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

      {/* Alerta de Cadastro Pendente */}
      {hasProfilePending && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              Existem repasses bloqueados devido à pendência na homologação do cadastro financeiro da exibidora.
            </span>
          </div>

          <Link
            href="/seller-financial-profile"
            className="bg-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition hover:bg-amber-400 shrink-0 flex items-center gap-1"
          >
            Completar Cadastro &rarr;
          </Link>
        </div>
      )}

      {/* Cards de KPIs em Reais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Total Líquido Previsto</span>
          <strong className="text-2xl font-bold text-white block">
            R$ {((summary?.totalSellerNetCents || 0) / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-purple-400 font-mono">Líquido de Ofertas Vendidas</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Elegível para Repasse Futuro</span>
          <strong className="text-2xl font-bold text-emerald-400 block">
            R$ {((summary?.totalEligibleCents || 0) / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-emerald-500/80 font-mono">Entregue e Homologado</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Total Bloqueado / Em Maturação</span>
          <strong className="text-2xl font-bold text-amber-400 block">
            R$ {((summary?.totalBlockedCents || 0) / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-amber-500/80 font-mono">Aguardando Entrega / Homologação</span>
        </div>
      </div>

      {/* Tabela de Elegibilidade por Pedido */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-purple-400" /> Relatório de Elegibilidade de Repasses ({eligibilities.length})
        </h3>

        {eligibilities.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">
            Nenhum pedido de oferta em simulação de elegibilidade para esta empresa.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-sans">Pedido / Campanha</th>
                  <th className="py-3 px-4">Líquido Exibidora</th>
                  <th className="py-3 px-4 text-emerald-400">Elegível</th>
                  <th className="py-3 px-4 font-sans">Status Elegibilidade</th>
                  <th className="py-3 px-4 font-sans">Motivo / Justificativa</th>
                  <th className="py-3 px-4 text-right font-sans">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {eligibilities.map((elig) => (
                  <tr key={elig.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 font-sans">
                      <strong className="block text-white">Pedido #{elig.ad_offer_order_id.slice(0, 8)}</strong>
                      {elig.campaign && (
                        <span className="text-[10px] text-purple-400 flex items-center gap-1">
                          Campanha: {elig.campaign.name}
                        </span>
                      )}
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

                    <td className="py-3 px-4 text-right font-sans">
                      {elig.campaign_id && (
                        <Link
                          href={`/campaigns/${elig.campaign_id}`}
                          className="text-[11px] font-bold text-purple-400 hover:underline inline-flex items-center gap-1"
                        >
                          Ver Inserções <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
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
