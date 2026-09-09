'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { 
  Tv, Monitor, Home, MapPin, Download, Filter, 
  Layers, ArrowUpDown, Calendar, RefreshCw, CheckCircle2, ShieldCheck, Map
} from 'lucide-react';
import { AdDistributionMap } from './ad-distribution-map';
import { getAdDistributionLocationsAction, AdDistributionFilters } from '@/app/actions/organic-benefits';

interface AdDistributionViewProps {
  companyId?: string;
  campaignId?: string;
  rewardId?: string;
  initialPeriod?: 'today' | '7d' | '30d' | 'all';
  hideCampaignFilter?: boolean;
}

export function AdDistributionView({
  companyId,
  campaignId,
  rewardId,
  initialPeriod = 'all',
}: AdDistributionViewProps) {
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Filtros
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>(initialPeriod);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('all');
  const [screenType, setScreenType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'displays_desc' | 'displays_asc' | 'neighborhood' | 'establishment' | 'delivery_percent' | 'last_display'>('displays_desc');

  // Dados
  const [report, setReport] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReport = () => {
    startTransition(async () => {
      const filters: AdDistributionFilters = {
        companyId,
        campaignId,
        rewardId,
        period,
        city: selectedCity !== 'all' ? selectedCity : undefined,
        neighborhood: selectedNeighborhood !== 'all' ? selectedNeighborhood : undefined,
        screenType: screenType !== 'all' ? screenType : undefined,
        sortBy,
      };

      const res = await getAdDistributionLocationsAction(filters);
      if (res.success) {
        setReport(res.report);
        setErrorMsg(null);
      } else {
        setErrorMsg(res.error || 'Erro ao carregar distribuição de telas.');
      }
    });
  };

  useEffect(() => {
    fetchReport();
  }, [companyId, campaignId, rewardId, period, selectedCity, selectedNeighborhood, screenType, sortBy]);

  // Função para exportar CSV
  const handleExportCsv = () => {
    if (!report) return;

    const headers = [
      'Tipo de Local',
      'Estabelecimento / Região',
      'Tipo de Tela',
      'Cidade',
      'Bairro / Região',
      'Endereço',
      'Exibições Validadas',
      'Planejado',
      'Realizado',
      '% de Entrega',
      'Última Exibição'
    ];

    const rows: string[][] = [];

    // Comerciais
    (report.commercial_points || []).forEach((pt: any) => {
      rows.push([
        'Comercial',
        `"${(pt.establishment_name || '').replace(/"/g, '""')}"`,
        pt.screen_type === 'tv' ? 'TV Comercial' : 'Monitor Windows Comercial',
        `"${(pt.city || '').replace(/"/g, '""')}"`,
        `"${(pt.neighborhood || '').replace(/"/g, '""')}"`,
        `"${(pt.address || '').replace(/"/g, '""')}"`,
        String(pt.validated_displays || 0),
        String(pt.planned || 0),
        String(pt.realized || 0),
        `${pt.delivery_percent || 0}%`,
        pt.last_display_at ? new Date(pt.last_display_at).toLocaleString('pt-BR') : '-'
      ]);
    });

    // Residenciais (Privacidade Estrita: sem endereço, sem identificador individual)
    (report.residential_aggregated || []).forEach((res: any) => {
      rows.push([
        'Residencial (Agregado)',
        `"Rede Residencial (${res.screen_count || 1} telas)"`,
        'Tela Residencial',
        `"${(res.city || '').replace(/"/g, '""')}"`,
        `"${(res.neighborhood || '').replace(/"/g, '""')}"`,
        '"[Endereço protegido - Privacidade Residencial]"',
        String(res.validated_displays || 0),
        '-',
        String(res.validated_displays || 0),
        '100%',
        res.last_display_at ? new Date(res.last_display_at).toLocaleString('pt-BR') : '-'
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,﻿' + 
      [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio-distribuicao-exibicoes-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = report?.summary || {
    commercial_screens: 0,
    commercial_tvs: 0,
    windows_monitors: 0,
    residential_screens: 0,
    total_validated_displays: 0,
    target_displays: 10000,
    executed_percent: 0,
  };

  const totalScreens = summary.commercial_screens + summary.residential_screens;

  return (
    <div className="space-y-6">
      {/* 1. Resumo em Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Total de Telas */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase">Total de Telas</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {totalScreens}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {summary.commercial_screens} comerciais + {summary.residential_screens} residenciais
          </div>
        </div>

        {/* TVs Comerciais */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase">TVs Comerciais</span>
            <Tv className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {summary.commercial_tvs}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Em lojas, recepções e academias
          </div>
        </div>

        {/* Monitores Windows */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase">Monitores PC</span>
            <Monitor className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {summary.windows_monitors}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Caixas e totens Windows
          </div>
        </div>

        {/* Telas Residenciais */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase">Telas Residenciais</span>
            <Home className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {summary.residential_screens}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Privacidade 100% protegida
          </div>
        </div>

        {/* Exibições Validadas */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-900/40 shadow-sm bg-blue-50/20">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-1">
            <span className="text-xs font-bold uppercase">Exibições Validadas</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-950 dark:text-blue-100">
            {(summary.total_validated_displays || 0).toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-blue-600/80 mt-1">
            Com Comprovante de Exibição
          </div>
        </div>

        {/* Meta / % Executado */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase">Executado</span>
            <span className="text-xs font-bold text-emerald-600">{summary.executed_percent}%</span>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {summary.executed_percent}%
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, summary.executed_percent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros e Controles */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        {/* Filtros em linha */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Período */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-zinc-500 ml-1.5" />
            <button
              onClick={() => setPeriod('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                period === 'all' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setPeriod('today')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                period === 'today' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriod('7d')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                period === '7d' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              7 dias
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                period === '30d' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              30 dias
            </button>
          </div>

          {/* Cidade */}
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="text-xs bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas as Cidades</option>
            {(report?.filters_meta?.cities || []).map((c: string) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Bairro */}
          <select
            value={selectedNeighborhood}
            onChange={(e) => setSelectedNeighborhood(e.target.value)}
            className="text-xs bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os Bairros</option>
            {(report?.filters_meta?.neighborhoods || []).map((n: string) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          {/* Tipo de Tela */}
          <select
            value={screenType}
            onChange={(e) => setScreenType(e.target.value)}
            className="text-xs bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas as Telas</option>
            <option value="tv">TV Comercial</option>
            <option value="windows_monitor">Monitor Windows</option>
            <option value="residential">Rede Residencial</option>
          </select>

          {/* Ordenação */}
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="text-xs bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500"
          >
            <option value="displays_desc">Mais Exibições Validadas</option>
            <option value="displays_asc">Menos Exibições Validadas</option>
            <option value="establishment">Estabelecimento (A-Z)</option>
            <option value="neighborhood">Bairro (A-Z)</option>
            <option value="delivery_percent">% de Entrega</option>
            <option value="last_display">Última Exibição</option>
          </select>
        </div>

        {/* Botões de Ação (Mapa/Lista + Exportar CSV) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Alternador de Visualização */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'map' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              Mapa Visual
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'list' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Lista de Pontos
            </button>
          </div>

          {/* Botão Baixar Relatório */}
          <button
            onClick={handleExportCsv}
            disabled={!report || isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar Relatório
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          {errorMsg}
        </div>
      )}

      {/* 3. Visualização em Mapa ou Lista */}
      {viewMode === 'map' ? (
        <div className="space-y-4">
          <AdDistributionMap
            commercialPoints={report?.commercial_points || []}
            residentialAggregated={report?.residential_aggregated || []}
            cityName={selectedCity !== 'all' ? selectedCity : 'Rede Mídia por Mídia'}
          />

          {/* Destaques rápidos abaixo do mapa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Resumo Comercial */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                <Tv className="w-4 h-4 text-emerald-500" />
                Pontos Comerciais Auditados
              </h4>
              <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Mostrando {(report?.commercial_points || []).length} locais públicos com autorização comercial ativa. Cada local conta com contagem individual de Exibições Validadas.
              </p>
            </div>

            {/* Aviso de Privacidade Residencial */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-purple-200 dark:border-purple-900/40 text-xs bg-purple-50/10">
              <h4 className="font-bold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Privacidade Residencial Garantida
              </h4>
              <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Telas residenciais são estritamente agrupadas por região/bairro com no mínimo 3 telas por grupo. Endereços, nomes e localizações individuais nunca são exibidos.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* 4. Lista Detalhada de Pontos Comerciais */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Tv className="w-4 h-4 text-emerald-500" />
              Locais Comerciais Auditados ({ (report?.commercial_points || []).length })
            </h3>
            <p className="text-xs text-zinc-500">
              Locais autorizados onde sua publicidade foi transmitida e validada
            </p>
          </div>
        </div>

        {(report?.commercial_points || []).length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            Nenhuma tela comercial encontrada com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="p-3">Estabelecimento</th>
                  <th className="p-3">Localização</th>
                  <th className="p-3">Tipo de Tela</th>
                  <th className="p-3 text-right">Exibições Validadas</th>
                  <th className="p-3 text-right">Entrega Realizada</th>
                  <th className="p-3 text-right">Última Exibição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(report?.commercial_points || []).map((pt: any) => (
                  <tr key={pt.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">
                        {pt.establishment_name}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {pt.screen_name || 'Tela Principal'}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-zinc-800 dark:text-zinc-200">
                        {pt.neighborhood}, {pt.city}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {pt.address}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        pt.screen_type === 'tv'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400'
                      }`}>
                        {pt.screen_type === 'tv' ? <Tv className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                        {pt.screen_type === 'tv' ? 'TV Comercial' : 'Monitor Windows'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-blue-600 dark:text-blue-400">
                      {(pt.validated_displays || 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-bold text-zinc-800 dark:text-zinc-200">
                        {pt.delivery_percent}%
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {pt.realized} de {pt.planned} planejado
                      </div>
                    </td>
                    <td className="p-3 text-right text-zinc-500">
                      {pt.last_display_at ? new Date(pt.last_display_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Rede Residencial Agrupada (Privacidade Garantida) */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-purple-200/60 dark:border-purple-900/30 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-purple-50/20">
          <div>
            <h3 className="font-bold text-sm text-purple-950 dark:text-purple-200 flex items-center gap-2">
              <Home className="w-4 h-4 text-purple-600" />
              Rede Residencial Agregada por Região
            </h3>
            <p className="text-xs text-zinc-500">
              Telas residenciais ativas agrupadas para total proteção da privacidade dos participantes
            </p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 rounded-md self-start sm:self-auto">
            Privacidade 100% Protegida
          </span>
        </div>

        {(report?.residential_aggregated || []).length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">
            Nenhuma região residencial encontrada com os filtros selecionados.
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {(report?.residential_aggregated || []).map((res: any, idx: number) => (
              <div key={idx} className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-purple-500" />
                    {res.neighborhood}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full">
                    {res.screen_count} telas
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 mb-3">
                  {res.city} • Dados agrupados
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                  <span className="text-zinc-500">Exibições Validadas:</span>
                  <span className="font-black text-purple-700 dark:text-purple-300">
                    {(res.validated_displays || 0).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
