'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { WalletTransaction } from '@/types';
import { getWalletBalanceAction } from '@/app/actions/wallet';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownRight, Clock, ShieldCheck, Loader2, Sparkles } from 'lucide-react';

export default function WalletPage() {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadWalletData() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: userLinks } = await (supabase.from('company_users') as any)
          .select('company_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);

        const activeCompId = userLinks && userLinks.length > 0 ? userLinks[0].company_id : null;
        setCompanyId(activeCompId);

        if (activeCompId) {
          const res = await getWalletBalanceAction(activeCompId);
          if (res.success) {
            setBalance(res.balance);
            setTransactions(res.transactions as WalletTransaction[]);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar carteira:', err);
      } finally {
        setLoading(false);
      }
    }

    loadWalletData();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const totalCreditsIn = transactions
    .filter((t) => t.type === 'credit')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const totalCreditsOut = transactions
    .filter((t) => t.type === 'debit')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Carteira & Créditos</h1>
          <p className="text-slate-400 text-sm mt-1">
            Acompanhe o saldo atual e o extrato de movimentações financeiras auditáveis.
          </p>
        </div>
      </div>

      {/* Cards de Métricas da Carteira */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Saldo Atual */}
        <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 p-6 rounded-2xl space-y-3 shadow-xl">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saldo Atual</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <WalletIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono">
            {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} CR
          </div>
          <p className="text-[11px] text-slate-500">Disponível para veiculação comercial</p>
        </div>

        {/* Total Adicionado */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 shadow-xl">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Créditos Adicionados</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">
            +{totalCreditsIn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} CR
          </div>
          <p className="text-[11px] text-slate-500">Carga manual e pacotes ativados</p>
        </div>

        {/* Total Debitado */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 shadow-xl">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Créditos Consumidos</span>
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-400 font-mono">
            -{totalCreditsOut.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} CR
          </div>
          <p className="text-[11px] text-slate-500">Exibições confirmadas (Proof of Play)</p>
        </div>
      </div>

      {/* Extrato de Transações */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-6 space-y-4">
        <h2 className="font-bold text-white text-base border-b border-slate-800 pb-3">
          Extrato de Movimentações ({transactions.length})
        </h2>

        {transactions.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Nenhuma movimentação financeira registrada nesta carteira.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Tipo de Crédito</th>
                  <th className="py-3 px-4 text-right">Anterior</th>
                  <th className="py-3 px-4 text-right">Movimentação</th>
                  <th className="py-3 px-4 text-right">Novo Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(t.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-white">{t.description}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-950 text-purple-400 border border-slate-800 text-[10px] uppercase">
                        {t.credit_type || 'paid_credit'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">{Number(t.previous_balance).toFixed(2)}</td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        t.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {t.type === 'credit' ? '+' : '-'}{Number(t.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-400 font-bold">{Number(t.new_balance).toFixed(2)}</td>
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
