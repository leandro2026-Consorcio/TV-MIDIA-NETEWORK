'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company, CompanyAdOffer } from '@/types';
import { 
  getCompanyAdOffersAction, 
  submitAdOfferForReviewAction, 
  pauseAdOfferAction, 
  archiveAdOfferAction 
} from '@/app/actions/ad-offers';
import { Tag, Plus, CheckCircle2, AlertCircle, Loader2, Send, Pause, Archive, ArrowUpRight, DollarSign } from 'lucide-react';

export default function AdOffersPage() {
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [offers, setOffers] = useState<CompanyAdOffer[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  const loadOffers = async (companyId: string) => {
    try {
      setLoading(true);
      const res = await getCompanyAdOffersAction(companyId);
      if (res.success) {
        setOffers(res.offers as CompanyAdOffer[]);
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
          await loadOffers(initialId);
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
    await loadOffers(companyId);
  };

  const handleSubmitForReview = async (offerId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await submitAdOfferForReviewAction(offerId);
    if (!res.success) {
      setError(res.error || 'Erro ao submeter oferta para revisão.');
    } else {
      setSuccess('Oferta submetida com sucesso para revisão do Master Admin!');
      await loadOffers(selectedCompanyId);
    }
    setActionLoading(false);
  };

  const handlePause = async (offerId: string) => {
    setActionLoading(true);
    setError(null);
    const res = await pauseAdOfferAction(offerId);
    if (!res.success) setError(res.error || 'Erro ao pausar oferta.');
    else await loadOffers(selectedCompanyId);
    setActionLoading(false);
  };

  const handleArchive = async (offerId: string) => {
    if (!confirm('Deseja arquivar este plano de mídia?')) return;
    setActionLoading(true);
    setError(null);
    const res = await archiveAdOfferAction(offerId);
    if (!res.success) setError(res.error || 'Erro ao arquivar oferta.');
    else await loadOffers(selectedCompanyId);
    setActionLoading(false);
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Planos de Mídia da Empresa</h1>
          <p className="text-slate-400 text-sm mt-1">
            Crie cards comerciais de mídia para vender exposição nas suas TVs e abater sua mensalidade.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
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

          <Link
            href="/ad-offers/new"
            className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> Criar Novo Plano
          </Link>
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

      {/* Grid de Cards de Ofertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {offers.length === 0 ? (
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
            <div className="bg-purple-500/10 p-4 rounded-2xl text-purple-400 inline-block border border-purple-500/20">
              <Tag className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Nenhum plano de mídia cadastrado ainda</h3>
            <p className="text-slate-400 text-xs max-w-md mx-auto">
              Sua empresa pode criar planos como "Giro Local 100 CR por R$ 150,00" para vender exposição para anunciantes da região.
            </p>
            <Link
              href="/ad-offers/new"
              className="inline-flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-lg shadow-purple-500/20"
            >
              <Plus className="w-4 h-4" /> Criar Primeiro Plano
            </Link>
          </div>
        ) : (
          offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl hover:border-purple-500/30 transition group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                      offer.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : offer.status === 'pending_review'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : offer.status === 'rejected'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {offer.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-amber-400 font-mono font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                    {offer.credits_amount} CR
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition">{offer.title}</h3>
                {offer.description && <p className="text-xs text-slate-400 line-clamp-2">{offer.description}</p>}

                {offer.status === 'rejected' && offer.rejection_reason && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
                    <strong>Motivo da Rejeição:</strong> {offer.rejection_reason}
                  </div>
                )}

                {/* Detalhamento Financeiro */}
                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center font-mono text-xs">
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block font-sans">Valor Bruto</span>
                    <strong className="text-white">R$ {(offer.price_cents / 100).toFixed(2)}</strong>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block font-sans">Taxa ({offer.platform_fee_percentage}%)</span>
                    <strong className="text-rose-400">R$ {(Number(offer.platform_fee_cents) / 100).toFixed(2)}</strong>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-xl border border-purple-500/30">
                    <span className="text-[10px] text-purple-400 block font-sans font-bold">Líquido Empresa</span>
                    <strong className="text-emerald-400 font-extrabold">R$ {(Number(offer.seller_net_cents) / 100).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 text-xs">
                {offer.status === 'draft' && (
                  <button
                    onClick={() => handleSubmitForReview(offer.id)}
                    disabled={actionLoading}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" /> Enviar para Revisão
                  </button>
                )}

                {offer.status === 'active' && (
                  <button
                    onClick={() => handlePause(offer.id)}
                    disabled={actionLoading}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pausar
                  </button>
                )}

                {offer.status !== 'archived' && (
                  <button
                    onClick={() => handleArchive(offer.id)}
                    disabled={actionLoading}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg transition"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
