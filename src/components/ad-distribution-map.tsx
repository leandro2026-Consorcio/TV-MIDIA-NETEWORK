'use client';

import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Tv,
  Monitor,
  Home,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

export interface CommercialPoint {
  id?: string;
  establishment_name: string;
  city: string;
  neighborhood: string;
  address: string;
  screen_type: string;
  screen_name?: string;
  validated_displays: number;
  planned?: number;
  realized?: number;
  delivery_percent?: number;
  last_display_at?: string;
  lat?: number;
  lng?: number;
}

export interface ResidentialAggregatedGroup {
  city: string;
  neighborhood: string;
  screen_count: number;
  validated_displays: number;
  last_display_at?: string;
  lat?: number;
  lng?: number;
}

export interface AdDistributionMapProps {
  commercialPoints: CommercialPoint[];
  residentialGroups?: ResidentialAggregatedGroup[];
  residentialAggregated?: ResidentialAggregatedGroup[];
  campaignName?: string;
  cityName?: string;
}

// Pseudo-coordenadas canônicas estáveis baseadas em hash de string para posicionamento visual consistente no mapa da cidade
function getCoordsFromHash(str: string, index: number, isResidential = false) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);
  
  if (isResidential) {
    // Zonas residenciais espalhadas nos anéis intermediários/periféricos
    const angle = ((posHash % 360) * Math.PI) / 180;
    const distance = 140 + (posHash % 120);
    return {
      x: 400 + Math.cos(angle) * distance,
      y: 280 + Math.sin(angle) * distance * 0.75,
    };
  }

  // Locais comerciais no centro ou eixos viários
  const angle = ((posHash % 360) * Math.PI) / 180;
  const distance = 40 + ((posHash + index * 45) % 110);
  return {
    x: 400 + Math.cos(angle) * distance,
    y: 280 + Math.sin(angle) * distance * 0.75,
  };
}

