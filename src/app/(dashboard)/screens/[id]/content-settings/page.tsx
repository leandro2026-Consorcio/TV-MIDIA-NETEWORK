'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Info, Loader2, Save, Sparkles } from 'lucide-react';
import { getScreenContentSettingsAction, saveScreenContentSettingsAction } from '@/app/actions/informative-content';

export default function ScreenContentSettingsPage() {
  const screenId = useParams().id as string;
  const [screen, setScreen] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [manual, setManual] = useState(true);
  const [rss, setRss] = useState(true);
  const [frequency, setFrequency] = useState<3 | 4 | 5>(4);
  const [duration, setDuration] = useState(10);
  const [categories, setCategories] = useState('');

  useEffect(() => {
    void (async () => {
      const result = await getScreenContentSettingsAction(screenId);
      if (!result.success) setError(result.error || 'Falha ao carregar configuração.');
      else {
        setScreen(result.screen);
        const settings = result.settings;
        if (settings) {
          setEnabled(settings.enable_breathing_content);
          setManual(settings.enable_manual_content);
          setRss(settings.enable_rss_content);
          setFrequency(settings.ads_between_content);
          setDuration(settings.content_duration_seconds);
          setCategories((settings.allowed_categories || []).join(', '));
        }
      }
      setLoading(false);
    })();
  }, [screenId]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    const result = await saveScreenContentSettingsAction({
      screenId,
      enableBreathingContent: enabled,
      enableManualContent: manual,
      enableRssContent: rss,
      adsBetweenContent: frequency,
      contentDurationSeconds: duration,
      allowedCategories: categories.split(',').map((value) => value.trim()).filter(Boolean),
      fallbackToAds: true,
    });
    if (!result.success) setError(result.error || 'Falha ao salvar configuração.');
    else setSuccess('Configuração salva. A TV receberá a nova fila na próxima atualização segura.');
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center gap-4 border-b border-slate-800 pb-5"><Link href={`/screens/${screenId}`} className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link><div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Sparkles className="h-6 w-6 text-sky-400" /> Conteúdo de Respiro</h1><p className="text-xs text-slate-400">{screen?.name || 'TV'} • {screen?.companies?.trade_name}</p></div></header>
      {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">{error}</div>}
      {success && <div className="flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400"><CheckCircle2 className="h-5 w-5" />{success}</div>}
      <div className="flex gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs leading-relaxed text-sky-200"><Info className="h-5 w-5 shrink-0" /><p>Este conteúdo é apenas informativo. Não consome créditos, não gera payout e não entra no Proof of Play comercial. Se nenhum item estiver disponível, a programação segue somente com anúncios.</p></div>
      <form onSubmit={save} className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4"><div><strong className="block text-sm text-white">Ativar conteúdo de respiro</strong><span className="text-xs text-slate-500">Intercala cards informativos entre as propagandas.</span></div><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5" /></label>
        <div className={enabled ? 'space-y-5' : 'pointer-events-none space-y-5 opacity-45'}>
          <div className="grid gap-4 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Conteúdo manual</label><label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200"><input type="checkbox" checked={rss} onChange={(e) => setRss(e.target.checked)} /> Notícias RSS aprovadas</label></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-300">Frequência<select value={frequency} onChange={(e) => setFrequency(Number(e.target.value) as 3 | 4 | 5)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"><option value={3}>A cada 3 propagandas</option><option value={4}>A cada 4 propagandas</option><option value={5}>A cada 5 propagandas</option></select></label><label className="text-xs font-semibold text-slate-300">Duração do card<select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"><option value={8}>8 segundos</option><option value={10}>10 segundos</option><option value={12}>12 segundos</option><option value={15}>15 segundos</option></select></label></div>
          <label className="block text-xs font-semibold text-slate-300">Categorias permitidas<input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="Saúde, Educação, Agro (vazio permite todas)" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white" /><span className="mt-1 block font-normal text-slate-500">Separe categorias por vírgula. A correspondência não diferencia maiúsculas/minúsculas.</span></label>
        </div>
        <div className="flex justify-end border-t border-slate-800 pt-5"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar configuração</button></div>
      </form>
    </div>
  );
}
