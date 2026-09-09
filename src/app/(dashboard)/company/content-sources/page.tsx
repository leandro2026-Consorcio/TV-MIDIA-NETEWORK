'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Rss,
  Globe,
  Tv,
  Search,
  Plus,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  X,
  Sparkles,
  Send,
  Sliders,
  Radio,
  ArrowRight,
} from 'lucide-react';
import {
  getCompanyContentSourcesAction,
  discoverCompanyRssFeedsAction,
  previewCompanyRssFeedAction,
  addCompanyPrivateSourceAction,
  suggestCompanySourceAction,
  toggleCompanySourceAction,
  saveScreenContentSourcesAction,
} from '@/app/actions/company-content-sources';

type Tab = 'recommended' | 'custom' | 'screens';

export default function CompanyContentSourcesPage() {
  const [tab, setTab] = useState<Tab>('recommended');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data
  const [recommendedSources, setRecommendedSources] = useState<any[]>([]);
  const [mySources, setMySources] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [screens, setScreens] = useState<any[]>([]);

  // Discovery / Add
  const [discoveryUrl, setDiscoveryUrl] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveredFeeds, setDiscoveredFeeds] = useState<Array<{ title: string; url: string; type: string }>>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceCategory, setSourceCategory] = useState('');
  const [submittingSource, setSubmittingSource] = useState(false);

  // Preview Modal
  const [previewing, setPreviewing] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Screen preferences tab
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');
  const [allowedSourceIds, setAllowedSourceIds] = useState<string[]>([]);
  const [savingScreenPrefs, setSavingScreenPrefs] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyContentSourcesAction();
      if (!res.success) {
        setError(res.error || 'Não foi possível carregar as fontes.');
        return;
      }
      setRecommendedSources(res.recommendedSources || []);
      setMySources(res.mySources || []);
      setCategories(res.categories || []);
      setScreens(res.screens || []);

      if (res.screens && res.screens.length > 0) {
        const firstScreen = res.screens[0];
        setSelectedScreenId(firstScreen.id);
        const currentAllowed = firstScreen.screen_content_settings?.[0]?.allowed_source_ids || [];
        setAllowedSourceIds(currentAllowed);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha na conexão ao carregar fontes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleSelectScreen(screenId: string) {
    setSelectedScreenId(screenId);
    const screen = screens.find((s) => s.id === screenId);
    const currentAllowed = screen?.screen_content_settings?.[0]?.allowed_source_ids || [];
    setAllowedSourceIds(currentAllowed);
    setSuccess(null);
  }

  async function handleDiscoverFeeds(e: React.FormEvent) {
    e.preventDefault();
    if (!discoveryUrl) return;
    setDiscovering(true);
    setError(null);
    setDiscoveredFeeds([]);
    try {
      const res = await discoverCompanyRssFeedsAction(discoveryUrl);
      if (!res.success) {
        setError(res.error || 'Nenhum feed RSS encontrado neste site.');
        return;
      }
      if (res.feeds.length === 0) {
        setError('Nenhum feed RSS automático foi localizado no endereço informado. Tente preencher a URL exata no formulário manual.');
      } else {
        setDiscoveredFeeds(res.feeds);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao buscar feeds no site.');
    } finally {
      setDiscovering(false);
    }
  }

  async function handleOpenPreview(title: string, url: string) {
    setPreviewTitle(title);
    setPreviewing(true);
    setPreviewError(null);
    setPreviewItems([]);
    try {
      const res = await previewCompanyRssFeedAction(url);
      if (!res.success) {
        setPreviewError(res.error || 'Não foi possível carregar a prévia deste feed.');
      } else {
        setPreviewItems(res.items || []);
      }
    } catch (err: any) {
      setPreviewError(err?.message || 'Falha ao conectar com o feed.');
    }
  }

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceName.trim() || !sourceUrl.trim()) {
      setError('Preencha o nome e a URL da fonte RSS.');
      return;
    }
    setSubmittingSource(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await addCompanyPrivateSourceAction({
        sourceName: sourceName.trim(),
        sourceUrl: sourceUrl.trim(),
        category: sourceCategory.trim() || undefined,
      });
      if (!res.success) {
        setError(res.error || 'Falha ao adicionar fonte.');
        return;
      }
      setSuccess(`Fonte "${sourceName}" adicionada com sucesso às fontes da sua empresa!`);
      setShowAddForm(false);
      setSourceName('');
      setSourceUrl('');
      setSourceCategory('');
      setDiscoveredFeeds([]);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao salvar fonte.');
    } finally {
      setSubmittingSource(false);
    }
  }

  async function handleSuggestSource(sourceId: string) {
    setError(null);
    setSuccess(null);
    try {
      const res = await suggestCompanySourceAction(sourceId);
      if (!res.success) {
        setError(res.error || 'Falha ao enviar sugestão.');
        return;
      }
      setSuccess('Sua fonte foi sugerida ao Catálogo Geral MPM para análise da curadoria!');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Falha ao sugerir fonte.');
    }
  }

  async function handleToggleSource(sourceId: string, currentStatus: boolean) {
    setError(null);
    try {
      const res = await toggleCompanySourceAction(sourceId, !currentStatus);
      if (!res.success) {
        setError(res.error || 'Falha ao alterar status.');
        return;
      }
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Falha ao alterar status da fonte.');
    }
  }

  async function handleSaveScreenPreferences() {
    if (!selectedScreenId) return;
    setSavingScreenPrefs(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await saveScreenContentSourcesAction(selectedScreenId, allowedSourceIds);
      if (!res.success) {
        setError(res.error || 'Falha ao salvar preferências da TV.');
        return;
      }
      setSuccess('Preferências de fontes de conteúdo salvas com sucesso para esta TV!');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar preferências.');
    } finally {
      setSavingScreenPrefs(false);
    }
  }

  const allAvailableSources = [
    ...recommendedSources.map((s) => ({ ...s, isGlobal: true })),
    ...mySources.map((s) => ({ ...s, isGlobal: false })),
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-purple-500/10 text-purple-400 p-2 rounded-xl border border-purple-500/20">
              <Rss className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">Conteúdo Informativo da Empresa</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Escolha as notícias, previsão do tempo e curiosidades exibidas entre as propagandas nas TVs da sua empresa.
          </p>
        </div>

        <Link
          href="/screens"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <Tv className="w-4 h-4 text-sky-400" /> Ver Minhas TVs
        </Link>
      </div>

      {/* Notifications */}
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

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => { setTab('recommended'); setError(null); setSuccess(null); }}
          className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            tab === 'recommended'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Fontes Recomendadas ({recommendedSources.length})
        </button>

        <button
          type="button"
          onClick={() => { setTab('custom'); setError(null); setSuccess(null); }}
          className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            tab === 'custom'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" /> Minhas Fontes ({mySources.length})
        </button>

        <button
          type="button"
          onClick={() => { setTab('screens'); setError(null); setSuccess(null); }}
          className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            tab === 'screens'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" /> Preferências por TV
        </button>
      </div>

      {/* TAB 1: FONTES RECOMENDADAS */}
      {tab === 'recommended' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-950/30 via-slate-900 to-slate-900 border border-purple-500/20 rounded-2xl p-5 text-xs text-slate-300 leading-relaxed">
            <strong className="text-purple-300 font-bold block text-sm mb-1">Catálogo Oficial de Notícias MPM</strong>
            Fontes verificadas e seguras prontas para enriquecer a tela da sua TV. As notícias são atualizadas automaticamente ao longo do dia e exibidas em intervalos suaves para atrair a atenção do público presente.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendedSources.map((source) => (
              <div
                key={source.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {source.category || 'Geral'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Verificado
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mb-1">{source.source_name}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                    {source.region ? `${source.region} • ` : ''}Atualização automática a cada {source.refresh_interval_minutes || 60} minutos.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(source.source_name, source.source_url)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver últimas notícias
                  </button>

                  <a
                    href={source.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-500 hover:text-slate-300 p-1"
                    title="Abrir URL original"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {recommendedSources.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              Nenhuma fonte recomendada ativa no momento.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MINHAS FONTES */}
      {tab === 'custom' && (
        <div className="space-y-6">
          {/* Quick Discovery Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-1">Descobrir Feeds RSS do seu Portal ou Blog</h2>
            <p className="text-xs text-slate-400 mb-4">
              Informe o endereço do seu site ou jornal local para localizar automaticamente os canais de notícias disponíveis.
            </p>

            <form onSubmit={handleDiscoverFeeds} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="ex: g1.globo.com ou portaldenoticias.com.br"
                  value={discoveryUrl}
                  onChange={(e) => setDiscoveryUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={discovering || !discoveryUrl.trim()}
                className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar Feeds
              </button>

              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold transition"
              >
                {showAddForm ? 'Fechar formulário' : '+ Digitar URL Manual'}
              </button>
            </form>

            {/* Discovered Feeds List */}
            {discoveredFeeds.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                <p className="text-xs font-bold text-emerald-400">
                  {discoveredFeeds.length} feed(s) localizado(s) com sucesso:
                </p>
                <div className="space-y-2">
                  {discoveredFeeds.map((feed, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <strong className="text-white text-xs block truncate">{feed.title}</strong>
                        <span className="text-[11px] text-slate-400 block truncate">{feed.url}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(feed.title, feed.url)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-sky-400 text-xs font-semibold hover:bg-slate-700"
                        >
                          Prévia
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSourceName(feed.title);
                            setSourceUrl(feed.url);
                            setShowAddForm(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-xs font-bold hover:bg-purple-600"
                        >
                          Usar este Feed
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Manual Add Form */}
          {showAddForm && (
            <form onSubmit={handleAddSource} className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Cadastrar Fonte RSS da Minha Empresa</h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">Nome da Fonte *</label>
                  <input
                    required
                    type="text"
                    placeholder="ex: Blog Oficial da Empresa"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 mb-1">URL do Feed RSS *</label>
                  <input
                    required
                    type="url"
                    placeholder="https://meusite.com.br/feed"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="w-full sm:w-64 text-xs">
                  <label className="block text-slate-300 mb-1">Categoria</label>
                  <select
                    value={sourceCategory}
                    onChange={(e) => setSourceCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="">Geral / Sem categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    <option value="Notícias Locais">Notícias Locais</option>
                    <option value="Eventos">Eventos</option>
                    <option value="Gastronomia">Gastronomia</option>
                    <option value="Ofertas & Dicas">Ofertas & Dicas</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    disabled={!sourceUrl.trim()}
                    onClick={() => handleOpenPreview(sourceName || 'Prévia', sourceUrl)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    Testar Feed
                  </button>

                  <button
                    type="submit"
                    disabled={submittingSource || !sourceName.trim() || !sourceUrl.trim()}
                    className="px-5 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"
                  >
                    {submittingSource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Salvar Fonte
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* My Sources List */}
          <div className="space-y-3">
            <h2 className="text-base font-bold text-white">Fontes Cadastradas pela Sua Empresa ({mySources.length})</h2>

            {mySources.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs space-y-2">
                <p>Nenhuma fonte particular cadastrada até o momento.</p>
                <p className="text-slate-500">
                  Use a busca acima para adicionar feeds do seu blog, site institucional ou parceiros da sua região.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mySources.map((source) => (
                  <div
                    key={source.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {source.category || 'Particular'}
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          source.suggested_for_catalog
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {source.suggested_for_catalog ? 'Em análise para o catálogo' : 'Privada da empresa'}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white">{source.source_name}</h3>
                      <p className="text-xs text-slate-400 truncate mt-0.5 mb-3">{source.source_url}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSource(source.id, source.is_active)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                            source.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          {source.is_active ? 'ATIVA' : 'PAUSADA'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenPreview(source.source_name, source.source_url)}
                          className="text-xs font-semibold text-sky-400 hover:text-sky-300 px-2 py-1"
                        >
                          Prévia
                        </button>
                      </div>

                      {!source.suggested_for_catalog && (
                        <button
                          type="button"
                          onClick={() => handleSuggestSource(source.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 px-2 py-1 rounded-lg border border-amber-500/20 bg-amber-500/5 transition"
                          title="Permitir que outras empresas da rede também possam escolher este conteúdo"
                        >
                          <Send className="w-3 h-3" /> Sugerir ao Catálogo Geral
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PREFERÊNCIAS POR TV */}
      {tab === 'screens' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Escolha a TV para configurar</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cada TV pode exibir fontes específicas ou usar todas as recomendadas da rede.
              </p>
            </div>

            {screens.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">Nenhuma TV cadastrada nesta empresa.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {screens.map((screen) => (
                  <button
                    key={screen.id}
                    type="button"
                    onClick={() => handleSelectScreen(screen.id)}
                    className={`p-4 rounded-xl border text-left transition flex items-center justify-between ${
                      selectedScreenId === screen.id
                        ? 'border-purple-500 bg-purple-950/20 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <strong className="block text-xs font-bold">{screen.name}</strong>
                      <span className="text-[10px] text-slate-400">{screen.status} • {screen.orientation}</span>
                    </div>
                    {selectedScreenId === screen.id && (
                      <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedScreenId && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Fontes de Conteúdo Permitidas nesta TV
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Se nenhuma fonte for marcada, a TV utilizará as fontes recomendadas do Catálogo Geral.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllowedSourceIds(allAvailableSources.map((s) => s.id))}
                    className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800"
                  >
                    Marcar todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedSourceIds([])}
                    className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allAvailableSources.map((src) => {
                  const isChecked = allowedSourceIds.includes(src.id);
                  return (
                    <label
                      key={src.id}
                      className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition ${
                        isChecked
                          ? 'border-purple-500/50 bg-purple-950/20 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAllowedSourceIds([...allowedSourceIds, src.id]);
                          } else {
                            setAllowedSourceIds(allowedSourceIds.filter((id) => id !== src.id));
                          }
                        }}
                        className="mt-0.5 rounded border-slate-700 bg-slate-900 text-purple-500 focus:ring-purple-400"
                      />
                      <div className="min-w-0">
                        <strong className="text-xs block truncate text-white">{src.source_name}</strong>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {src.category || 'Geral'} • {src.isGlobal ? 'Catálogo MPM' : 'Minha Fonte'}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
                <Link
                  href={`/screens/${selectedScreenId}/content-settings`}
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold inline-flex items-center gap-1"
                >
                  Abrir configuração completa de respiro desta TV <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={handleSaveScreenPreferences}
                  disabled={savingScreenPrefs}
                  className="w-full sm:w-auto px-6 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
                >
                  {savingScreenPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salvar Preferências da TV
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Prévia de Notícias</span>
                <h3 className="text-base font-bold text-white">{previewTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewing(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {previewError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                  {previewError}
                </div>
              )}

              {previewItems.length === 0 && !previewError && (
                <div className="py-12 flex justify-center items-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400" /> Carregando últimas notícias da fonte...
                </div>
              )}

              {previewItems.map((item, idx) => (
                <article
                  key={idx}
                  className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-1.5 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Notícia {idx + 1} de {previewItems.length}</span>
                    {item.publishedAt && (
                      <span>{new Date(item.publishedAt).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white leading-snug">{item.title}</h4>
                  {item.summary && (
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{item.summary}</p>
                  )}
                </article>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewing(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