export function AdDistributionMap({
  commercialPoints = [],
  residentialGroups,
  residentialAggregated,
  campaignName,
  cityName,
}: AdDistributionMapProps) {
  const finalResidentialGroups = useMemo(() => {
    return residentialGroups || residentialAggregated || [];
  }, [residentialGroups, residentialAggregated]);

  const finalTitleName = cityName || campaignName || 'Rede Mídia por Mídia';

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedCommercial, setSelectedCommercial] = useState<CommercialPoint | null>(null);
  const [selectedResidential, setSelectedResidential] = useState<ResidentialAggregatedGroup | null>(null);
  const [filterLayer, setFilterLayer] = useState<'all' | 'commercial' | 'residential'>('all');

  const positionedCommercial = useMemo(() => {
    return (commercialPoints || []).map((pt: CommercialPoint, idx: number) => {
      const coords = getCoordsFromHash(pt.establishment_name + pt.neighborhood, idx, false);
      return { ...pt, mapX: coords.x, mapY: coords.y };
    });
  }, [commercialPoints]);

  const positionedResidential = useMemo(() => {
    return (finalResidentialGroups || []).map((res: ResidentialAggregatedGroup, idx: number) => {
      const coords = getCoordsFromHash(res.neighborhood + res.city, idx, true);
      return { ...res, mapX: coords.x, mapY: coords.y };
    });
  }, [finalResidentialGroups]);

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, Number((z - 0.25).toFixed(2))));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedCommercial(null);
    setSelectedResidential(null);
  };

  return (
    <div className="relative w-full rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
      {/* Top Bar do Mapa */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-4 py-2 rounded-2xl shadow-lg pointer-events-auto">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-extrabold text-white">Mapa de Cobertura da Publicidade</span>
          {finalTitleName && (
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              · {finalTitleName}
            </span>
          )}
        </div>

        {/* Camadas & Controles */}
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-2xl shadow-lg pointer-events-auto">
          <div className="flex items-center rounded-xl bg-slate-950 p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setFilterLayer('all')}
              className={`px-2.5 py-1 rounded-lg transition ${filterLayer === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Todos ({commercialPoints.length + finalResidentialGroups.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterLayer('commercial')}
              className={`px-2.5 py-1 rounded-lg transition ${filterLayer === 'commercial' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Comerciais ({commercialPoints.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterLayer('residential')}
              className={`px-2.5 py-1 rounded-lg transition ${filterLayer === 'residential' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Residenciais ({finalResidentialGroups.length})
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Aproximar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Afastar"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Redefinir visualização"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Interativo */}
      <div className="relative w-full h-[520px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden select-none cursor-grab active:cursor-grabbing">
        <svg
          viewBox="0 0 800 560"
          className="w-full h-full"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-out',
          }}
        >
          {/* Defs de gradientes e efeitos de radar */}
          <defs>
            <radialGradient id="cityCenterGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="residentialZoneGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#a855f7" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </radialGradient>
            <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Grid de fundo estilizado */}
          <rect width="800" height="560" fill="#090d16" />
          <circle cx="400" cy="280" r="260" fill="url(#cityCenterGlow)" />
          
          {/* Círculos de anéis concêntricos (Radar / Cobertura Urbana) */}
          <circle cx="400" cy="280" r="80" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx="400" cy="280" r="160" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx="400" cy="280" r="240" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />

          {/* Linhas viárias simuladas (Avenidas principais) */}
          <path d="M 120 280 L 680 280" stroke="#1e293b" strokeWidth="1.5" />
          <path d="M 400 60 L 400 500" stroke="#1e293b" strokeWidth="1.5" />
          <path d="M 180 120 L 620 440" stroke="#0f172a" strokeWidth="1.2" strokeDasharray="6 4" />
          <path d="M 180 440 L 620 120" stroke="#0f172a" strokeWidth="1.2" strokeDasharray="6 4" />

          {/* Nomes das vias */}
          <text x="685" y="284" fill="#475569" fontSize="9" fontFamily="monospace">EIXO LESTE-OESTE</text>
          <text x="405" y="520" fill="#475569" fontSize="9" fontFamily="monospace">AV. NORTE-SUL</text>

          {/* CAMADA 1: Zonas Residenciais Agregadas (Círculos difusos sem endereço individual) */}
          {(filterLayer === 'all' || filterLayer === 'residential') &&
            positionedResidential.map((res: any, i: number) => {
              const radius = 38 + Math.min(30, (res.screen_count || 1) * 3);
              return (
                <g
                  key={`res-zone-${i}`}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                  onClick={() => {
                    setSelectedResidential(res);
                    setSelectedCommercial(null);
                  }}
                >
                  {/* Aura pulsante de zona agrupada */}
                  <circle
                    cx={res.mapX}
                    cy={res.mapY}
                    r={radius}
                    fill="url(#residentialZoneGlow)"
                    stroke="#c084fc"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                    className="animate-pulse"
                  />
                  {/* Ponto central indicador de região residencial */}
                  <circle
                    cx={res.mapX}
                    cy={res.mapY}
                    r="8"
                    fill="#9333ea"
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter="url(#pinShadow)"
                  />
                  <text
                    x={res.mapX}
                    y={res.mapY + 3}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="7"
                    fontWeight="bold"
                  >
                    {res.screen_count}
                  </text>
                  <text
                    x={res.mapX}
                    y={res.mapY + radius + 14}
                    textAnchor="middle"
                    fill="#d8b4fe"
                    fontSize="10"
                    fontWeight="bold"
                    className="drop-shadow"
                  >
                    {res.neighborhood}
                  </text>
                  <text
                    x={res.mapX}
                    y={res.mapY + radius + 25}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="8"
                  >
                    {res.screen_count} telas ({Number(res.validated_displays || 0).toLocaleString('pt-BR')} exibições)
                  </text>
                </g>
              );
            })}

          {/* CAMADA 2: Pins de Locais Comerciais Autorizados */}
          {(filterLayer === 'all' || filterLayer === 'commercial') &&
            positionedCommercial.map((pt: any, i: number) => {
              const isTv = pt.screen_type === 'tv';
              const pinColor = isTv ? '#10b981' : '#3b82f6';
              return (
                <g
                  key={`comm-pin-${pt.id || i}`}
                  className="cursor-pointer transition-transform hover:scale-125"
                  style={{ transformOrigin: `${pt.mapX}px ${pt.mapY}px` }}
                  onClick={() => {
                    setSelectedCommercial(pt);
                    setSelectedResidential(null);
                  }}
                >
                  {/* Glow do Pin */}
                  <circle
                    cx={pt.mapX}
                    cy={pt.mapY}
                    r="14"
                    fill={pinColor}
                    fillOpacity="0.25"
                    className="animate-ping"
                  />
                  {/* Pin Base */}
                  <path
                    d={`M ${pt.mapX} ${pt.mapY + 1} C ${pt.mapX - 9} ${pt.mapY - 8} ${pt.mapX - 9} ${pt.mapY - 22} ${pt.mapX} ${pt.mapY - 22} C ${pt.mapX + 9} ${pt.mapY - 22} ${pt.mapX + 9} ${pt.mapY - 8} ${pt.mapX} ${pt.mapY + 1} Z`}
                    fill={pinColor}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    filter="url(#pinShadow)"
                  />
                  {/* Ícone interno (ponto) */}
                  <circle
                    cx={pt.mapX}
                    cy={pt.mapY - 14}
                    r="4"
                    fill="#ffffff"
                  />
                  {/* Rótulo do Estabelecimento */}
                  <text
                    x={pt.mapX}
                    y={pt.mapY - 26}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="bold"
                    className="drop-shadow-md"
                  >
                    {pt.establishment_name}
                  </text>
                </g>
              );
            })}
        </svg>

        {/* Legenda Flutuante */}
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3.5 py-2.5 rounded-2xl shadow-xl space-y-1 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-300 font-semibold">TV Comercial (Local Público)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-slate-300 font-semibold">Monitor Windows Comercial</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span className="text-purple-300 font-semibold">Rede Residencial (Agrupada)</span>
          </div>
        </div>
      </div>

      {/* POPUP INFORMATIVO: Ponto Comercial Selecionado */}
      {selectedCommercial && (
        <div className="p-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                selectedCommercial.screen_type === 'tv'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {selectedCommercial.screen_type === 'tv' ? <Tv className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                {selectedCommercial.screen_type === 'tv' ? 'TV Comercial' : 'Monitor Windows'}
              </span>
              <span className="text-xs text-slate-400">Local Autorizado</span>
            </div>
            <h4 className="text-lg font-black text-white">{selectedCommercial.establishment_name}</h4>
            <p className="text-xs text-slate-300">
              {selectedCommercial.address} · {selectedCommercial.neighborhood}, {selectedCommercial.city}
            </p>
          </div>

          <div className="flex items-center gap-6 sm:text-right">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Exibições Validadas</span>
              <span className="font-mono text-xl font-black text-emerald-400">
                {(selectedCommercial.validated_displays || selectedCommercial.realized || 0).toLocaleString('pt-BR')}
              </span>
              <p className="text-[10px] text-slate-400">
                {selectedCommercial.realized || selectedCommercial.validated_displays} de {selectedCommercial.planned || 1000} ({selectedCommercial.delivery_percent || 100}%)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCommercial(null)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* POPUP INFORMATIVO: Zona Residencial Agrupada Selecionada */}
      {selectedResidential && (
        <div className="p-5 bg-purple-950/30 border-t border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Home className="w-3 h-3" />
                Rede Residencial Agrupada
              </span>
              <span className="text-xs text-purple-300 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                Privacidade 100% Preservada
              </span>
            </div>
            <h4 className="text-lg font-black text-white">Região: {selectedResidential.neighborhood}</h4>
            <p className="text-xs text-slate-300">
              {selectedResidential.city} · Nenhuma residência ou endereço individual é exibido.
            </p>
          </div>

          <div className="flex items-center gap-6 sm:text-right">
            <div>
              <span className="text-[10px] font-bold uppercase text-purple-300 block">Telas no Grupo</span>
              <span className="font-mono text-xl font-black text-white">
                {selectedResidential.screen_count} telas
              </span>
              <p className="text-[10px] text-purple-300">
                {(selectedResidential.validated_displays || 0).toLocaleString('pt-BR')} exibições validadas
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedResidential(null)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
