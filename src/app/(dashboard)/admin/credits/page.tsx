'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Company, CreditType, SourceType } from '@/types';
import { addCreditsManuallyAction } from '@/app/actions/wallet';
import { Wallet, Plus, CheckCircle2, AlertCircle, Loader2, Sparkles, Building2 } from 'lucide-react';

export default function AdminCreditsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [amount, setAmount] = useState<string>('100');
  const [creditType, setCreditType] = useState<CreditType>('bonus_credit');
  const [sourceType, setSourceType] = useState<SourceType>('manual_adjustment');
  const [description, setDescription] = useState('Bônus comercial concedido pelo Master Admin');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadCompanies() {
      try {
        setLoading(true);
        const { data: compList } = await (supabase.from('companies') as any)
          .select('*')
          .order('trade_name');

        if (compList && compList.length > 0) {
          setCompanies(compList as Company[]);
          setSelectedCompanyId(compList[0].id);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadCompanies();
  }, [supabase]);

  const handleGrantCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const res = await addCreditsManuallyAction(
      selectedCompanyId,
      parseFloat(amount),
      creditType,
      sourceType,
      description
    );

    if (!res.success) {
      setError(res.error || 'Erro ao conceder créditos.');
      setSubmitting(false);
      return;
    }

    setSuccess(`Créditos concedidos com sucesso! Novo saldo: ${res.new_balance} CR`);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Atribuição Manual de Créditos</h1>
          <p className="text-slate-400 text-sm mt-1">
            Painel exclusivo do Master Admin para ajuste e concessão de saldo corporativo.
          </p>
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

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
        <form onSubmit={handleGrantCredits} className="space-y-5 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Empresa Beneficiária *</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-amber-500"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name} ({c.city} - {c.state})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Quantidade de Créditos (CR) *</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 font-mono text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Tipo de Crédito *</label>
              <select
                value={creditType}
                onChange={(e) => setCreditType(e.target.value as CreditType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="bonus_credit">Bonus Credit (Bônus Comercial)</option>
                <option value="paid_credit">Paid Credit (Crédito Comprado)</option>
                <option value="trial_credit">Trial Credit (Degustação)</option>
                <option value="referral_credit">Referral Credit (Indicação VIP)</option>
                <option value="exchange_credit">Exchange Credit (Permuta)</option>
                <option value="network_inventory_credit">Network Inventory (Inventário Cedido Trial)</option>
                <option value="monthly_network_quota">Monthly Network Quota (Cota Colaborativa Mensal)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Origem do Lançamento</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="manual_adjustment">Ajuste Manual</option>
              <option value="credit_package">Pacote de Crédito</option>
              <option value="trial_grant">Concessão de Trial</option>
              <option value="referral_bonus">Bônus por Indicação</option>
              <option value="network_quota">Cota de Rede</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Descrição / Justificativa Auditável *</label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-4 flex justify-end border-t border-slate-800">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold rounded-xl transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} Adicionar Créditos
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
