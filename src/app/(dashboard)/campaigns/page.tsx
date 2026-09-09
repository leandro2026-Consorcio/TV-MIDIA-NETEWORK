'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Campaign } from '@/types';
import { Megaphone, Plus, Eye, CheckCircle2, Clock, PauseCircle, Archive, AlertCircle, Loader2, Store, ArrowRight } from 'lucide-react';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<(Campaign & { media_count?: number; screens_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadCampaigns() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await (supabase.from('campaigns') as any)
          .select('*, campaign_media(count), campaign_screens(count)')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erro ao buscar campanhas:', error);
        } else {
          const formatted = (data || []).map((c: any) => ({
            ...c,
            media_count: c.campaign_media?.[0]?.count || 0,
            screens_count: c.campaign_screens?.[0]?.count || 0,
          }));
          setCampaigns(formatted);
        }
      } catch (err) {
        console.error('Erro inesperado:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
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
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Pausada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400">
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Minhas Campanhas</h1>
          <p className="text-slate-400 text-sm mt-1">
            Organize campanhas para divulgar produtos e promoções nas TVs da sua empresa, ou anuncie em outras telas da rede.
          </p>
        </div>

        <Link
          href="/campaigns/new"
          className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> Criar Nova Campanha
        </Link>
      </div>

      {/* Card Marketplace */}
      <div className="bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-900 border border-sky-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <strong className="text-white text-sm font-bold block">Quer anunciar em outras TVs?</strong>
            <p className="text-xs text-slate-300 mt-0.5">
              Encontre TVs parceiras no Marketplace e amplie o alcance dos seus anúncios para novos clientes em outros locais da cidade.
            </p>
          </div>
        </div>

        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition shadow-md shadow-sky-500/20 shrink-0"
        >
          ENCONTRAR TVs NO MARKETPLACE <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Grid de Campanhas */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Nenhuma campanha cadastrada</h3>
          <p className="text-slate-400 text-sm mb-6">
            Crie sua primeira campanha para medir a entrega de inserções nas mídias e telas da sua empresa.
          </p>
          <Link
            href="/campaigns/new"
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Criar Primeira Campanha
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => {
            const pct = c.target_insertions && c.target_insertions > 0
              ? Math.min(100, Math.round((Number(c.delivered_insertions) / c.target_insertions) * 100))
              : 0;

            return (
              <div
                key={c.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition shadow-xl group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="bg-sky-500/10 text-sky-400 p-2.5 rounded-xl border border-sky-500/20">
                      <Megaphone className="w-6 h-6" />
                    </div>
                    {getStatusBadge(c.status)}
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition truncate">
                    {c.name}
                  </h3>
                  {c.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 mb-3">{c.description}</p>
                  )}

                  {/* Barra de Progresso da Meta */}
                  <div className="mt-4 space-y-1.5 border-t border-slate-800/80 pt-4">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Progresso de Inserções:</span>
                      <strong className="text-emerald-400">
                        {c.delivered_insertions} / {c.target_insertions || '∞'} ({pct}%)
                      </strong>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-emerald-400 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 mt-4 font-mono">
                    <div className="flex justify-between">
                      <span>Mídias Vinculadas:</span>
                      <strong className="text-purple-400">{c.media_count} Anúncios</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Telas Participantes:</span>
                      <strong className="text-sky-400">{c.screens_count} TVs</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Período:</span>
                      <span className="text-slate-300">
                        {c.start_date ? new Date(c.start_date).toLocaleDateString('pt-BR') : 'Livre'} à{' '}
                        {c.end_date ? new Date(c.end_date).toLocaleDateString('pt-BR') : 'Livre'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80">
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sky-400 font-semibold py-2 rounded-xl text-xs transition text-center flex items-center justify-center gap-2"
                  >
                    <Eye className="w-3.5 h-3.5" /> Abrir Campanha & Relatório
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
