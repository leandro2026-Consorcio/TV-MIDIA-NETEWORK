'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Wallet,
  ShieldCheck,
  Receipt,
  Building2,
  DollarSign,
  Package,
  PlusCircle,
  Clock,
  Send
} from 'lucide-react';

interface FinancialSubnavProps {
  isMasterAdmin?: boolean;
}

export function FinancialSubnav({ isMasterAdmin = true }: FinancialSubnavProps) {
  const pathname = usePathname();

  const mainTabs = isMasterAdmin
    ? [
        { name: 'Visão Geral', href: '/admin/financial-reports', icon: BarChart3 },
        { name: 'Carteira & Créditos', href: '/wallet', icon: Wallet },
        { name: 'Cobranças Asaas', href: '/admin/asaas-reconciliation', icon: ShieldCheck },
        { name: 'Repasses', href: '/seller-statement', icon: Receipt },
        { name: 'Contas de Recebimento', href: '/admin/seller-financial-profiles', icon: Building2 },
        { name: 'Payout', href: '/admin/seller-payouts', icon: DollarSign },
      ]
    : [
        { name: 'Carteira & Créditos', href: '/wallet', icon: Wallet },
        { name: 'Extrato & Repasses', href: '/seller-statement', icon: Receipt },
        { name: 'Meu Perfil Bancário', href: '/seller-financial-profile', icon: Building2 },
        { name: 'Simulação Payout', href: '/seller-payouts', icon: DollarSign },
      ];

  // Identificar aba ativa principal
  const isTabActive = (href: string) => {
    if (href === '/admin/financial-reports') return pathname === '/admin/financial-reports';
    if (href === '/wallet') return pathname === '/wallet' || pathname === '/credit-packages' || pathname === '/admin/credits';
    if (href === '/admin/asaas-reconciliation') return pathname === '/admin/asaas-reconciliation';
    if (href === '/seller-statement') return pathname === '/seller-statement' || pathname === '/seller-payout-history';
    if (href === '/admin/seller-financial-profiles') return pathname === '/admin/seller-financial-profiles' || pathname === '/seller-financial-profile';
    if (href === '/admin/seller-payouts') return pathname === '/admin/seller-payouts' || pathname === '/admin/seller-payout-transfers' || pathname === '/seller-payouts';
    return pathname.startsWith(href);
  };

  return (
    <div className="space-y-3 mb-6">
      {/* Abas Principais do Módulo Financeiro */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                active
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Pílulas de Sub-Rotas / Ações Correlatas */}
      {isMasterAdmin && (
        <div className="flex items-center gap-2 text-xs flex-wrap text-slate-400 pt-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Acesso Rápido:</span>
          <Link
            href="/credit-packages"
            className={`px-2.5 py-1 rounded-lg transition ${
              pathname === '/credit-packages'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            Pacotes de Crédito
          </Link>
          <span className="text-slate-700">·</span>
          <Link
            href="/admin/credits"
            className={`px-2.5 py-1 rounded-lg transition ${
              pathname === '/admin/credits'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            Atribuição de Créditos
          </Link>
          <span className="text-slate-700">·</span>
          <Link
            href="/seller-payout-history"
            className={`px-2.5 py-1 rounded-lg transition ${
              pathname === '/seller-payout-history'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            Histórico Repasses
          </Link>
          <span className="text-slate-700">·</span>
          <Link
            href="/admin/seller-payout-transfers"
            className={`px-2.5 py-1 rounded-lg transition ${
              pathname === '/admin/seller-payout-transfers'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            Transferências Payout
          </Link>
          <span className="text-slate-700">·</span>
          <Link
            href="/seller-payouts"
            className={`px-2.5 py-1 rounded-lg transition ${
              pathname === '/seller-payouts'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            Simulação de Payout
          </Link>
        </div>
      )}
    </div>
  );
}
