'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PlaybackLog, Screen, MediaAsset } from '@/types';
import { Play, CheckCircle2, XCircle, AlertTriangle, Loader2, Filter, RefreshCw, Calendar, Monitor, Image as ImageIcon } from 'lucide-react';

export default function PlaybackLogsPage() {
  const [logs, setLogs] = useState<(PlaybackLog & { screen_name?: string; media_title?: string })[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [mediaList, setMediaList] = useState<MediaAsset[]>([]);

  const [filterScreenId, setFilterScreenId] = useState<string>('all');
  const [filterMediaId, setFilterMediaId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 1. Carregar Telas para os filtros
      const { data: scrData } = await (supabase.from('screens') as any).select('id, name');
      setScreens((scrData || []) as Screen[]);

      // 2. Carregar Mídias para os filtros
      const { data: medData } = await (supabase.from('media_assets') as any).select('id, title');
      setMediaList((medData || []) as MediaAsset[]);

      // 3. Consultar Playback Logs (RLS garante isolamento de tenant)
      let query = (supabase.from('playback_logs') as any)
        .select('*, screens(name), media_assets(title)')
        .order('played_at', { ascending: false })
        .limit(100);

      if (filterScreenId !== 'all') {
        query = query.eq('screen_id', filterScreenId);
      }

      if (filterMediaId !== 'all') {
        query = query.eq('media_asset_id', filterMediaId);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data: logsData, error } = await query;

      if (error) {
        console.error('Erro ao carregar logs de exibição:', error);
      } else {
        const formatted = (logsData || []).map((l: any) => ({
          ...l,
          screen_name: l.screens?.name,
          media_title: l.media_assets?.title,
        }));
        setLogs(formatted);
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterScreenId, filterMediaId, filterStatus, supabase]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Concluída
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Falhou
          </span>
        );
      case 'skipped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> Pulada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-400">
            Iniciada
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Logs de Exibição (Proof of Play)</h1>
          <p className="text-slate-400 text-sm mt-1">
            Registro de execuções de anúncios em tempo real com garantia de desduplicação via idempotência.
          </p>
        </div>

        <button
          onClick={loadData}
          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar Logs
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tela:</span>
            <select
              value={filterScreenId}
              onChange={(e) => setFilterScreenId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-sky-500"
            >
              <option value="all">Todas as Telas</option>
              {screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Mídia:</span>
            <select
              value={filterMediaId}
              onChange={(e) => setFilterMediaId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-sky-500"
            >
              <option value="all">Todas as Mídias</option>
              {mediaList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
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
              <option value="completed">Concluída</option>
              <option value="failed">Falha</option>
              <option value="skipped">Pulada</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-500">
          Últimas <strong className="text-slate-300">{logs.length}</strong> execuções
        </span>
      </div>

      {/* Tabela de Logs */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <Play className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Nenhum log de exibição registrado</h3>
          <p className="text-slate-400 text-sm">
            Abra o player em <strong className="text-slate-200">/player</strong> com uma playlist ativa para começar a registrar execuções.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Data / Hora</th>
                  <th className="py-3.5 px-4">TV / Tela</th>
                  <th className="py-3.5 px-4">Mídia Anunciada</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4">Duração Planejada</th>
                  <th className="py-3.5 px-4">Duração Real</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Chave Idempotência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition font-mono">
                    <td className="py-3 px-4 text-slate-200 font-sans font-medium">
                      {new Date(log.played_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-sky-400">
                      {log.screen_name || 'TV Desconhecida'}
                    </td>
                    <td className="py-3 px-4 font-sans font-bold text-white">
                      {log.media_title || 'Mídia Removida'}
                    </td>
                    <td className="py-3 px-4 uppercase text-slate-400 font-sans text-[11px]">
                      {log.media_type}
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-400">
                      {log.planned_duration_seconds}s
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">
                      {log.actual_duration_seconds ? `${log.actual_duration_seconds}s` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[10px] truncate max-w-[120px]" title={log.idempotency_key}>
                      {log.idempotency_key.substring(0, 16)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
