'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { createAdOfferAction, getPlatformRevenueSettingsAction } from '@/app/actions/ad-offers';
import { Tag, ArrowLeft, Plus, AlertCircle, Loader2, Sparkles, DollarSign, Calculator } from 'lucide-react';

export default function NewAdOfferPage() {
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creditsAmount, setCreditsAmount] = useState<string>('100');
  const [durationSeconds, setDurationSeconds] = useState<string>('10');
  const [priceCents, setPriceCents] = useState<string>('15000'); // R$ 150,00

  // Platform Fee Settings
  const [platformFeePercent, setPlatformFeePercent] = useState<number>(15.0);
  const [minimumPriceCents, setMinimumPriceCents] = useState<number>(5000);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

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
          setSelectedCompanyId(userComps[0].id);
        }

        const settingsRes = await getPlatformRevenueSettingsAction();
        if (settingsRes.success && settingsRes.settings) {
          setPlatformFeePercent(settingsRes.settings.default_platform_fee_percentage || 15.0);
          setMinimumPriceCents(settingsRes.settings.minimum_price_cents || 5000);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [supabase]);

  // Cálculos em Tempo Real
  const grossPrice = (parseInt(priceCents || '0', 10) / 100);
  const platformFeeVal = (grossPrice * platformFeePercent) / 100;
  const sellerNetVal = grossPrice - platformFeeVal;
  const minPriceVal = minimumPriceCents / 100;

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;

    setSubmitting(true);
    setError(null);

    const priceNum = parseInt(priceCents, 10);
    if (priceNum < minimumPriceCents) {
      setError(`O preço mínimo configurado na plataforma é R$ ${minPriceVal.toFixed(2)}.`);
      setSubmitting(false);
      return;
    }

    const res = await createAdOfferAction(selectedCompanyId, {
      title,
      description: description || null,
      credits_amount: parseFloat(creditsAmount),
      duration_seconds: parseInt(durationSeconds, 10),
      price_cents: priceNum,
    });

    if (!res.success) {
      setError(res.error || 'Erro ao criar plano de mídia.');
      setSubmitting(false);
      return;
    }

    router.push('/ad-offers');
    router.refresh();
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
      <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
        <Link
          href="/ad-offers"
          className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Criar Novo Card de Plano de Mídia</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Defina o nome, créditos, preço e veja a calculadora de repasse líquido em tempo real.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleCreateOffer} className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5 shadow-xl text-xs">
          {userCompanies.length > 1 && (
            <div>
              <label className="block font-medium text-slate-300 mb-1">Empresa Anunciante / Vendedora *</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              >
                {userCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.trade_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-300 mb-1">Título da Oferta Comercial *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Plano Giro Local — 100 Créditos"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-purple-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Quantidade de Créditos (CR) *</label>
              <input
                type="number"
                step="0.5"
                min="1"
                required
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-sm focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Duração Sugerida por Mídia (Segundos)</label>
              <select
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500 text-sm"
              >
                <option value="5">5 Segundos</option>
                <option value="10">10 Segundos (Padrão)</option>
                <option value="15">15 Segundos</option>
                <option value="30">30 Segundos</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Preço Simulado em Centavos (Ex: 15000 = R$ 150,00) *
            </label>
            <input
              type="number"
              min={minimumPriceCents}
              step="100"
              required
              value={priceCents}
              onChange={(e) => setPriceCents(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono text-sm focus:outline-none focus:border-purple-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">Preço mínimo exigido: R$ {minPriceVal.toFixed(2)}</p>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Descrição Comercial</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Excelente oportunidade para comercios locais com alta circulação na recepção."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* CALCULADORA DE COMISSÃO EM TEMPO REAL */}
        <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-sm border-b border-slate-800 pb-3">
            <Calculator className="w-5 h-5" /> Calculadora de Repasse Financeiro
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px]">VALOR BRUTO</span>
              <strong className="text-xl font-extrabold text-white">R$ {grossPrice.toFixed(2)}</strong>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px]">TAXA PLATAFORMA ({platformFeePercent}%)</span>
              <strong className="text-xl font-extrabold text-rose-400">R$ {platformFeeVal.toFixed(2)}</strong>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/40">
              <span className="text-purple-400 block text-[10px] font-bold">REPASSE LÍQUIDO ESTIMADO</span>
              <strong className="text-xl font-extrabold text-emerald-400">R$ {sellerNetVal.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/ad-offers"
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Salvar Plano de Mídia
          </button>
        </div>
      </form>
    </div>
  );
}
