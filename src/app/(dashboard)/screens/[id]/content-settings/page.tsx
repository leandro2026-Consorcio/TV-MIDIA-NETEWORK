'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Info,
  LayoutList,
  Loader2,
  Megaphone,
  Newspaper,
  Save,
  Sparkles,
  Tv,
} from 'lucide-react';
import {
  getScreenContentSettingsAction,
  saveScreenContentSettingsAction,
} from '@/app/actions/informative-content';
import { getContentCategoriesAction } from '@/app/actions/content-categories';

export default function ScreenContentSettingsPage() {
  const screenId = useParams().id as string;
  const [screen, setScreen] = useState<any>(null);
  const [officialCategories, setOfficialCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<any>(null);
  const [enabled, setEnabled] = useState(false);
  const [manual, setManual] = useState(true);
  const [rss, setRss] = useState(true);
  const [mixMode, setMixMode] = useState<'ads_first' | 'content_first'>('ads_first');
  const [interval, setInterval] = useState<number>(4);
  const [duration, setDuration] = useState(10);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      const [settingsRes, categoriesRes] = await Promise.all([
        getScreenContentSettingsAction(screenId),
        getContentCategoriesAction(true),
      ]);

      if (categoriesRes.success) {
        setOfficialCategories(categoriesRes.categories);
      }

      if (!settingsRes.success) {
        setError(settingsRes.error || 'Falha ao carregar configuração.');
      } else {
        setScreen(settingsRes.screen);
        const settings = settingsRes.settings;
        if (settings) {
          setEnabled(settings.enable_breathing_content);
          setManual(settings.enable_manual_content);
          setRss(settings.enable_rss_content);
          setMixMode(settings.content_mix_mode === 'content_first' ? 'content_first' : 'ads_first');
          setInterval(settings.mix_interval || settings.ads_between_content || 4);
          setDuration(settings.content_duration_seconds);
          setSelectedSlugs(settings.allowed_categories || []);
        }
      }
      setLoading(false);
    })();
  }, [screenId]);

  const toggleCategory = (slug: string) => {
    if (selectedSlugs.includes(slug)) {
      setSelectedSlugs(selectedSlugs.filter((s) => s !== slug));
    } else {
      setSelectedSlugs([...selectedSlugs, slug]);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccessData(null);

    const result = await saveScreenContentSettingsAction({
      screenId,
      enableBreathingContent: enabled,
      enableManualContent: manual,
      enableRssContent: rss,
      contentMixMode: mixMode,
      mixInterval: interval,
      adsBetweenContent: interval,
      contentDurationSeconds: duration,
      allowedCategories: selectedSlugs,
      fallbackToAds: true,
    });

    if (!result.success) {
      setError(result.error || 'Falha ao salvar configuração.');
    } else {
      setSuccessData({
        mixMode,
        interval,
        duration,
        enabled,
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  // Gera a prévia da sequência visual
  const previewItems = [];
  if (mixMode === 'ads_first') {
    for (let i = 1; i <= interval; i++) {
      previewItems.push({ type: 'ad', label: `Propaganda ${i}` });
    }
    previewItems.push({ type: 'content', label: 'Notícia / Informação' });
  } else {
    for (let i = 1; i <= interval; i++) {
      previewItems.push({ type: 'content', label: `Notícia ${i}` });
    }
    previewItems.push({ type: 'ad', label: 'Propaganda' });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Header com Navegação e Sub-passo */}
      <div className="flex items-center gap-4">
        <Link
          href={`/screens/${screenId}`}
          className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block">Passo 3 de 4</span>
          <h1 className="text-2xl font-extrabold text-white">Conteúdo entre propagandas</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Deixe sua TV mais interessante intercalando notícias, curiosidades e informações entre os anúncios.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Alerta de Sucesso com Resumo e Botão de Continuar Configuração */}
      {successData && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-sm text-emerald-200 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5 font-bold text-emerald-300 text-base">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            ✅ Conteúdo entre propagandas configurado
          </div>
          <div className="p-4 rounded-xl bg-slate-950/70 border border-emerald-500/20 space-y-1.5 text-xs">
            <p className="text-slate-200">
              <strong>Alternância:</strong>{' '}
              {successData.mixMode === 'ads_first'
                ? `${successData.interval} propagandas → 1 conteúdo informativo`
                : `${successData.interval} conteúdos informativos → 1 propaganda`}
            </p>
            <p className="text-slate-200">
              <strong>Duração dos cards:</strong> {successData.duration} segundos
            </p>
            <p className="text-slate-400 text-[11px] pt-1">
              {successData.enabled
                ? 'A TV já atualizará a exibição na próxima sincronização.'
                : 'Conteúdo informativo pausado para esta TV.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              href="/company/invites"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20"
            >
              CONTINUAR CONFIGURAÇÃO (CONVITES VIP) <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/screens/${screenId}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition"
            >
              Voltar para a TV
            </Link>
          </div>
        </div>
      )}

      {/* Card Educativo */}
      <div className="flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 text-xs text-sky-200 leading-relaxed shadow-sm">
        <Info className="h-5 w-5 shrink-0 text-sky-400 mt-0.5" />
        <div className="space-y-1">
          <p>
            Esses conteúdos aparecem entre suas propagandas para deixar a TV mais dinâmica e atrativa.
            Eles <strong>não consomem seus Créditos MPM</strong> nem geram qualquer cobrança adicional.
          </p>
          <p className="text-sky-300/80 text-[11px]">
            Se nenhum item estiver disponível na categoria selecionada, a programação exibe normalmente apenas as propagandas.
          </p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-xl">
        {/* Ativação geral */}
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 cursor-pointer hover:border-slate-700 transition">
          <div>
            <strong className="block text-base text-white">Ativar conteúdo entre propagandas nesta TV</strong>
            <span className="text-xs text-slate-400">Intercala notícias, curiosidades e dicas para prender a atenção do público no seu local.</span>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-6 w-6 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
          />
        </label>

        <div className={enabled ? 'space-y-6' : 'pointer-events-none space-y-6 opacity-40'}>
          {/* Fontes de conteúdo & Link para Gerenciar Fontes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Fontes de conteúdo</label>
              <Link
                href="/company/content-sources"
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition"
              >
                Gerenciar fontes e RSS <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={manual}
                  onChange={(e) => setManual(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                />
                <Megaphone className="h-4 w-4 text-sky-400" /> Conteúdos manuais aprovados
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={rss}
                  onChange={(e) => setRss(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                />
                <Newspaper className="h-4 w-4 text-purple-400" /> Notícias de sites e portais
              </label>
            </div>
          </div>

          {/* Categorias com Dica Contextual por Segmento */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Categorias de Assunto</label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Escolha somente assuntos que façam sentido para o público deste local (ex: Clínica: Saúde, Frases; Loja agro: Agronegócio, Economia).
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {selectedSlugs.length === 0 ? 'Todas ativas' : `${selectedSlugs.length} selecionada(s)`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <button
                type="button"
                onClick={() => setSelectedSlugs([])}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-semibold transition ${
                  selectedSlugs.length === 0
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800/80 bg-slate-900/50 text-slate-400 hover:text-white'
                }`}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${selectedSlugs.length === 0 ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-700'}`}>
                  {selectedSlugs.length === 0 ? '✓' : ''}
                </span>
                <span>Todas as categorias</span>
              </button>

              {officialCategories.map((cat) => {
                const isChecked = selectedSlugs.includes(cat.slug) || selectedSlugs.includes(cat.name);
                return (
                  <label
                    key={cat.id}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs font-semibold cursor-pointer transition ${
                      isChecked
                        ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                        : 'border-slate-800/80 bg-slate-900/50 text-slate-400 hover:text-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCategory(cat.slug)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500"
                    />
                    <span>{cat.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Tipo de Programação (Foco em Publicidade vs Foco em Informação) */}
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Objetivo da Programação</label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label
                className={`flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition ${
                  mixMode === 'ads_first'
                    ? 'border-sky-500 bg-sky-500/10 text-white ring-1 ring-sky-500'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="radio"
                    name="mixMode"
                    value="ads_first"
                    checked={mixMode === 'ads_first'}
                    onChange={() => setMixMode('ads_first')}
                    className="h-4 w-4 text-sky-500"
                  />
                  <strong className="text-sm font-bold text-white">Foco em publicidade</strong>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Exibe mais anúncios e usa conteúdos informativos apenas para dar variedade à programação.
                </p>
              </label>

              <label
                className={`flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition ${
                  mixMode === 'content_first'
                    ? 'border-purple-500 bg-purple-500/10 text-white ring-1 ring-purple-500'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="radio"
                    name="mixMode"
                    value="content_first"
                    checked={mixMode === 'content_first'}
                    onChange={() => setMixMode('content_first')}
                    className="h-4 w-4 text-purple-500"
                  />
                  <strong className="text-sm font-bold text-white">Foco em informação</strong>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Exibe mais notícias e conteúdos informativos, intercalando anúncios comerciais entre eles.
                </p>
              </label>
            </div>

            {/* Frequência de exibição */}
            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <label className="text-xs font-semibold text-slate-300">
                Frequência de alternância
                <select
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value={1}>{mixMode === 'ads_first' ? 'A cada 1 propaganda → 1 conteúdo' : 'A cada 1 conteúdo → 1 propaganda'}</option>
                  <option value={2}>{mixMode === 'ads_first' ? 'A cada 2 propagandas → 1 conteúdo' : 'A cada 2 conteúdos → 1 propaganda'}</option>
                  <option value={3}>{mixMode === 'ads_first' ? 'A cada 3 propagandas → 1 conteúdo' : 'A cada 3 conteúdos → 1 propaganda'}</option>
                  <option value={4}>{mixMode === 'ads_first' ? 'A cada 4 propagandas → 1 conteúdo' : 'A cada 4 conteúdos → 1 propaganda'}</option>
                  <option value={5}>{mixMode === 'ads_first' ? 'A cada 5 propagandas → 1 conteúdo' : 'A cada 5 conteúdos → 1 propaganda'}</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-300">
                Duração do card informativo
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value={8}>8 segundos</option>
                  <option value={10}>10 segundos (padrão)</option>
                  <option value={12}>12 segundos</option>
                  <option value={15}>15 segundos</option>
                </select>
              </label>
            </div>

            {/* Prévia visual dinâmica */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <LayoutList className="h-3.5 w-3.5 text-sky-400" /> Sequência na TV
              </span>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {previewItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        item.type === 'ad'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {item.label}
                    </span>
                    {idx < previewItems.length - 1 && <span className="text-slate-600 text-xs">→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-800 pt-5">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-600 disabled:opacity-50 transition"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar configuração
          </button>
        </div>
      </form>
    </div>
  );
}