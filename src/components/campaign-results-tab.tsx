'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, CheckCircle2, Eye, Award, 
  Layers, AlertCircle, Loader2, ArrowRight
} from 'lucide-react';
import { CampaignFunnel } from './campaign-funnel';
import { getAdDistributionLocationsAction } from '@/app/actions/organic-benefits';

interface CampaignResultsTabProps {
  campaignId: string;
  campaign: any;
  ledger?: any;
}

export function CampaignResultsTab({ campaignId, campaign, ledger }: CampaignResultsTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      const res = await getAdDistributionLocationsAction({ campaignId });
      if (res.success) {
        setReport(res.report);
      } else {
        setError(res.error || 'Erro ao carregar métricas de resultado.');
      }
      setLoading(false);
    }
    loadData();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const summary = report?.summary || {
    total_validated_displays: ledger?.credits_delivered || campaign?.target_insertions || 0,
    target_displays: ledger?.credits_contracted || campaign?.target_insertions || 1000,
    executed_percent: 0,
    commercial_screens: 0,
    residential_screens: 0,
  };

  const targetDisplays = ledger?.credits_contracted || campaign?.target_insertions || summary.target_displays || 1000;
  const executedDisplays = summary.total_validated_displays || ledger?.credits_delivered || 0;
  const percentExecuted = targetDisplays > 0 ? Math.min(100, Math.round((executedDisplays / targetDisplays) * 100)) : 0;

  const funnelMetrics = report?.funnel || {
    validated_displays: executedDisplays,
    interests: null,
    coupons_issued: null,
    confirmed_visits: null,
    display_to_coupon_rate: null,
    coupon_to_visit_rate: null,
    hasFunnelData: false,
  };

  return (
    <div className="space-y-6">
      {/* 1. Visão Geral da Meta e Entrega */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Desempenho Comercial & Auditoria
            </span>
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
              Resultados da Campanha: {campaign.name}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Acompanhamento de entrega técnica em tempo real com comprovação criptográfica.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {percentExecuted >= 100 ? 'Meta 100% Concluída' : `${percentExecuted}% da Meta Atingida`}
            </span>
          </div>
        </div>

        {/* KPIs de Entrega */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Meta Contratada / Planejada
            </span>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
              {targetDisplays.toLocaleString('pt-BR')}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Exibições Validadas previstas
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
              Exibições Validadas Entregues
            </span>
            <div className="text-2xl font-black text-blue-950 dark:text-blue-100 mt-1">
              {executedDisplays.toLocaleString('pt-BR')}
            </div>
            <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-1">
              Comprovadas via Comprovante de Exibição
            </p>
          </div>

          <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block">
              Telas com Exibição Auditada
            </span>
            <div className="text-2xl font-black text-purple-950 dark:text-purple-100 mt-1">
              {(summary.commercial_screens + summary.residential_screens).toLocaleString('pt-BR')}
            </div>
            <p className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-1">
              {summary.commercial_screens} comerciais · {summary.residential_screens} residenciais
            </p>
          </div>
        </div>

        {/* Barra de Progresso da Meta */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
            <span>Progresso da Meta Contratada</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{percentExecuted}%</span>
          </div>
          <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, percentExecuted)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Funil Visual da Campanha */}
      <CampaignFunnel 
        metrics={funnelMetrics}
        campaignTitle={campaign.name}
      />
    </div>
  );
}
