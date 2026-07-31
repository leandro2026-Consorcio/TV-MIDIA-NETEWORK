'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Screen, Company } from '@/types';
import { Tv, Plus, MapPin, Monitor, Clock, Loader2, Link2 } from 'lucide-react';

export default function ScreensPage() {
  const [screens, setScreens] = useState<(Screen & { company_name?: string })[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadScreens() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Buscar telas respeitando RLS
        const { data, error } = await (supabase.from('screens') as any)
          .select('*, companies(trade_name)')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erro ao buscar telas:', error);
        } else {
          const formatted = (data || []).map((s: any) => ({
            ...s,
            company_name: s.companies?.trade_name,
          }));
          setScreens(formatted);
        }
      } catch (err) {
        console.error('Erro inesperado:', err);
      } finally {
        setLoading(false);
      }
    }

    loadScreens();
  }, [supabase]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Online
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            Offline
          </span>
        );
      case 'pending_pairing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Aguardando Pareamento
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            Inativa
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gerenciamento de TVs / Telas</h1>
          <p className="text-slate-400 text-sm mt-1">
            Cadastre, edite e vincule telas aos seus estabelecimentos comerciais.
          </p>
        </div>

        <Link
          href="/screens/new"
          className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> Cadastrar Nova TV
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        </div>
      ) : screens.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <Tv className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Nenhuma tela cadastrada</h3>
          <p className="text-slate-400 text-sm mb-6">
            Cadastre sua primeira TV para obter o pareamento de código de 6 dígitos.
          </p>
          <Link
            href="/screens/new"
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Cadastrar Primeira TV
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {screens.map((screen) => (
            <div
              key={screen.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition shadow-xl group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="bg-sky-500/10 text-sky-400 p-2.5 rounded-xl border border-sky-500/20">
                    <Tv className="w-6 h-6" />
                  </div>
                  {getStatusBadge(screen.status)}
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition truncate">
                  {screen.name}
                </h3>
                <p className="text-xs font-semibold text-slate-400 truncate mb-1">
                  {screen.company_name || 'Empresa'}
                </p>
                {screen.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">{screen.description}</p>
                )}

                <div className="space-y-1.5 text-xs text-slate-400 mt-4 border-t border-slate-800/80 pt-4">
                  {screen.location_description && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate">{screen.location_description}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-slate-500" />
                    <span className="capitalize">{screen.orientation} ({screen.resolution || '1920x1080'})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      Último ping: {screen.last_ping_at ? new Date(screen.last_ping_at).toLocaleTimeString('pt-BR') : 'NUNCA'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <Link
                  href={`/screens/${screen.id}`}
                  className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sky-400 font-semibold py-2 rounded-xl text-xs transition text-center flex items-center justify-center gap-2"
                >
                  <Link2 className="w-3.5 h-3.5" /> Detalhes & Pareamento
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
