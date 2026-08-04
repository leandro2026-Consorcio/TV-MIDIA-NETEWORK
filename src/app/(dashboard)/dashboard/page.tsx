'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Building2, Wallet, Tv, Image as ImageIcon, ListVideo, Megaphone, Gift, Clock, Play, AlertCircle, ArrowUpRight, Plus, Loader2 } from 'lucide-react';
import { getOnboardingContextAction } from '@/app/actions/onboarding';
import { TrialStatusCard } from '@/components/trial-status-card';
import { CompactOnboardingCard } from '@/components/compact-onboarding-card';
import { HelpButton } from '@/components/help-button';
import { OnboardingTour } from '@/components/onboarding-tour';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalScreens: 0,
    onlineScreens: 0,
    activeCampaigns: 0,
    activeTrials: 0,
    acceptedInvites: 0,
    todayExecutions: 0,
    todayFailures: 0,
    totalBalance: 0,
    isMaster: false,
  });
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadStats() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await (supabase.from('profiles') as any)
          .select('is_master_admin')
          .eq('id', user.id)
          .single();

        const isMaster = !!profile?.is_master_admin;

        // 1. Quantidade de Empresas
        let companyCount = 0;
        if (isMaster) {
          const { count } = await (supabase.from('companies') as any)
            .select('*', { count: 'exact', head: true });
          companyCount = count || 0;
        } else {
          const { count } = await (supabase.from('company_users') as any)
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_active', true);
          companyCount = count || 0;
        }

        // 2. Quantidade de Telas & Telas Online
        const { count: screenCount } = await (supabase.from('screens') as any)
          .select('*', { count: 'exact', head: true });

        const { count: onlineCount } = await (supabase.from('screens') as any)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'online');

        // 3. Campanhas Ativas
        const { count: activeCampCount } = await (supabase.from('campaigns') as any)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        // 4. Trials Ativos & Convites VIP Aceitos
        const { count: trialCount } = await (supabase.from('company_trials') as any)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        const { count: inviteCount } = await (supabase.from('referral_invites') as any)
          .select('*', { count: 'exact', head: true })
          .in('status', ['accepted', 'converted']);

        // 5. Execuções Hoje & Falhas Hoje (Proof of Play)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { count: execToday } = await (supabase.from('playback_logs') as any)
          .select('*', { count: 'exact', head: true })
          .gte('played_at', todayStart.toISOString());

        const { count: failToday } = await (supabase.from('playback_logs') as any)
          .select('*', { count: 'exact', head: true })
          .gte('played_at', todayStart.toISOString())
          .eq('status', 'failed');

        // 6. Saldo total das carteiras
        const { data: wallets } = await (supabase.from('wallets') as any).select('balance');
        const totalBalance = ((wallets || []) as any[]).reduce((acc, curr) => acc + Number(curr.balance), 0);

        setStats({
          totalCompanies: companyCount,
          totalScreens: screenCount || 0,
          onlineScreens: onlineCount || 0,
          activeCampaigns: activeCampCount || 0,
          activeTrials: trialCount || 0,
          acceptedInvites: inviteCount || 0,
          todayExecutions: execToday || 0,
          todayFailures: failToday || 0,
          totalBalance,
          isMaster,
        });
        if (!isMaster) setOnboarding(await getOnboardingContextAction());
      } catch (err) {
        console.error('Erro ao carregar estatísticas:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {onboarding?.hasCompany && <OnboardingTour autoOpen={
        onboarding.trial?.status === 'active' &&
        !onboarding.progress?.tour_completed_at &&
        !onboarding.progress?.dont_show_again &&
        !onboarding.progress?.tour_seen_at
      } />}
      {onboarding?.trial && <TrialStatusCard trial={onboarding.trial} />}
      {onboarding?.hasCompany && <CompactOnboardingCard context={onboarding} />}
      {onboarding && !onboarding.hasCompany && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex flex-col sm:flex-row justify-between gap-4">
          <div><h2 className="font-bold text-white">Complete seu cadastro empresarial</h2><p className="text-sm text-amber-200/70 mt-1">Vincule sua empresa para liberar TVs, mídias e programações.</p></div>
          <Link href="/empresa/cadastro" className="bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold text-center">Cadastrar empresa</Link>
        </div>
      )}
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-purple-900/40 via-slate-900 to-slate-900 border border-purple-500/20 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-3 border border-purple-500/20">
            MVP 4A — Marketplace Interno e Solicitação de Mídia Active
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Painel de Controle Multi-tenant
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-xl">
            Explore planos comerciais disponíveis em TVs de empresas parceiras no Marketplace Interno e gerencie suas solicitações de mídia.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {onboarding?.hasCompany && <HelpButton />}
          <Link
            href={onboarding?.trial ? '/onboarding' : '/marketplace'}
            className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-5 py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> {onboarding?.trial ? 'Continuar configuração' : 'Explorar Marketplace'}
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Trials em 60 Dias
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">{stats.activeTrials}</div>
          <p className="text-xs text-slate-500 mt-2">Empresas em degustação</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Convites VIP Aceitos
            </span>
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
              <Gift className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-purple-400">{stats.acceptedInvites}</div>
          <p className="text-xs text-slate-500 mt-2">Indicações convertidas</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Execuções Hoje
            </span>
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
              <Play className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-sky-400">{stats.todayExecutions}</div>
          <p className="text-xs text-slate-500 mt-2">Anúncios exibidos hoje</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Saldo de Créditos
            </span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400">
            {stats.totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} CR
          </div>
          <p className="text-xs text-slate-500 mt-2">Movimentação auditável RPC</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h2 className="font-bold text-slate-200 text-base">Ações Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {onboarding?.trial ? (
            <>
              <QuickLink href="/screens/new" label="Adicionar TV" />
              <QuickLink href="/media/new" label="Enviar mídia" />
              <QuickLink href="/playlists/new" label="Criar programação" />
              <QuickLink href="/company/invites" label="Convites VIP" />
            </>
          ) : (
          <>
          <Link
            href="/marketplace"
            className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition flex items-center justify-between text-sm font-medium text-slate-200"
          >
            <span>Marketplace de Mídia</span>
            <ArrowUpRight className="w-4 h-4 text-slate-500" />
          </Link>

          <Link
            href="/media-requests"
            className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition flex items-center justify-between text-sm font-medium text-slate-200"
          >
            <span>Solicitações de Mídia</span>
            <ArrowUpRight className="w-4 h-4 text-slate-500" />
          </Link>

          <Link
            href="/ad-offers"
            className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition flex items-center justify-between text-sm font-medium text-slate-200"
          >
            <span>Meus Planos de Mídia</span>
            <ArrowUpRight className="w-4 h-4 text-slate-500" />
          </Link>

          <Link
            href="/wallet"
            className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition flex items-center justify-between text-sm font-medium text-slate-200"
          >
            <span>Carteira de Créditos</span>
            <ArrowUpRight className="w-4 h-4 text-slate-500" />
          </Link>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition flex items-center justify-between text-sm font-medium text-slate-200"><span>{label}</span><ArrowUpRight className="w-4 h-4 text-slate-500" /></Link>;
}
