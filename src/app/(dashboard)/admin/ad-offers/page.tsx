'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CompanyAdOffer } from '@/types';
import { 
  getAllAdOffersForMasterAction, 
  approveAdOfferAction, 
  rejectAdOfferAction, 
  getPlatformRevenueSettingsAction, 
  updatePlatformRevenueSettingsAction 
} from '@/app/actions/ad-offers';
import { Tag, CheckCircle2, XCircle, AlertCircle, Loader2, Settings, DollarSign, Filter } from 'lucide-react';

export default function AdminAdOffersPage() {
  const [offers, setOffers] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Rejection State
  const [rejectingOfferId, setRejectingOfferId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Settings State
  const [defaultFeePercent, setDefaultFeePercent] = useState<string>('15.0');
  const [minimumPriceCents, setMinimumPriceCents] = useState<string>('5000');
  const [savingSettings, setSavingSettings] = useState(false);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getAllAdOffersForMasterAction();
      if (res.success) {
        setOffers(res.offers || []);
      }

      const settingsRes = await getPlatformRevenueSettingsAction();
      if (settingsRes.success && settingsRes.settings) {
        setDefaultFeePercent(String(settingsRes.settings.default_platform_fee_percentage));
        setMinimumPriceCents(String(settingsRes.settings.minimum_price_cents));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supabase]);

  const handleApprove = async (offerId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await approveAdOfferAction(offerId);
    if (!res.success) {
      setError(res.error || 'Erro ao aprovar oferta.');
    } else {
      setSuccess('Oferta comercial aprovada com sucesso! O card agora está ativo.');
      await loadData();
    }
    setActionLoading(false);
  };

  const handleConfirmReject = async () => {
    if (!rejectingOfferId || !rejectionReason.trim()) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await rejectAdOfferAction(rejectingOfferId, rejectionReason);
    if (!res.success) {
      setError(res.error || 'Erro ao rejeitar oferta.');
    } else {
      setSuccess('Oferta rejeitada com motivo registrado.');
      setRejectingOfferId(null);
      setRejectionReason('');
      await loadData();
    }
    setActionLoading(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);

    const res = await updatePlatformRevenueSettingsAction({
      default_platform_fee_percentage: parseFloat(defaultFeePercent),
      minimum_price_cents: parseInt(minimumPriceCents, 10),
    });

    if (!res.success) {
      setError(res.error || 'Erro ao atualizar taxa da plataforma.');
    } else {
      setSuccess('Configuração global de receita da plataforma atualizada!');
      await loadData();
    }
    setSavingSettings(false);
  };

  const filteredOffers = offers.filter((o) => {
    if (filterStatus === 'all') return true;
    return o.status === filterStatus;
  });

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
          <h1 className="text-2xl font-bold text-white tracking-tight">Revisão de Planos de Mídia</h1>
          <p className="text-slate-400 text-sm mt-1">
            Painel exclusivo do Master Admin para aprovação de cards comerciais e comissão da plataforma.
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

      {/* Caixa de Configurações Globais de Receita */}
      <div className="bg-slate-900 border border-purple-500/30 p-6 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="bg-purple-500 p-2 rounded-xl text-white">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Comissão e Preço Mínimo Global da Plataforma</h2>
            <p className="text-xs text-slate-400">Define o percentual retido pelo Master e o valor mínimo dos cards de mídia</p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Percentual Padrão da Plataforma (%)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="50"
              required
              value={defaultFeePercent}
              onChange={(e) => setDefaultFeePercent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Preço Mínimo em Centavos (Ex: 5000 = R$ 50,00)</label>
            <input
              type="number"
              step="100"
              min="1000"
              required
              value={minimumPriceCents}
              onChange={(e) => setMinimumPriceCents(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold py-2 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />} Salvar Taxas
            </button>
          </div>
        </form>
      </div>

      {/* Filtro por Status */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-300">
          <Filter className="w-4 h-4 text-purple-400" /> Filtrar Ofertas:
        </div>
        <div className="flex gap-2">
          {['all', 'pending_review', 'active', 'rejected', 'draft'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg transition text-[11px] font-semibold uppercase ${
                filterStatus === st
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {st === 'all' ? 'Todas' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Ofertas para Moderação */}
      <div className="space-y-4">
        {filteredOffers.map((offer) => (
          <div key={offer.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-xs text-purple-400 font-bold block">{offer.company?.trade_name || 'Empresa Exibidora'}</span>
                <h3 className="text-base font-bold text-white mt-0.5">{offer.title}</h3>
              </div>
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
            </div>

            {offer.description && <p className="text-xs text-slate-400">{offer.description}</p>}

            {/* Detalhamento de Valores */}
            <div className="grid grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 block font-sans">Créditos</span>
                <strong className="text-amber-400">{offer.credits_amount} CR</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-sans">Valor Bruto</span>
                <strong className="text-white">R$ {(offer.price_cents / 100).toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-sans">Taxa Plataforma ({offer.platform_fee_percentage}%)</span>
                <strong className="text-rose-400">R$ {(offer.platform_fee_cents / 100).toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-[10px] text-purple-400 block font-sans font-bold">Líquido Empresa</span>
                <strong className="text-emerald-400">R$ {(offer.seller_net_cents / 100).toFixed(2)}</strong>
              </div>
            </div>

            {/* Ações de Moderação */}
            <div className="flex justify-end gap-2 text-xs pt-2 border-t border-slate-800">
              {offer.status === 'pending_review' && (
                <>
                  <button
                    onClick={() => setRejectingOfferId(offer.id)}
                    disabled={actionLoading}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> Rejeitar
                  </button>
                  <button
                    onClick={() => handleApprove(offer.id)}
                    disabled={actionLoading}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4 fill-slate-950" /> Aprovar Oferta
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DE REJEIÇÃO COM MOTIVO */}
      {rejectingOfferId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Rejeitar Plano de Mídia</h3>
            <p className="text-xs text-slate-400">Informe o motivo da rejeição para que a empresa possa ajustar o card.</p>
            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Ajustar o valor mínimo de exibição para 10 segundos..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingOfferId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs"
              >
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
