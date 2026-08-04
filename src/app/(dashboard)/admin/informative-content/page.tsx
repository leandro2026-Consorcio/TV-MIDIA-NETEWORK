'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Edit3, ExternalLink, Loader2, Newspaper, PlusCircle } from 'lucide-react';
import {
  getInformativeContentsAction,
  InformativeContentInput,
  saveInformativeContentAction,
  updateInformativeContentStatusAction,
} from '@/app/actions/informative-content';

const emptyForm: InformativeContentInput = {
  title: '', summary: '', body: '', category: '', imageUrl: '', sourceName: 'Mídia por Mídia',
  region: '', city: '', durationSeconds: 10, startDate: '', endDate: '', expiresAt: '', status: 'active',
};

export default function InformativeContentAdminPage() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<InformativeContentInput>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadItems = async () => {
    setLoading(true);
    const result = await getInformativeContentsAction();
    if (result.success) setItems(result.items || []);
    else setError(result.error || 'Falha ao carregar conteúdos.');
    setLoading(false);
  };

  useEffect(() => { void loadItems(); }, []);

  const filteredItems = useMemo(() => items.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    const relatedSource = Array.isArray(item.content_sources) ? item.content_sources[0] : item.content_sources;
    const haystack = `${item.title} ${item.category || ''} ${item.city || ''} ${item.region || ''} ${item.source_name || ''} ${item.original_url || ''} ${relatedSource?.source_name || ''} ${relatedSource?.source_url || ''}`.toLowerCase();
    return !search || haystack.includes(search.toLowerCase());
  }), [items, search, statusFilter]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    const result = await saveInformativeContentAction({ ...form, companyId: null });
    if (!result.success) setError(result.error || 'Falha ao salvar conteúdo.');
    else {
      setSuccess(form.id ? 'Conteúdo atualizado.' : 'Conteúdo manual criado.');
      setForm(emptyForm); setShowForm(false); await loadItems();
    }
    setSaving(false);
  };

  const changeStatus = async (id: string, status: any) => {
    setError(''); setSuccess('');
    const result = await updateInformativeContentStatusAction(id, status);
    if (!result.success) setError(result.error || 'Falha ao alterar status.');
    else { setSuccess(`Status alterado para ${status}.`); await loadItems(); }
  };

  const edit = (item: any) => {
    setForm({
      id: item.id, companyId: item.company_id, title: item.title, summary: item.summary || '', body: item.body || '',
      category: item.category || '', imageUrl: item.image_url || '', sourceName: item.source_name || '',
      originalUrl: item.original_url || '', publishedAt: item.published_at || '', region: item.region || '',
      city: item.city || '', segment: item.segment || '', durationSeconds: item.duration_seconds,
      startDate: item.start_date || '', endDate: item.end_date || '', expiresAt: item.expires_at || '', status: item.status,
    });
    setShowForm(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Newspaper className="h-6 w-6 text-sky-400" /> Biblioteca de Conteúdo</h1>
          <p className="mt-1 text-xs text-slate-400">Conteúdo manual e notícias RSS, sem impacto comercial ou financeiro.</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-white hover:bg-sky-600">
          <PlusCircle className="h-4 w-4" /> Novo conteúdo manual
        </button>
      </header>

      {error && <div className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400"><AlertCircle className="h-5 w-5" />{error}</div>}
      {success && <div className="flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400"><CheckCircle2 className="h-5 w-5" />{success}</div>}

      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-[1fr_220px]">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar por título, categoria, cidade ou região" className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-sky-500" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white">
          <option value="">Todos os status</option><option value="pending_review">Aguardando revisão</option><option value="approved">Aprovado</option><option value="active">Ativo</option><option value="paused">Pausado</option><option value="rejected">Rejeitado</option><option value="archived">Arquivado</option>
        </select>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredItems.map((item) => (
            <article key={item.id} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase">
                    <span className={item.content_origin === 'rss' ? 'text-purple-400' : 'text-sky-400'}>{item.content_origin}</span>
                    <span className="text-slate-500">{item.category || 'Sem categoria'}</span>
                    <span className="text-amber-400">{item.status}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-bold text-white">{item.title}</h2>
                </div>
                {item.content_origin === 'manual' && <button onClick={() => edit(item)} className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:text-white"><Edit3 className="h-4 w-4" /></button>}
              </div>
              <SourceAttribution item={item} />
              <ExpandableSummary summary={item.summary} />
              <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                {item.status === 'pending_review' && <><button onClick={() => changeStatus(item.id, 'approved')} className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">Aprovar</button><button onClick={() => changeStatus(item.id, 'rejected')} className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400">Rejeitar</button></>}
                {item.status === 'paused' && <button onClick={() => changeStatus(item.id, 'active')} className="rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-400">Ativar</button>}
                {['approved', 'active'].includes(item.status) && <button onClick={() => changeStatus(item.id, 'paused')} className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400">Pausar</button>}
                {item.status !== 'archived' && <button onClick={() => changeStatus(item.id, 'archived')} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-400">Arquivar</button>}
              </div>
            </article>
          ))}
          {filteredItems.length === 0 && <p className="col-span-full py-16 text-center text-sm text-slate-500">Nenhum conteúdo encontrado.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <form onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm shadow-2xl">
            <h2 className="text-lg font-bold text-white">{form.id ? 'Editar conteúdo manual' : 'Novo conteúdo manual global'}</h2>
            <div><label className="mb-1 block text-xs font-semibold text-slate-300">Título *</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-white" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-300">Resumo para TV</label><textarea rows={3} maxLength={500} value={form.summary || ''} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-white" /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-300">Categoria</label><input value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /></div>
              <div><label className="mb-1 block text-xs text-slate-300">Região/UF</label><input value={form.region || ''} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /></div>
              <div><label className="mb-1 block text-xs text-slate-300">Cidade</label><input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1 block text-xs text-slate-300">URL da imagem (opcional)</label><input type="url" value={form.imageUrl || ''} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /></div><div><label className="mb-1 block text-xs text-slate-300">Fonte</label><input value={form.sourceName || ''} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /></div></div>
            <div className="grid gap-4 sm:grid-cols-3"><div><label className="mb-1 block text-xs text-slate-300">Duração</label><select value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white"><option value={8}>8 segundos</option><option value={10}>10 segundos</option><option value={12}>12 segundos</option><option value={15}>15 segundos</option></select></div><div><label className="mb-1 block text-xs text-slate-300">Início</label><input type="date" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /></div><div><label className="mb-1 block text-xs text-slate-300">Fim</label><input type="date" value={form.endDate || ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /></div></div>
            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl bg-slate-800 px-4 py-2 text-slate-300">Cancelar</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2 font-bold text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar conteúdo</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function SourceAttribution({ item }: { item: any }) {
  if (item.content_origin !== 'rss') return null;

  const relatedSource = Array.isArray(item.content_sources) ? item.content_sources[0] : item.content_sources;
  const sourceName = item.source_name || relatedSource?.source_name || 'Fonte RSS';
  const sourceUrl = item.original_url || relatedSource?.source_url || null;
  let hostname = '';

  if (sourceUrl) {
    try {
      hostname = new URL(sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      hostname = sourceUrl;
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
      <span>Fonte:</span>
      <strong className="text-slate-200">{sourceName}</strong>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300"
          title="Abrir notícia no site de origem"
        >
          {hostname}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

function ExpandableSummary({ summary }: { summary?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const text = summary || 'Sem resumo.';
  const canExpand = !!summary && summary.length > 180;

  return (
    <div className="space-y-2">
      <p className={`${expanded ? 'whitespace-pre-wrap' : 'line-clamp-3'} text-sm leading-relaxed text-slate-400`}>
        {text}
      </p>
      {canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="text-xs font-bold text-sky-400 hover:text-sky-300"
        >
          {expanded ? 'Recolher resumo' : 'Ver resumo completo'}
        </button>
      )}
    </div>
  );
}
