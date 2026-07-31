'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CreditPackage, CreditType } from '@/types';
import { getCreditPackagesAction, createCreditPackageAction, updateCreditPackageAction } from '@/app/actions/wallet';
import { Package, Plus, CheckCircle2, AlertCircle, Loader2, Sparkles, Edit2 } from 'lucide-react';

export default function CreditPackagesPage() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [isMaster, setIsMaster] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creditsAmount, setCreditsAmount] = useState<string>('500');
  const [priceCents, setPriceCents] = useState<string>('15000');
  const [creditType, setCreditType] = useState<CreditType>('paid_credit');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  const loadPackages = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await (supabase.from('profiles') as any)
        .select('is_master_admin')
        .eq('id', user.id)
        .single();

      setIsMaster(!!profile?.is_master_admin);

      const res = await getCreditPackagesAction();
      if (res.success) {
        setPackages(res.packages as CreditPackage[]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, [supabase]);

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const res = await createCreditPackageAction({
      name,
      description: description || null,
      credits_amount: parseFloat(creditsAmount),
      price_cents: parseInt(priceCents, 10),
      credit_type: creditType,
    });

    if (!res.success) {
      setError(res.error || 'Erro ao criar pacote de crédito.');
      setSubmitting(false);
      return;
    }

    setSuccess('Pacote de crédito criado com sucesso!');
    setName('');
    setDescription('');
    setCreditsAmount('500');
    setPriceCents('15000');
    setSubmitting(false);
    await loadPackages();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Pacotes de Crédito</h1>
          <p className="text-slate-400 text-sm mt-1">
            Catálogo de produtos de créditos corporativos para veiculação de anúncios na plataforma.
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

      {/* Form de Criação (Master Admin) */}
      {isMaster && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <div className="bg-purple-500 p-2 rounded-xl text-white">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Cadastrar Novo Pacote de Créditos</h2>
              <p className="text-xs text-slate-400">Defina o nome, quantidade de créditos e valor em reais</p>
            </div>
          </div>

          <form onSubmit={handleCreatePackage} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Nome do Pacote *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pacote Bronze (500 CR)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Tipo de Crédito</label>
              <select
                value={creditType}
                onChange={(e) => setCreditType(e.target.value as CreditType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              >
                <option value="paid_credit">Paid Credit (Crédito Comprado)</option>
                <option value="trial_credit">Trial Credit (Degustação)</option>
                <option value="bonus_credit">Bonus Credit (Bônus)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Quantidade de Créditos (CR) *</label>
              <input
                type="number"
                step="0.5"
                min="1"
                required
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Preço Simulado em Centavos (Ex: 15000 = R$ 150,00)</label>
              <input
                type="number"
                required
                value={priceCents}
                onChange={(e) => setPriceCents(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-300 mb-1">Descrição</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Ideal para campanhas locais de 10 segundos"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Salvar Pacote
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid de Pacotes Disponíveis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl hover:border-purple-500/30 transition group"
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="bg-purple-500/10 p-2.5 rounded-xl text-purple-400 border border-purple-500/20">
                  <Package className="w-6 h-6" />
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950 text-emerald-400 border border-slate-800">
                  R$ {(pkg.price_cents / 100).toFixed(2)}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition">{pkg.name}</h3>
              {pkg.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{pkg.description}</p>}

              <div className="mt-4 pt-4 border-t border-slate-800/80 flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Volume de Créditos:</span>
                <strong className="text-2xl font-extrabold text-amber-400">{pkg.credits_amount} CR</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
