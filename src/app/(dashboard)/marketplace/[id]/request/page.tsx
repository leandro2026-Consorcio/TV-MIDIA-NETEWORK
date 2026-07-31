'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company, MediaAsset } from '@/types';
import { 
  getMarketplaceOfferDetailsAction, 
  getApprovedCompanyMediaAssetsAction, 
  createMarketplaceRequestAction 
} from '@/app/actions/marketplace';
import { ArrowLeft, Send, AlertCircle, Loader2, Calendar, MessageSquare, Image as ImageIcon, ShieldAlert } from 'lucide-react';

export default function MarketplaceRequestFormPage() {
  const params = useParams();
  const offerId = params.id as string;

  const [offer, setOffer] = useState<any>(null);
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedBuyerCompanyId, setSelectedBuyerCompanyId] = useState('');
  const [approvedMediaAssets, setApprovedMediaAssets] = useState<MediaAsset[]>([]);

  // Form State
  const [requestedMediaAssetId, setRequestedMediaAssetId] = useState('');
  const [requestedStartDate, setRequestedStartDate] = useState('');
  const [requestedEndDate, setRequestedEndDate] = useState('');
  const [requestMessage, setRequestMessage] = useState('');

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

        const offerRes = await getMarketplaceOfferDetailsAction(offerId);
        if (!offerRes.success || !offerRes.offer) {
          setError(offerRes.error || 'Oferta de mídia não encontrada.');
          return;
        }
        setOffer(offerRes.offer);

        const { data: userComps } = await (supabase.from('companies') as any)
          .select('*, company_users!inner(user_id)')
          .eq('company_users.user_id', user.id)
          .eq('company_users.is_active', true);

        if (userComps && userComps.length > 0) {
          setUserCompanies(userComps as Company[]);
          const initialBuyerId = userComps[0].id;
          setSelectedBuyerCompanyId(initialBuyerId);

          const mediaRes = await getApprovedCompanyMediaAssetsAction(initialBuyerId);
          if (mediaRes.success) {
            setApprovedMediaAssets(mediaRes.mediaAssets as MediaAsset[]);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [offerId, supabase]);

  const handleBuyerCompanyChange = async (companyId: string) => {
    setSelectedBuyerCompanyId(companyId);
    setRequestedMediaAssetId('');
    const mediaRes = await getApprovedCompanyMediaAssetsAction(companyId);
    if (mediaRes.success) {
      setApprovedMediaAssets(mediaRes.mediaAssets as MediaAsset[]);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuyerCompanyId) return;

    setSubmitting(true);
    setError(null);

    // Validação local imediata de auto-compra
    if (selectedBuyerCompanyId === offer.company_id) {
      setError('Você não pode solicitar veiculação em uma oferta da própria empresa.');
      setSubmitting(false);
      return;
    }

    const res = await createMarketplaceRequestAction({
      offer_id: offerId,
      buyer_company_id: selectedBuyerCompanyId,
      request_message: requestMessage || undefined,
      requested_start_date: requestedStartDate || undefined,
      requested_end_date: requestedEndDate || undefined,
      requested_media_asset_id: requestedMediaAssetId || undefined,
    });

    if (!res.success) {
      setError(res.error || 'Erro ao enviar solicitação de veiculação.');
      setSubmitting(false);
      return;
    }

    router.push('/media-requests');
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
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
        <Link
          href={`/marketplace/${offerId}`}
          className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Solicitar Veiculação de Mídia</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Plano selecionado: <strong className="text-purple-400">{offer?.title}</strong> ({offer?.company?.trade_name})
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Trava visual se for a própria empresa */}
      {selectedBuyerCompanyId === offer?.company_id && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>Você não pode solicitar veiculação em uma oferta da própria empresa. Selecione outra empresa no menu.</span>
        </div>
      )}

      <form onSubmit={handleSubmitRequest} className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5 shadow-xl text-xs">
          {userCompanies.length > 1 && (
            <div>
              <label className="block font-medium text-slate-300 mb-1">Sua Empresa Anunciante (Compradora) *</label>
              <select
                value={selectedBuyerCompanyId}
                onChange={(e) => handleBuyerCompanyChange(e.target.value)}
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

          {/* Seletor de Mídias Aprovadas da Empresa Compradora */}
          <div>
            <label className="block font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-purple-400" /> Mídia Aprovada para Veicular (Opcional)
            </label>
            <select
              value={requestedMediaAssetId}
              onChange={(e) => setRequestedMediaAssetId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500 text-sm"
            >
              <option value="">Selecionar Mídia Posteriormente</option>
              {approvedMediaAssets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.media_type.toUpperCase()} - {m.playback_duration_seconds}s)
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">Apenas mídias da sua empresa com status APROVADO são listadas.</p>
          </div>

          {/* Período Desejado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-sky-400" /> Data Inicial Desejada
              </label>
              <input
                type="date"
                value={requestedStartDate}
                onChange={(e) => setRequestedStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-sky-400" /> Data Final Desejada
              </label>
              <input
                type="date"
                value={requestedEndDate}
                onChange={(e) => setRequestedEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500 text-sm font-mono"
              />
            </div>
          </div>

          {/* Mensagem Comercial */}
          <div>
            <label className="block font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-400" /> Mensagem para a Empresa Exibidora
            </label>
            <textarea
              rows={4}
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Ex: Olá! Gostaria de veicular nossa mídia de lançamento durante o mês que vem nas suas telas da recepção."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Resumo Transacional Congelado */}
        <div className="bg-slate-900 border border-purple-500/30 p-4 rounded-2xl flex justify-between items-center text-xs font-mono">
          <div>
            <span className="text-slate-400 block text-[10px]">VALOR CONGELADO DO PEDIDO</span>
            <strong className="text-lg font-extrabold text-white">
              R$ {(offer?.price_cents / 100).toFixed(2)}
            </strong>
          </div>
          <div>
            <span className="text-amber-400 block text-[10px] text-right">CRÉDITOS COMPRADOS</span>
            <strong className="text-lg font-extrabold text-amber-400">{offer?.credits_amount} CR</strong>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href={`/marketplace/${offerId}`}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting || selectedBuyerCompanyId === offer?.company_id}
            className="px-8 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar Solicitação
          </button>
        </div>
      </form>
    </div>
  );
}
