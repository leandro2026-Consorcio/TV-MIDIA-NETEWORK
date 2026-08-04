'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Loader2, PlusCircle, RefreshCw, Rss } from 'lucide-react';
import {
  ContentSourceInput, getContentSourcesAction, importAllActiveContentSourcesAction,
  importContentSourceAction, saveContentSourceAction, testContentSourceAction, toggleContentSourceAction,
} from '@/app/actions/informative-content';

const emptySource: ContentSourceInput = {
  sourceName: '', sourceUrl: '', category: '', region: '', city: '', refreshIntervalMinutes: 60,
  expiryHours: 48, requiresManualApproval: true, isActive: true,
};

export default function ContentSourcesAdminPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [form, setForm] = useState<ContentSourceInput>(emptySource);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testItems, setTestItems] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const result = await getContentSourcesAction();
    if (result.success) setSources(result.sources || []);
    else setError(result.error || 'Falha ao carregar fontes.');
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    const result = await saveContentSourceAction(form);
    if (!result.success) setError(result.error || 'Falha ao salvar fonte.');
    else { setSuccess('Fonte RSS salva.'); setShowForm(false); setForm(emptySource); setTestItems([]); await load(); }
    setBusy(false);
  };

  const test = async () => {
    setBusy(true); setError(''); setTestItems([]);
    const result = await testContentSourceAction(form.sourceUrl);
    if (!result.success) setError(result.error || 'Fonte RSS inválida.');
    else { setSuccess(`${result.count} item(ns) válido(s) encontrado(s).`); setTestItems(result.items || []); }
    setBusy(false);
  };

  const importOne = async (id: string) => {
    setBusy(true); setError(''); setSuccess('');
    const result = await importContentSourceAction(id);
    if (!result.success) setError(result.error || 'Falha ao importar fonte.');
    else setSuccess(`Importação concluída: ${result.imported} novo(s), ${result.skipped} ignorado(s).`);
    await load(); setBusy(false);
  };

  const importAll = async () => {
    setBusy(true); setError(''); setSuccess('');
    const result = await importAllActiveContentSourcesAction();
    if (!result.success) setError(result.error || 'Falha ao importar fontes.');
    else setSuccess(`${result.results.length} fonte(s) processada(s) conforme o intervalo configurado.`);
    await load(); setBusy(false);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Rss className="h-6 w-6 text-purple-400" /> Fontes RSS</h1><p className="mt-1 text-xs text-slate-400">Busca server-side com validação, deduplicação e aprovação editorial.</p></div>
        <div className="flex gap-2"><button disabled={busy} onClick={importAll} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200"><RefreshCw className="h-4 w-4" /> Importar fontes vencidas</button><button onClick={() => { setForm(emptySource); setTestItems([]); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-purple-500 px-4 py-2 text-xs font-bold text-white"><PlusCircle className="h-4 w-4" /> Nova fonte</button></div>
      </header>

      {error && <div className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400"><AlertCircle className="h-5 w-5" />{error}</div>}
      {success && <div className="flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400"><CheckCircle2 className="h-5 w-5" />{success}</div>}

      {loading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-purple-400" /></div> : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-950 text-slate-400"><tr><th className="px-4 py-3">Fonte</th><th className="px-4 py-3">Regras</th><th className="px-4 py-3">Última atualização</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-800">
            {sources.map((source) => <tr key={source.id} className="align-top"><td className="px-4 py-4"><strong className="block text-sm text-white">{source.source_name}</strong><span className="block max-w-xs truncate text-slate-500">{source.source_url}</span><span className="text-purple-400">{source.category || 'Sem categoria'}</span></td><td className="px-4 py-4 text-slate-400">A cada {source.refresh_interval_minutes} min<br />Expira em {source.expiry_hours}h<br />{source.requires_manual_approval ? 'Exige aprovação' : 'Aprovação automática'}</td><td className="px-4 py-4 text-slate-400">{source.last_success_at ? new Date(source.last_success_at).toLocaleString('pt-BR') : 'Nunca'}{source.last_error && <span className="mt-1 block max-w-xs text-rose-400">{source.last_error}</span>}</td><td className="px-4 py-4"><button onClick={async () => { await toggleContentSourceAction(source.id, !source.is_active); await load(); }} className={source.is_active ? 'font-bold text-emerald-400' : 'font-bold text-slate-500'}>{source.is_active ? 'ATIVA' : 'INATIVA'}</button></td><td className="px-4 py-4 text-right"><div className="flex justify-end gap-2"><button disabled={busy} onClick={() => importOne(source.id)} className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-3 py-2 font-bold text-sky-400"><Download className="h-3.5 w-3.5" /> Importar</button><button onClick={() => { setForm({ id: source.id, sourceName: source.source_name, sourceUrl: source.source_url, category: source.category || '', region: source.region || '', city: source.city || '', refreshIntervalMinutes: source.refresh_interval_minutes, expiryHours: source.expiry_hours, requiresManualApproval: source.requires_manual_approval, isActive: source.is_active }); setTestItems([]); setShowForm(true); }} className="rounded-lg bg-slate-800 px-3 py-2 font-bold text-slate-300">Editar</button></div></td></tr>)}
          </tbody></table></div>{sources.length === 0 && <p className="py-16 text-center text-sm text-slate-500">Nenhuma fonte RSS cadastrada.</p>}
        </div>
      )}

      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"><form onSubmit={save} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm"><h2 className="text-lg font-bold text-white">{form.id ? 'Editar fonte RSS' : 'Cadastrar fonte RSS'}</h2><div><label className="mb-1 block text-xs text-slate-300">Nome *</label><input required value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-white" /></div><div><label className="mb-1 block text-xs text-slate-300">URL RSS *</label><input required type="url" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-white" /></div><div className="grid gap-4 sm:grid-cols-3"><input placeholder="Categoria" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /><input placeholder="Região/UF" value={form.region || ''} onChange={(e) => setForm({ ...form, region: e.target.value })} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /><input placeholder="Cidade" value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-slate-300">Intervalo (min)<input type="number" min={15} max={1440} value={form.refreshIntervalMinutes} onChange={(e) => setForm({ ...form, refreshIntervalMinutes: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /></label><label className="text-xs text-slate-300">Expiração (horas)<input type="number" min={12} max={168} value={form.expiryHours} onChange={(e) => setForm({ ...form, expiryHours: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-white" /></label></div><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.requiresManualApproval} onChange={(e) => setForm({ ...form, requiresManualApproval: e.target.checked })} /> Exigir aprovação manual das notícias</label>{testItems.length > 0 && <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><strong className="text-xs text-emerald-400">Prévia válida</strong>{testItems.map((item) => <p key={item.dedupeKey} className="text-xs text-slate-300">• {item.title}</p>)}</div>}<div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl bg-slate-800 px-4 py-2 text-slate-300">Cancelar</button><button type="button" disabled={busy || !form.sourceUrl} onClick={test} className="rounded-xl bg-emerald-500/10 px-4 py-2 font-bold text-emerald-400">Testar busca</button><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-purple-500 px-5 py-2 font-bold text-white">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Salvar fonte</button></div></form></div>}
    </div>
  );
}
