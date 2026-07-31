'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MediaAsset } from '@/types';
import { Image as ImageIcon, Video, Plus, Eye, Clock, Loader2, CheckCircle2, XCircle, Archive, AlertCircle } from 'lucide-react';

export default function MediaListPage() {
  const [mediaList, setMediaList] = useState<MediaAsset[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadMedia() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // RLS garante filtragem por empresa
        let query = (supabase.from('media_assets') as any)
          .select('*')
          .order('created_at', { ascending: false });

        if (filterType !== 'all') {
          query = query.eq('media_type', filterType);
        }

        if (filterStatus !== 'all') {
          query = query.eq('status', filterStatus);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Erro ao buscar mídias:', error);
        } else {
          setMediaList((data || []) as MediaAsset[]);
        }
      } catch (err) {
        console.error('Erro inesperado ao carregar biblioteca:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMedia();
  }, [filterType, filterStatus, supabase]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Aprovada
          </span>
        );
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Em Análise
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Reprovada
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <Archive className="w-3 h-3" /> Arquivada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300">
            Rascunho
          </span>
        );
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Biblioteca de Mídias</h1>
          <p className="text-slate-400 text-sm mt-1">
            Imagens e vídeos cadastrados no Supabase Storage com controle de exibição e orientação.
          </p>
        </div>

        <Link
          href="/media/new"
          className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> Enviar Nova Mídia
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tipo:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-sky-500"
            >
              <option value="all">Todos os Tipos</option>
              <option value="image">Imagens</option>
              <option value="video">Vídeos</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-sky-500"
            >
              <option value="all">Todos os Status</option>
              <option value="approved">Aprovadas</option>
              <option value="pending_review">Em Análise</option>
              <option value="rejected">Reprovadas</option>
              <option value="archived">Arquivadas</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-500">
          Total: <strong className="text-slate-300">{mediaList.length}</strong> mídias
        </span>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        </div>
      ) : mediaList.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Nenhuma mídia encontrada</h3>
          <p className="text-slate-400 text-sm mb-6">
            Faça upload de vídeos ou imagens para abastecer a grade de exibição do estabelecimento.
          </p>
          <Link
            href="/media/new"
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Enviar Primeira Mídia
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {mediaList.map((media) => (
            <div
              key={media.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition flex flex-col justify-between group shadow-xl"
            >
              {/* Media Preview Box */}
              <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800">
                {media.file_url ? (
                  media.media_type === 'image' ? (
                    <img
                      src={media.file_url}
                      alt={media.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <video
                      src={media.file_url}
                      className="w-full h-full object-cover"
                      muted
                      onMouseOver={(e) => e.currentTarget.play()}
                      onMouseOut={(e) => e.currentTarget.pause()}
                    />
                  )
                ) : (
                  <div className="text-slate-600 flex flex-col items-center gap-1">
                    {media.media_type === 'image' ? <ImageIcon className="w-8 h-8" /> : <Video className="w-8 h-8" />}
                    <span className="text-[10px]">Sem Preview</span>
                  </div>
                )}

                {/* Badge Top Left */}
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur text-[10px] font-bold text-slate-300 border border-slate-700">
                  {media.media_type === 'image' ? <ImageIcon className="w-3 h-3 text-sky-400" /> : <Video className="w-3 h-3 text-purple-400" />}
                  <span className="uppercase">{media.media_type}</span>
                </div>

                {/* Badge Top Right */}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(media.status)}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm truncate group-hover:text-sky-400 transition">
                    {media.title}
                  </h3>
                  {media.description && (
                    <p className="text-xs text-slate-400 truncate">{media.description}</p>
                  )}
                </div>

                <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                  <div className="flex justify-between">
                    <span>Orientação:</span>
                    <span className="font-semibold text-slate-200 capitalize">{media.orientation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tempo Exibição:</span>
                    <span className="font-bold text-amber-400">{media.playback_duration_seconds}s</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Tamanho:</span>
                    <span>{formatFileSize(media.file_size_bytes)}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href={`/media/${media.id}`}
                    className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sky-400 font-semibold py-2 rounded-xl text-xs transition text-center flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" /> Detalhes & Moderação
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
