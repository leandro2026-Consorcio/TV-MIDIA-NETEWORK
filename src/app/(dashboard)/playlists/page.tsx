'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Playlist } from '@/types';
import { ListVideo, Plus, Eye, Monitor, CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<(Playlist & { items_count?: number; screens_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadPlaylists() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await (supabase.from('playlists') as any)
          .select('*, playlist_items(count), screen_playlists(count)')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erro ao buscar playlists:', error);
        } else {
          const formatted = (data || []).map((p: any) => ({
            ...p,
            items_count: p.playlist_items?.[0]?.count || 0,
            screens_count: p.screen_playlists?.[0]?.count || 0,
          }));
          setPlaylists(formatted);
        }
      } catch (err) {
        console.error('Erro inesperado ao carregar playlists:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPlaylists();
  }, [supabase]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Ativa
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Rascunho
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            Inativa
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-500">
            Arquivada
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Playlists & Grade de Programação</h1>
          <p className="text-slate-400 text-sm mt-1">
            Crie sequências de anúncios e atribua às suas TVs pareadas.
          </p>
        </div>

        <Link
          href="/playlists/new"
          className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> Criar Nova Playlist
        </Link>
      </div>

      {/* Grid de Playlists */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        </div>
      ) : playlists.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <ListVideo className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Nenhuma playlist cadastrada</h3>
          <p className="text-slate-400 text-sm mb-6">
            Crie sua primeira playlist para organizar o loop de mídias exibido nas TVs.
          </p>
          <Link
            href="/playlists/new"
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Criar Primeira Playlist
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition shadow-xl group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="bg-purple-500/10 text-purple-400 p-2.5 rounded-xl border border-purple-500/20">
                    <ListVideo className="w-6 h-6" />
                  </div>
                  {getStatusBadge(playlist.status)}
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition truncate">
                  {playlist.name}
                </h3>
                {playlist.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1 mb-3">{playlist.description}</p>
                )}

                <div className="space-y-1.5 text-xs text-slate-400 mt-4 border-t border-slate-800/80 pt-4 font-mono">
                  <div className="flex justify-between">
                    <span>Orientação:</span>
                    <span className="font-semibold text-slate-200 capitalize">{playlist.orientation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mídias Incluídas:</span>
                    <strong className="text-purple-400">{playlist.items_count} Itens</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>TVs Vinculadas:</span>
                    <strong className="text-sky-400">{playlist.screens_count} Telas</strong>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <Link
                  href={`/playlists/${playlist.id}`}
                  className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sky-400 font-semibold py-2 rounded-xl text-xs transition text-center flex items-center justify-center gap-2"
                >
                  <Eye className="w-3.5 h-3.5" /> Abrir Montador & Detalhes
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
