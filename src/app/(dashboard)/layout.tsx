'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Profile, Company } from '@/types';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { OnboardingProgressBar } from '@/components/onboarding-progress-bar';
import { Loader2, ShieldAlert } from 'lucide-react';
import { DashboardCompanyProvider } from '@/contexts/dashboard-company-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [isOrganicOnly, setIsOrganicOnly] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [dismissPasswordAlert, setDismissPasswordAlert] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    async function loadUserData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        setMustChangePassword(Boolean(user?.user_metadata?.must_change_password || user?.user_metadata?.initial_password));

        // 1. Carregar Profile do Usuário
        const { data: profileData } = await (supabase.from('profiles') as any)
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setProfile(profileData as Profile);
        }

        // 2. Carregar Roles e Afiliações
        const [{ data: creatorData }, { data: affiliateData }, { data: organicData }] = await Promise.all([
          (supabase.from('creator_profiles') as any).select('id, status').eq('user_id', user.id).maybeSingle(),
          (supabase.from('affiliate_profiles') as any).select('id, role, status').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
          (supabase.from('organic_participants') as any).select('id, status').eq('user_id', user.id).maybeSingle(),
        ]);

        setIsCreator(Boolean(creatorData?.id));
        setIsLeader(Boolean(affiliateData?.role === 'leader'));
        setIsOrganicOnly(Boolean(organicData?.id));

        // 3. Carregar Empresas Acessíveis
        let companiesQuery;
        if (profileData?.is_master_admin) {
          companiesQuery = (supabase.from('companies') as any).select('*').order('trade_name');
        } else {
          // Busca IDs das empresas do usuário via company_users
          const { data: companyUserRows } = await (supabase.from('company_users') as any)
            .select('company_id')
            .eq('user_id', user.id)
            .eq('is_active', true);

          const companyIds = ((companyUserRows || []) as any[]).map((r) => r.company_id);

          if (companyIds.length > 0) {
            companiesQuery = (supabase.from('companies') as any)
              .select('*')
              .in('id', companyIds)
              .order('trade_name');
          }
        }

        if (companiesQuery) {
          const { data: companyList } = await companiesQuery;
          if (companyList && companyList.length > 0) {
            setCompanies(companyList as Company[]);
            const savedCompanyId = window.sessionStorage.getItem('mpm.activeCompanyId');
            const selectedCompany = (companyList as Company[]).find((company) => company.id === savedCompanyId)
              || companyList[0] as Company;
            setActiveCompany(selectedCompany);
            if (!profileData?.is_master_admin) {
              const { data: trial } = await (supabase.from('company_trials') as any)
                .select('status')
                .eq('company_id', selectedCompany.id)
                .in('status', ['active', 'expired', 'cancelled'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              const hasTrial = !!trial;
              setIsTrial(hasTrial);

              if (hasTrial) {
                const allowedTrialRoutes = [
                  '/dashboard',
                  '/screens',
                  '/media',
                  '/playlists',
                  '/campaigns',
                  '/company/invites',
                  '/company/content-sources',
                  '/network-settings',
                  '/playback-logs',
                  '/onboarding',
                  '/plans',
                  '/help/getting-started',
                  '/benefits',
                  '/reset-password',
                ];
                const isAllowed = allowedTrialRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
                if (!isAllowed) router.replace('/dashboard');
              }
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [pathname, router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <span className="text-sm font-medium text-slate-400">Carregando painel SaaS...</span>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen max-w-full bg-slate-950 text-slate-100 flex">
      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 shadow-2xl h-full">
            <Sidebar
              isMasterAdmin={Boolean(profile.is_master_admin)}
              hasCompany={companies.length > 0}
              isTrial={isTrial}
              isCreator={isCreator}
              isLeader={isLeader}
              isOrganicOnly={isOrganicOnly && companies.length === 0}
              onClose={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Sidebar Fixo Desktop */}
      <div className="hidden md:block shrink-0">
        <Sidebar
          isMasterAdmin={Boolean(profile.is_master_admin)}
          hasCompany={companies.length > 0}
          isTrial={isTrial}
          isCreator={isCreator}
          isLeader={isLeader}
          isOrganicOnly={isOrganicOnly && companies.length === 0}
        />
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          profile={profile}
          companies={companies}
          activeCompany={activeCompany}
          onSelectCompany={(company) => {
            setActiveCompany(company);
            window.sessionStorage.setItem('mpm.activeCompanyId', company.id);
          }}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <main className="min-w-0 p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
          <OnboardingProgressBar />
          {mustChangePassword && !dismissPasswordAlert && pathname !== '/reset-password' && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400 shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Segurança da Conta: Troca de Senha Recomendada</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Sua conta está utilizando a senha inicial padrão (<code className="bg-amber-950/60 px-1.5 py-0.5 rounded font-mono text-amber-200">midiapormidia@123</code>). Crie uma senha pessoal exclusiva para proteger seus acessos.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <Link
                  href="/reset-password"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition shadow-md shadow-amber-500/10 whitespace-nowrap"
                >
                  Alterar Senha Agora
                </Link>
                <button
                  type="button"
                  onClick={() => setDismissPasswordAlert(true)}
                  className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 transition"
                >
                  Dispensar
                </button>
              </div>
            </div>
          )}
          <DashboardCompanyProvider activeCompany={activeCompany}>
            {children}
          </DashboardCompanyProvider>
        </main>
      </div>
    </div>
  );
}
