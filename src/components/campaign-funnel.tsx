'use client';

import React from 'react';
import { Eye, Flame, Ticket, CheckCircle2, TrendingUp, Info } from 'lucide-react';

export interface CampaignFunnelMetrics {
  validated_displays: number;
  interests: number | null;
  coupons_issued: number | null;
  confirmed_visits: number | null;
  display_to_coupon_rate?: number | null;
  coupon_to_visit_rate?: number | null;
  hasFunnelData?: boolean;
}

interface CampaignFunnelProps {
  metrics: CampaignFunnelMetrics;
  campaignTitle?: string;
  showExplanation?: boolean;
}

export function CampaignFunnel({ metrics, campaignTitle, showExplanation = true }: CampaignFunnelProps) {
  const hasConversion = metrics.hasFunnelData && metrics.coupons_issued !== null && metrics.coupons_issued > 0;

  // Formatação de números
  const formatNum = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return Number(val).toLocaleString('pt-BR');
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Funil de Conversão Comercial
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Acompanhamento em 4 etapas: da Exibição Validada na TV até a visita confirmada no estabelecimento.
          </p>
        </div>
        {campaignTitle && (
          <span className="text-xs font-medium px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full">
            {campaignTitle}
          </span>
        )}
      </div>

      {/* 4 Etapas do Funil */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {/* Etapa 1: Exibições Validadas */}
        <div className="flex flex-col p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Etapa 1
            </span>
            <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-2xl font-black text-blue-950 dark:text-blue-100">
            {formatNum(metrics.validated_displays)}
          </span>
          <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 mt-1">
            Exibições Validadas
          </span>
          <span className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-1">
            Transmissões auditadas com Comprovante de Exibição
          </span>
        </div>

        {/* Etapa 2: Interesses / Resgates iniciados */}
        <div className="flex flex-col p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Etapa 2
            </span>
            <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          {metrics.interests !== null ? (
            <>
              <span className="text-2xl font-black text-amber-950 dark:text-amber-100">
                {formatNum(metrics.interests)}
              </span>
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 mt-1">
                Interesses / Resgates iniciados
              </span>
              <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">
                Participantes que clicaram ou visualizaram o benefício
              </span>
            </>
          ) : (
            <div className="my-auto py-2">
              <span className="inline-block px-2.5 py-1 text-xs font-medium bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-md">
                Dado ainda não disponível
              </span>
              <p className="text-[11px] text-zinc-500 mt-1">
                Aguardando interação dos participantes
              </p>
            </div>
          )}
        </div>

        {/* Etapa 3: Cupons Emitidos */}
        <div className="flex flex-col p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
              Etapa 3
            </span>
            <Ticket className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          {metrics.coupons_issued !== null ? (
            <>
              <span className="text-2xl font-black text-purple-950 dark:text-purple-100">
                {formatNum(metrics.coupons_issued)}
              </span>
              <span className="text-xs font-semibold text-purple-800 dark:text-purple-300 mt-1">
                Cupons Emitidos
              </span>
              <span className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-1">
                Cupons gerados com código único e QR Code
              </span>
            </>
          ) : (
            <div className="my-auto py-2">
              <span className="inline-block px-2.5 py-1 text-xs font-medium bg-purple-100/80 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 rounded-md">
                Dado ainda não disponível
              </span>
              <p className="text-[11px] text-zinc-500 mt-1">
                Sem resgate de cupom associado
              </p>
            </div>
          )}
        </div>

        {/* Etapa 4: Visitas Confirmadas */}
        <div className="flex flex-col p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Etapa 4
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          {metrics.confirmed_visits !== null ? (
            <>
              <span className="text-2xl font-black text-emerald-950 dark:text-emerald-100">
                {formatNum(metrics.confirmed_visits)}
              </span>
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mt-1">
                Visitas Confirmadas
              </span>
              <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                Validadas no Caixa ou via Portal de Cupons
              </span>
            </>
          ) : (
            <div className="my-auto py-2">
              <span className="inline-block px-2.5 py-1 text-xs font-medium bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-md">
                Dado ainda não disponível
              </span>
              <p className="text-[11px] text-zinc-500 mt-1">
                Aguardando validação no ponto físico
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Taxas de Conversão */}
      <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              →
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Conversão Exibição → Cupom
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {hasConversion && metrics.display_to_coupon_rate !== null ? (
                  `${metrics.display_to_coupon_rate}%`
                ) : (
                  <span className="text-xs font-medium text-zinc-400">Dado ainda não disponível</span>
                )}
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-8 w-px bg-zinc-200 dark:bg-zinc-700" />

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
              →
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Conversão Cupom → Visita
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {hasConversion && metrics.coupon_to_visit_rate !== null ? (
                  `${metrics.coupon_to_visit_rate}%`
                ) : (
                  <span className="text-xs font-medium text-zinc-400">Dado ainda não disponível</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Nota Explicativa */}
      {showExplanation && (
        <div className="mt-4 flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/30 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
          <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
          <span>
            {hasConversion ? (
              'Os números acima refletem as Exibições Validadas auditadas nas TVs parceiras e o fluxo de resgates gerados e validados no Portal do Caixa da sua empresa.'
            ) : (
              'As Exibições Validadas foram entregues com Comprovante de Exibição. Métricas de resgate de cupom e visitas presenciais serão atualizadas em tempo real à medida que os participantes resgatarem prêmios e apresentarem no caixa.'
            )}
          </span>
        </div>
      )}
    </div>
  );
}
