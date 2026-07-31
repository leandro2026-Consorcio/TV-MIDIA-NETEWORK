'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { createPlaylistAction } from '@/app/actions/playlist-admin';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function NewPlaylistPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical' | 'mixed'>('horizontal');
  const [companyId, setCompanyId] = useState('');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCompanies, setFetchingCompanies] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadCompanies() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await (supabase.from('profiles') as any)
          .select('is_master_admin')
          .eq('id', user.id)
          .single();

        const isMaster = !!profile?.is_master_admin;

        let query;
        if (isMaster) {
          query = (supabase.from('companies') as any).select('*').order('trade_name');
        } else {
          const { data: userLinks } = await (supabase.from('company_users') as any)
            .select('company_id')
            .eq('user_id', user.id)
            .eq('is_active', true);

          const ids = ((userLinks || []) as any[]).map((r) => r.company_id);
          if (ids.length > 0) {
            query = (supabase.from('companies') as any).select('*').in('id', ids).order('trade_name');
          }
        }

        if (query) {
          const { data: compList } = await query;
          if (compList && compList.length > 0) {
            setCompanies(compList as Company[]);
            setCompanyId(compList[0].id);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err);
      } finally {
        setFetchingCompanies(false);
      }
    }

    loadCompanies();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!companyId) {
      setError('Selecione uma empresa.');
      setLoading(false);
      return;
    }

    const res = await createPlaylistAction({
      company_id: companyId,
      name,
      description,
      orientation,
    });

    if (!res.success || !res.playlist) {
      setError(res.error || 'Erro ao criar playlist.');
      setLoading(false);
      return;
    }

    router.push(`/playlists/${res.playlist.id}`);
    router.refresh();
  };

  if (fetchingCompanies) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/playlists"
          className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Criar Nova Playlist</h1>
          <p className="text-slate-400 text-sm">Monte uma grade de exibição de anúncios</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-sm">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Empresa Proprietária *</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name} ({c.city} - {c.state})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Nome da Playlist *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Grade Matutina Recepção"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Orientação da Playlist *</label>
            <select
              value={orientation}
              onChange={(e: any) => setOrientation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-sky-500 capitalize"
            >
              <option value="horizontal">Horizontal (16:9)</option>
              <option value="vertical">Vertical (9:16)</option>
              <option value="mixed">Mista / Qualquer Orientação</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Playlists Horizontais alertarão se mídias verticais forem incluídas.
            </p>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Descrição (Opcional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Playlist com promoções e notícias corporativas"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
            <Link
              href="/playlists"
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Playlist e Montar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
