'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import InternalCampaignEditor from '@/components/internal-campaign-editor';
import { getCampaignDetailsAction } from '@/app/actions/campaigns';
import { 
  getCommercialCampaignDetailsAction, 
  processCommercialCampaignDeliveryAction 
} from '@/app/actions/commercial-campaigns';
import { Megaphone, ArrowLeft, Building2, Tv, Image as ImageIcon, Play, CheckCircle2, AlertCircle, Loader2, RefreshCw, Layers } from 'lucide-react';

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<any>(null);
  const [campaignMedia, setCampaignMedia] = useState<any[]>([]);
  const [campaignScreens, setCampaignScreens] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any>(null);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadCampaignData = async () => {
    try {
      setLoading(true);
      setError(null);
      const base = await getCampaignDetailsAction(campaignId);
      if (!base.success || !base.campaign) {
        setError(base.error || 'Campanha não encontrada.');
        return;
      }

      if (base.campaign.campaign_type === 'internal') {
        setCampaign(base.campaign);
        setCampaignMedia(base.campaignMedia || []);
        setCampaignScreens(base.campaignScreens || []);
        return;
      }

      const res = await getCommercialCampaignDetailsAction(campaignId);
      if (!res.success || !res.campaign) {
        setError(res.error || 'Campanha não encontrada.');
        return;
      }

      setCampaign(res.campaign);
      setCampaignMedia(res.campaignMedia || []);
      setCampaignScreens(res.campaignScreens || []);
      setLedger(res.ledger);
      setUsageHistory(res.usageHistory || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaignData();
  }, [campaignId]);

  const handleProcessDelivery = async () => {
    setProcessing(true);
    setError(null);
    setSuccess(null);

    const res = await processCommercialCampaignDeliveryAction(campaignId);
    if (!res.success) {
      setError(res.error || 'Erro ao processar entregas da campanha.');
    } else {
      if (res.result?.processed_logs_count > 0) {
        setSuccess(`Sucesso! ${res.result.processed_logs_count} exibição(ões) comprovada(s) processada(s). Total entregue: ${res.result.total_credits_delivered} CR.`);
      } else {
        setSuccess('Nenhuma nova exibição comprovada pendente de processamento no momento.');
      }
      await loadCampaignData();
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center justify-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || 'Campanha indisponível.'}</span>
        </div>
        <Link href="/campaigns" className="inline-block text-xs font-bold text-purple-400 hover:underline">
          &larr; Voltar para Lista de Campanhas
        </Link>
      </div>
    );
  }

  if (campaign.campaign_type === 'internal') {
    return <InternalCampaignEditor campaignId={campaignId} />;
  }

  const isCommercial = campaign.campaign_type === 'marketplace' || campaign.campaign_type === 'commercial';
  const contracted = ledger?.credits_contracted || campaign.credits_contracted || 0;
  const delivered = ledger?.credits_delivered || campaign.credits_delivered || 0;
  const remaining = ledger?.credits_remaining || Math.max(0, contracted - delivered);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <Link
            href="/campaigns"
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {campaign.campaign_type}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                  campaign.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {campaign.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">{campaign.name}</h1>
          </div>
        </div>

        {isCommercial && (
          <button
            onClick={handleProcessDelivery}
            disabled={processing || remaining <= 0}
            className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Processar Entregas
          </button>
        )}
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

      {/* Painel de Métricas de Entrega Comercial */}
      {isCommercial && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              CRÉDITOS CONTRATADOS
            </span>
            <div className="text-3xl font-extrabold text-white mt-1 font-mono">{contracted} CR</div>
            <p className="text-xs text-slate-500 mt-1">Saldo do pedido pago no marketplace</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              CRÉDITOS ENTREGUES
            </span>
            <div className="text-3xl font-extrabold text-emerald-400 mt-1 font-mono">{delivered} CR</div>
            <p className="text-xs text-slate-500 mt-1">Comprovados via Proof of Play</p>
          </div>

          <div className="bg-slate-900 border border-purple-500/30 p-6 rounded-2xl">
            <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider block font-mono">
              SALDO RESTANTE
            </span>
            <div className="text-3xl font-extrabold text-amber-400 mt-1 font-mono">{remaining} CR</div>
            <p className="text-xs text-slate-500 mt-1">
              {remaining <= 0 ? 'Entrega concluída!' : 'Pendente de veiculação'}
            </p>
          </div>
        </div>
      )}

      {/* Detalhes da Campanha */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" /> Empresas Envolvidas
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 block">Empresa Anunciante (Compradora)</span>
              <strong className="text-white text-sm">{campaign.buyer?.trade_name || 'Compradora'}</strong>
            </div>

            <div>
              <span className="text-slate-500 block">Empresa Exibidora (Vendedora)</span>
              <strong className="text-purple-400 text-sm">{campaign.seller?.trade_name || 'Exibidora'}</strong>
            </div>

            <div>
              <span className="text-slate-500 block">Período Contratado</span>
              <strong className="text-slate-300 font-mono">
                {campaign.start_date || 'Imediato'} a {campaign.end_date || 'A definir'}
              </strong>
            </div>
          </div>
        </div>

        {/* Mídias e Telas */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" /> Ativos Vinculados
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 block mb-1 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-purple-400" /> Mídia da Compradora ({campaignMedia.length}):
              </span>
              {campaignMedia.map((m) => (
                <span key={m.id} className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-200 font-semibold block mt-1">
                  {m.media?.title || 'Mídia Solicitada'} ({m.playback_duration_seconds}s)
                </span>
              ))}
            </div>

            <div>
              <span className="text-slate-500 block mb-1 flex items-center gap-1">
                <Tv className="w-3.5 h-3.5 text-sky-400" /> Telas da Exibidora ({campaignScreens.length}):
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {campaignScreens.map((s) => (
                  <span key={s.id} className="bg-slate-950 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-md font-mono text-[11px]">
                    {s.screen?.name || 'Tela'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Histórico de Entregas (ad_order_delivery_usage) */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <Play className="w-5 h-5 text-purple-400" /> Histórico de Proof of Play (Entregas Auditadas)
        </h3>

        {usageHistory.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">Nenhuma exibição comprovada processada para esta campanha ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Data / Hora Exibição</th>
                  <th className="py-3 px-4">Tela Exibidora</th>
                  <th className="py-3 px-4 font-mono">Créditos Abatidos</th>
                  <th className="py-3 px-4 font-mono">Log ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {usageHistory.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 text-slate-300 font-sans">
                      {new Date(u.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-sans text-purple-300">
                      {u.screen?.name || 'Tela Exibidora'}
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">
                      {u.credits_used} CR
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[10px]">
                      {u.playback_log_id}
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
