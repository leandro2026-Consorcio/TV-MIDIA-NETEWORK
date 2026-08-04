'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  FolderPlus, 
  Loader2, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Tag, 
  ArrowLeft, 
  ToggleLeft, 
  ToggleRight,
  Edit2,
  Plus
} from 'lucide-react';
import { 
  getContentCategoriesAction, 
  saveContentCategoryAction, 
  toggleContentCategoryAction,
  ContentCategoryInput 
} from '@/app/actions/content-categories';

const emptyForm: ContentCategoryInput = {
  name: '',
  slug: '',
  description: '',
  sortOrder: 0,
  isActive: true,
};

export default function MasterContentCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState<ContentCategoryInput>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await getContentCategoriesAction(false);
    if (res.success) {
      setCategories(res.categories);
    } else {
      setError(res.error || 'Falha ao carregar categorias.');
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const res = await saveContentCategoryAction(form);
    if (res.success) {
      setSuccess(form.id ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!');
      setForm(emptyForm);
      await load();
    } else {
      setError(res.error || 'Falha ao salvar categoria.');
    }
    setSaving(false);
  }

  async function handleToggle(id: string, currentActive: boolean) {
    setError(null);
    const res = await toggleContentCategoryAction(id, !currentActive);
    if (res.success) {
      await load();
    } else {
      setError(res.error || 'Falha ao alterar status da categoria.');
    }
  }

  function handleEdit(item: any) {
    setForm({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      sortOrder: item.sort_order || 0,
      isActive: item.is_active,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading && categories.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/informative-content"
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Tag className="h-6 w-6 text-sky-400" /> Categorias de Conteúdo
            </h1>
            <p className="text-xs text-slate-400">
              Gerencie as categorias oficiais disponíveis para filtro nas TVs exibidoras.
            </p>
          </div>
        </div>

        <Link
          href="/admin/informative-content"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
        >
          Voltar para Notícias RSS
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> {success}
        </div>
      )}

      {/* Formulário de Criação/Edição */}
      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {form.id ? <Edit2 className="h-5 w-5 text-amber-400" /> : <Plus className="h-5 w-5 text-sky-400" />}
            {form.id ? 'Editar Categoria' : 'Nova Categoria Oficial'}
          </h2>
          {form.id && (
            <button
              type="button"
              onClick={() => setForm(emptyForm)}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              Cancelar edição
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-300">
            Nome da Categoria <span className="text-rose-400">*</span>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Saúde, Agronegócio, Esportes"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </label>

          <label className="text-xs font-semibold text-slate-300">
            Slug amigável (opcional)
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="Gerado automaticamente (ex: saude, agronegocio)"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </label>
        </div>

        <label className="block text-xs font-semibold text-slate-300">
          Descrição (opcional)
          <input
            type="text"
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Breve descrição da categoria"
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-300">
            Ordem de exibição
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-semibold text-slate-200 mt-6 sm:mt-0 self-end">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-700 bg-slate-900"
            />
            Categoria ativa para seleção nas TVs
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-600 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {form.id ? 'Salvar Alterações' : 'Cadastrar Categoria'}
          </button>
        </div>
      </form>

      {/* Tabela de Categorias */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 space-y-4">
        <h2 className="text-lg font-bold text-white">Categorias Cadastradas ({categories.length})</h2>

        <div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
          {categories.map((cat) => (
            <div key={cat.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-slate-900/50 transition">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{cat.name}</span>
                  <code className="text-[11px] text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                    {cat.slug}
                  </code>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    cat.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {cat.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                {cat.description && <p className="text-xs text-slate-400">{cat.description}</p>}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(cat)}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <Edit2 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleToggle(cat.id, cat.is_active)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    cat.is_active
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {cat.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {cat.is_active ? 'Ativa' : 'Desativada'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
