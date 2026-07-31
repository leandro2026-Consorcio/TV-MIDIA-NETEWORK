'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { getSellerStatementAction } from '@/app/actions/financial-reports';
import { DollarSign, Tv, TrendingUp, Clock, CheckCircle2, AlertCircle, Loader2, Sparkles, Building2, Receipt, FileText } from 'lucide-react';

export default function SellerStatementPage() {
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const [summary, setSummary] = useState<any>(null);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Carregar empresas do usuário
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

  // Carregar extrato financeiro da empresa selecionada
  const loadStatement = async (companyId: string) => {
    if (!companyId) return;

    try {
      setLoading(true);
      setError(null);

      const res = await getSellerStatementAction(companyId);
      if (!res.success) {
        setError(res.error || 'Erro ao carregar extrato financeiro.');
        return;
      }

      setSummary(res.summary);
      setLedgers(res.ledgers || []);
      setDiscounts(res.discounts || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCompanyId) {
      loadStatement(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Banner Comercial de Destaque */}
      <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900 border border-purple-500/30 p-6 rounded-2xl relative overflow-hidden shadow-xl">
        <div className="flex items-start justify-between relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold font-mono">
              <Sparkles className="w-3.5 h-3.5" /> Valorize suas TVs na Rede
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Sua TV pode ajudar a pagar sua mensalidade.
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Acompanhe aqui o valor líquido gerado pelas campanhas vendidas pela sua empresa. Quando as exibições são 100% concluídas, o saldo é liberado para abatimento na mensalidade da plataforma.
            </p>
          </div>

          {userCompanies.length > 1 && (
            <div className="w-64">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Selecionar Empresa</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
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
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Cards de Métricas da Exibidora */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              TOTAL VENDIDO PELAS SUAS TVs
            </span>
            <div className="text-3xl font-extrabold text-white mt-1 font-mono">
              R$ {(summary.totalGrossCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Valor bruto contratado por anunciantes</p>
          </div>

          <div className="bg-slate-900 border border-purple-500/30 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider block font-mono">
              LÍQUIDO ACUMULADO DA SUA EMPRESA
            </span>
            <div className="text-3xl font-extrabold text-purple-400 mt-1 font-mono">
              R$ {(summary.totalSellerNetCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Líquido após taxa da plataforma</p>
          </div>

          <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block font-mono">
              DISPONÍVEL P/ ABATIMENTO DE MENSALIDADE
            </span>
            <div className="text-3xl font-extrabold text-emerald-400 mt-1 font-mono">
              R$ {(summary.totalAvailableCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Liberado após conclusão das inserções</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              SALDO PREVISTO (EM VEICULAÇÃO)
            </span>
            <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">
              R$ {(summary.totalPendingCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Será liberado após 100% de exibição</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              VALOR JÁ UTILIZADO EM ABATIMENTO
            </span>
            <div className="text-2xl font-bold text-slate-300 mt-1 font-mono">
              R$ {(summary.totalUsedDiscountCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Abatido na sua mensalidade pelo Master</p>
          </div>
        </div>
      )}

      {/* Tabela de Vendas de Mídia / Pedidos */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-purple-400" /> Histórico de Pedidos Vendidos
        </h3>

        {ledgers.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">Sua empresa ainda não possui vendas de ofertas de mídia no marketplace.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Data Pedido</th>
                  <th className="py-3 px-4">Empresa Anunciante</th>
                  <th className="py-3 px-4 font-mono">Valor Bruto</th>
                  <th className="py-3 px-4 font-mono">Comissão</th>
                  <th className="py-3 px-4 font-mono">Seu Líquido</th>
                  <th className="py-3 px-4 font-mono">Status da Entrega</th>
                  <th className="py-3 px-4 font-mono">Saldo Disponível</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {ledgers.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      {new Date(l.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-white font-sans font-bold">
                      {l.buyer?.trade_name || 'Anunciante'}
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      R$ {(l.gross_amount_cents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      R$ {(l.platform_fee_cents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-purple-300 font-bold">
                      R$ {(l.seller_net_cents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          l.delivery_status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {l.delivery_status === 'completed' ? 'Entrega 100% Concluída' : 'Em Veiculação'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">
                      R$ {(l.amount_available_cents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Histórico de Abatimentos Aplicados */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" /> Abatimentos Aplicados na sua Mensalidade
        </h3>

        {discounts.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">Nenhum abatimento registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Data do Abatimento</th>
                  <th className="py-3 px-4 font-mono">Valor Abatido</th>
                  <th className="py-3 px-4">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {discounts.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      {new Date(d.applied_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">
                      R$ {(d.amount_cents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans">
                      {d.reason}
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
