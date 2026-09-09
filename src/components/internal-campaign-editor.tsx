'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  activateCampaignAction,
  addCampaignMediaAction,
  addCampaignScreenAction,
  archiveCampaignAction,
  getCampaignDeliveryReportAction,
  getCampaignDetailsAction,
  pauseCampaignAction,
  removeCampaignMediaAction,
  removeCampaignScreenAction,
  updateCampaignAction,
} from '@/app/actions/campaigns';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  Plus,
  Save,
  Trash2,
  Tv,
} from 'lucide-react';

type Duration = number;

export default function InternalCampaignEditor({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<any>(null);
  const [mediaLinks, setMediaLinks] = useState<any[]>([]);
  const [screenLinks, setScreenLinks] = useState<any[]>([]);
  const [approvedMedia, setApprovedMedia] = useState<any[]>([]);
  const [availableScreens, setAvailableScreens] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetInsertions, setTargetInsertions] = useState('');
  const [selectedMediaId, setSelectedMediaId] = useState('');
  const [selectedScreenId, setSelectedScreenId] = useState('');
  const [duration, setDuration] = useState<Duration>(10);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [details, delivery] = await Promise.all([
      getCampaignDetailsAction(campaignId),
      getCampaignDeliveryReportAction(campaignId),
    ]);

    if (!details.success || !details.campaign) {
      setError(details.error || 'Campanha interna não encontrada.');
      setLoading(false);
      return;
    }

    const currentCampaign = details.campaign as any;
    setCampaign(currentCampaign);
    setMediaLinks(details.campaignMedia || []);
    setScreenLinks(details.campaignScreens || []);
    setApprovedMedia(details.approvedMedia || []);
    setAvailableScreens(details.availableScreens || []);
    setReport(delivery.success ? delivery.report : null);
    setName(currentCampaign.name || '');
    setDescription(currentCampaign.description || '');
    setStartDate(currentCampaign.start_date || '');
    setEndDate(currentCampaign.end_date || '');
    setTargetInsertions(currentCampaign.target_insertions?.toString() || '');
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runAction = async (action: () => Promise<any>, successMessage: string) => {
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await action();
      if (!result.success) {
        setError(result.error || 'Não foi possível concluir a operação.');
        return;
      }
      setSuccess(successMessage);
      await loadData();
    } catch (actionError: any) {
      setError(actionError?.message || 'Não foi possível concluir a operação.');
    } finally {
      setWorking(false);
    }
  };

  const saveCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (startDate && endDate && endDate < startDate) {
      setError('A data de término não pode ser anterior à data de início.');
      return;
    }
    await runAction(
      () => updateCampaignAction(campaignId, {
        name,
        description: description || null,
        start_date: startDate || null,
        end_date: endDate || null,
        target_insertions: targetInsertions ? Number(targetInsertions) : null,
      }),
      'Dados da campanha salvos.',
    );
  };

  const addMedia = async () => {
    if (!selectedMediaId) return setError('Selecione uma mídia aprovada.');
    await runAction(
      () => addCampaignMediaAction(campaignId, selectedMediaId, duration),
      'Mídia adicionada à campanha.',
    );
    setSelectedMediaId('');
  };

  const addScreen = async () => {
    if (!selectedScreenId) return setError('Selecione uma TV.');
    await runAction(
      () => addCampaignScreenAction(campaignId, selectedScreenId),
      'TV adicionada à campanha.',
    );
    setSelectedScreenId('');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-sky-400" /></div>;
  }

  if (!campaign) {
    return <div className="text-center py-16 text-rose-400">{error || 'Campanha indisponível.'}</div>;
  }

  const linkedMediaIds = new Set(mediaLinks.map((link) => link.media_asset_id));
  const linkedScreenIds = new Set(screenLinks.map((link) => link.screen_id));
  const mediaOptions = approvedMedia.filter((media) => !linkedMediaIds.has(media.id));
  const screenOptions = availableScreens.filter((screen) => !linkedScreenIds.has(screen.id));
  const isFinal = ['completed', 'cancelled', 'archived'].includes(campaign.status);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <Link href="/campaigns" className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">Minha Campanha</span>
              <span className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-slate-800 text-slate-300">{campaign.status}</span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">{campaign.name}</h1>
            <p className="text-xs text-slate-400">A propaganda roda no mesmo endereço <strong className="text-sky-400">/tv</strong> após a campanha ser ativada.</p>
          </div>
        </div>

        <div className="flex gap-2">
          {campaign.status === 'active' ? (
            <button disabled={working} onClick={() => runAction(() => pauseCampaignAction(campaignId), 'Campanha pausada.')} className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50">
              <Pause className="w-4 h-4" /> Pausar
            </button>
          ) : !isFinal ? (
            <button disabled={working} onClick={() => runAction(() => activateCampaignAction(campaignId), 'Campanha ativada e liberada para as TVs vinculadas.')} className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50">
              <Play className="w-4 h-4" /> Ativar Campanha
            </button>
          ) : null}
        </div>
      </div>

      {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex gap-3"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
      {success && <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" />{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={saveCampaign} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
          <h2 className="font-bold text-white text-base border-b border-slate-800 pb-3">Dados da Campanha</h2>
          <label className="block text-slate-300">Nome
            <input required value={name} onChange={(e) => setName(e.target.value)} disabled={isFinal} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white disabled:opacity-50" />
          </label>
          <label className="block text-slate-300">Descrição
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isFinal} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white disabled:opacity-50" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-slate-300">Início<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isFinal} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white" /></label>
            <label className="text-slate-300">Término<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isFinal} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white" /></label>
          </div>
          <label className="block text-slate-300">Meta de inserções
            <input type="number" min="1" value={targetInsertions} onChange={(e) => setTargetInsertions(e.target.value)} disabled={isFinal} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white" />
          </label>
          <button type="submit" disabled={working || isFinal} className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 disabled:opacity-50">
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Alterações
          </button>
        </form>

        <div className="lg:col-span-2 space-y-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div><h2 className="font-bold text-white">Mídias da Campanha ({mediaLinks.length})</h2><p className="text-xs text-slate-400">Somente mídias aprovadas podem ser exibidas.</p></div>
              <ImageIcon className="w-5 h-5 text-purple-400" />
            </div>
            {!isFinal && <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
              <select value={selectedMediaId} onChange={(e) => { const id = e.target.value; setSelectedMediaId(id); const media = mediaOptions.find((item) => item.id === id); if (media) setDuration(Number(media.playback_duration_seconds)); }} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"><option value="">Selecione uma mídia...</option>{mediaOptions.map((media) => <option key={media.id} value={media.id}>{media.title}{media.owner_only ? ' (uso interno)' : ''}</option>)}</select>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value) as Duration)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">{Array.from(new Set([5, 10, 15, 30, duration])).sort((a, b) => a - b).map((value) => <option key={value} value={value}>{value}s</option>)}</select>
              <button type="button" onClick={addMedia} disabled={working || !selectedMediaId} className="px-4 py-2.5 bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-50"><Plus className="w-4 h-4" /> Adicionar</button>
            </div>}
            {mediaLinks.length === 0 ? <p className="text-xs text-amber-400 py-4">Adicione ao menos uma mídia aprovada para ativar a campanha.</p> : mediaLinks.map((link) => <div key={link.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3"><div><strong className="text-white text-sm">{link.media_assets?.title || 'Mídia'}</strong><p className="text-[10px] text-slate-400">{link.playback_duration_seconds}s · {link.media_assets?.media_type}</p></div>{!isFinal && <button onClick={() => runAction(() => removeCampaignMediaAction(campaignId, link.media_asset_id), 'Mídia removida.')} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>}</div>)}
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div><h2 className="font-bold text-white">Minhas TVs participantes ({screenLinks.length})</h2><p className="text-xs text-slate-400">Escolha em quais TVs da sua empresa esta campanha será exibida.</p></div>
              <Tv className="w-5 h-5 text-sky-400" />
            </div>
            {!isFinal && <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2"><select value={selectedScreenId} onChange={(e) => setSelectedScreenId(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"><option value="">Selecione uma TV...</option>{screenOptions.map((screen) => <option key={screen.id} value={screen.id}>{screen.name} ({screen.status})</option>)}</select><button type="button" onClick={addScreen} disabled={working || !selectedScreenId} className="px-4 py-2.5 bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-50"><Plus className="w-4 h-4" /> Adicionar</button></div>}
            {screenLinks.length === 0 ? <p className="text-xs text-amber-400 py-4">Adicione ao menos uma TV para ativar a campanha.</p> : screenLinks.map((link) => <div key={link.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3"><div><strong className="text-white text-sm">{link.screens?.name || 'TV'}</strong><p className="text-[10px] text-slate-400">{link.screens?.status} · {link.screens?.orientation}</p></div>{!isFinal && <button onClick={() => runAction(() => removeCampaignScreenAction(campaignId, link.screen_id), 'TV removida.')} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>}</div>)}
          </section>

          {/* Card Marketplace */}
          <div className="bg-slate-900 border border-sky-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <strong className="text-white text-sm font-bold block">Quer anunciar em outras TVs?</strong>
              <p className="text-xs text-slate-400 mt-0.5">
                Você pode contratar espaço em TVs de outras empresas e parceiros pelo Marketplace.
              </p>
            </div>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition shrink-0 shadow-md shadow-sky-500/20"
            >
              ENCONTRAR TVs NO MARKETPLACE
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[['Concluídas', report?.totalCompleted || 0], ['Falhas', report?.totalFailed || 0], ['Progresso', `${report?.completionPercentage || 0}%`], ['Última exibição', report?.lastPlayedAt ? new Date(report.lastPlayedAt).toLocaleString('pt-BR') : 'Nenhuma']].map(([label, value]) => <div key={String(label)} className="bg-slate-900 border border-slate-800 rounded-xl p-4"><span className="text-[10px] uppercase text-slate-500">{label}</span><strong className="block text-white mt-1 text-sm">{value}</strong></div>)}
      </div>

      {!isFinal && <button disabled={working} onClick={() => runAction(() => archiveCampaignAction(campaignId), 'Campanha arquivada.')} className="text-xs text-slate-500 hover:text-rose-400">Arquivar campanha</button>}
    </div>
  );
}
