'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Screen } from '@/types';
import { Tv, Plus, MapPin, Monitor, Clock, Loader2, Link2, X } from 'lucide-react';
import { useDashboardCompany } from '@/contexts/dashboard-company-context';
import { getMyCompanyScreensAction } from '@/app/actions/screens';

export default function ScreensPage() {
  const [screens, setScreens] = useState<(Screen & { company_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConnectionChoice, setShowConnectionChoice] = useState(false);
  const { activeCompany } = useDashboardCompany();

  useEffect(() => {
    async function loadScreens() {
      try {
        if (!activeCompany?.id) {
          setScreens([]);
          return;
        }
        const result = await getMyCompanyScreensAction(activeCompany.id);
        if (!result.success) throw new Error(result.error);
        setScreens(result.screens as (Screen & { company_name?: string })[]);
      } catch (err) {
        console.error('Erro inesperado:', err);
        setError(err instanceof Error ? err.message : 'Não foi possível carregar as TVs.');
        setScreens([]);
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    setError(null);
    loadScreens();
  }, [activeCompany?.id]);

  const screenTypeLabel = (screen: Screen) => {
    if ((screen as any).venue_type === 'residential') return 'Residencial';
    return screen.device_type === 'windows_monitor' ? 'Windows / Monitor' : 'Smart TV';
  };

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
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white tracking-tight">Minhas TVs</h1>
          <p className="text-slate-400 text-sm mt-1">
            {activeCompany ? `TVs vinculadas a ${activeCompany.trade_name}` : 'Selecione uma empresa para visualizar suas TVs.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowConnectionChoice(true)}
          className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> ADICIONAR TV
        </button>
      </div>

      {/* Content */}
      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        </div>
      ) : screens.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-12 text-center max-w-lg mx-auto">
          <Tv className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Nenhuma tela cadastrada</h3>
          <p className="text-slate-400 text-sm mb-6">
            Cadastre sua primeira TV para obter o pareamento de código de 6 dígitos.
          </p>
          <button
            type="button"
            onClick={() => setShowConnectionChoice(true)}
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Adicionar Primeira TV
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {screens.map((screen) => (
            <div
              key={screen.id}
              className="min-w-0 w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col justify-between hover:border-slate-700 transition shadow-xl group"
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
                <p className="text-xs text-sky-400 font-semibold">
                  {screenTypeLabel(screen)}
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
                    <span className="min-w-0 break-words">
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

      {showConnectionChoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="connection-choice-title">
          <div className="relative w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-5 sm:p-7 shadow-2xl">
            <button type="button" onClick={() => setShowConnectionChoice(false)} className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
            <h2 id="connection-choice-title" className="pr-10 text-xl font-bold text-white">Como você deseja conectar?</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Link href="/screens/new?device=tv" className="min-w-0 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 hover:border-sky-400">
                <Tv className="h-7 w-7 text-sky-400" />
                <h3 className="mt-3 font-bold text-white">SMART TV</h3>
                <p className="mt-1 text-sm text-slate-400">Sem instalação</p>
              </Link>
              <Link href="/screens/new?device=windows_monitor" className="min-w-0 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5 hover:border-purple-400">
                <Monitor className="h-7 w-7 text-purple-400" />
                <h3 className="mt-3 font-bold text-white">WINDOWS / MONITOR</h3>
                <p className="mt-1 text-sm text-slate-400">Usar Player MPM</p>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
