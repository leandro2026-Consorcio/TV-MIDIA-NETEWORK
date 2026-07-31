'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CompanyAdOffer } from '@/types';
import { getMarketplaceOfferDetailsAction } from '@/app/actions/marketplace';
import { ArrowLeft, MapPin, Building2, Tag, Clock, Send, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function MarketplaceOfferDetailPage() {
  const params = useParams();
  const offerId = params.id as string;

  const [offer, setOffer] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadDetails() {
      try {
        setLoading(true);
        const res = await getMarketplaceOfferDetailsAction(offerId);
        if (!res.success || !res.offer) {
          setError(res.error || 'Oferta de mídia não encontrada.');
          return;
        }

        setOffer(res.offer);
        setSegments(res.segments || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDetails();
  }, [offerId, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center justify-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || 'Oferta indisponível.'}</span>
        </div>
        <Link href="/marketplace" className="inline-block text-xs font-bold text-purple-400 hover:underline">
          &larr; Voltar para o Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Bar */}
      <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
        <Link
          href="/marketplace"
          className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block">
            Detalhes do Plano Comercial
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">{offer.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Coluna Principal: Informações Comerciais */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
            <h2 className="font-bold text-white text-base border-b border-slate-800 pb-3">Descrição da Oferta</h2>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
              {offer.description || 'Nenhuma descrição complementar fornecida pela empresa exibidora.'}
            </p>
          </div>

          {/* Dados da Empresa Exibidora */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
            <h2 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" /> Perfil Comercial da Empresa Exibidora
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Nome Fantasia</span>
                <strong className="text-white text-sm">{offer.company?.trade_name}</strong>
              </div>

              <div>
                <span className="text-slate-500 block">Localidade / Cidade</span>
                <strong className="text-slate-200 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-purple-400" /> {offer.company?.city || 'Não informada'} - {offer.company?.state || ''}
                </strong>
              </div>

              {segments.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block mb-1">Segmentos de Atuação</span>
                  <div className="flex flex-wrap gap-1.5">
                    {segments.map((s: any) => (
                      <span
                        key={s.segment_id}
                        className="bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-md text-[11px] font-medium"
                      >
                        {s.segment?.name || 'Segmento'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Lateral: Resumo de Preço e Solicitação */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-purple-500/30 p-6 rounded-2xl space-y-6 shadow-xl sticky top-6">
            <div className="space-y-1 text-center font-mono">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">VALOR DO PLANO</span>
              <strong className="text-3xl font-extrabold text-white">
                R$ {(offer.price_cents / 100).toFixed(2)}
              </strong>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-400" /> Créditos Incluídos:
                </span>
                <strong className="text-amber-400 font-mono">{offer.credits_amount} CR</strong>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-400" /> Duração Recomendada:
                </span>
                <strong className="text-slate-200 font-mono">{offer.duration_seconds || 10} Segundos</strong>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Aprovação:
                </span>
                <strong className="text-emerald-400">Exige Aprovação</strong>
              </div>
            </div>

            <Link
              href={`/marketplace/${offer.id}/request`}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
            >
              <Send className="w-4 h-4" /> Solicitar Veiculação
            </Link>

            <p className="text-[11px] text-slate-500 text-center">
              A solicitação enviará uma notificação comercial para a empresa exibidora revisar e aprovar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
