'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Tv,
  Image as ImageIcon,
  ListVideo,
  Megaphone,
  Gift,
  Play,
  Wallet,
  CreditCard,
  Sliders,
  Settings2,
  Layers,
  Tag,
  ShoppingCart,
  Store,
  Inbox,
  CheckSquare,
  Package,
  PlusCircle,
  ShieldAlert,
  LogOut,
  Receipt,
  DollarSign,
  Network,
  MonitorPlay,
  ShieldCheck,
  FileText,
  Newspaper,
  Rss,
  KeyRound,
  CircleHelp,
  Sparkles,
  Share2,
  BarChart3,
  Users,
  ChevronDown,
  ChevronRight,
  X,
  ExternalLink,
  ChevronUp
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type UserRolePerspective = 'master' | 'company' | 'creator' | 'leader' | 'organic';

interface NavSubItem {
  name: string;
  href: string;
  badge?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
  badgeType?: 'warning' | 'info' | 'success';
  external?: boolean;
  subItems?: NavSubItem[];
}

interface NavGroup {
  id: string;
  title: string;
  icon?: any;
  items: NavItem[];
}

interface SidebarProps {
  isMasterAdmin: boolean;
  hasCompany: boolean;
  isTrial: boolean;
  isCreator?: boolean;
  isLeader?: boolean;
  isOrganicOnly?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  isMasterAdmin,
  hasCompany,
  isTrial,
  isCreator = false,
  isLeader = false,
  isOrganicOnly = false,
  onClose
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // Determinar perspectiva inicial padrão
  const defaultPerspective: UserRolePerspective = useMemo(() => {
    if (isMasterAdmin) return 'master';
    if (isLeader) return 'leader';
    if (isCreator && !hasCompany) return 'creator';
    if (hasCompany) return 'company';
    if (isOrganicOnly) return 'organic';
    return 'company';
  }, [isMasterAdmin, isLeader, isCreator, hasCompany, isOrganicOnly]);

  const [activePerspective, setActivePerspective] = useState<UserRolePerspective>(defaultPerspective);

  // Grupos abertos
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Subitens expandidos
  const [expandedSubItems, setExpandedSubItems] = useState<Record<string, boolean>>({});

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleItemClick = () => {
    if (onClose) {
      onClose();
    }
  };

  // 1. Definição dos Grupos para MASTER ADMIN (7 Grupos Coesos)
  const masterGroups: NavGroup[] = useMemo(() => [
    {
      id: 'inicio',
      title: 'INÍCIO',
      icon: LayoutDashboard,
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Ecossistema MPM', href: '/ecosystem', icon: BarChart3 },
        { name: 'Central de Operações', href: '/admin/mpm', icon: Sliders },
      ]
    },
    {
      id: 'rede-telas',
      title: 'REDE & TELAS',
      icon: Tv,
      items: [
        { name: 'Empresas', href: '/companies', icon: Building2 },
        { name: 'TVs & Telas', href: '/screens', icon: Tv },
        {
          name: 'Rede Orgânica',
          href: '/organic',
          icon: MonitorPlay,
          subItems: [
            { name: 'Prêmios da Rede Orgânica', href: '/organic-rewards' },
            { name: 'Gestão de Benefícios', href: '/admin/organic-benefits' },
          ]
        },
        { name: 'Inventário da Rede', href: '/network-inventory', icon: Layers },
        { name: 'Preferências da Rede', href: '/network-settings', icon: Settings2 },
        { name: 'Comprovantes de Exibição', href: '/playback-logs', icon: Play },
        { name: 'Políticas da Rede', href: '/admin/credit-policies', icon: Sliders },
      ]
    },
    {
      id: 'midia-campanhas',
      title: 'MÍDIA & CAMPANHAS',
      icon: Megaphone,
      items: [
        {
          name: 'Marketplace',
          href: '/marketplace',
          icon: Store,
          subItems: [
            { name: 'Solicitações de Mídia', href: '/media-requests' },
            { name: 'Pedidos de Mídia', href: '/ad-offer-orders' },
            { name: 'Planos de Mídia', href: '/ad-offers' },
            { name: 'Revisão de Ofertas (Admin)', href: '/admin/ad-offers' },
          ]
        },
        { name: 'Campanhas', href: '/campaigns', icon: Megaphone },
        { name: 'Biblioteca de Mídias', href: '/media', icon: ImageIcon },
        { name: 'Playlists', href: '/playlists', icon: ListVideo },
        { name: 'Categorias de Conteúdo', href: '/admin/content-categories', icon: Tag },
        { name: 'Fontes RSS', href: '/admin/content-sources', icon: Rss },
      ]
    },
    {
      id: 'creators-expansao',
      title: 'CREATORS & EXPANSÃO',
      icon: Sparkles,
      items: [
        { name: 'Creators', href: '/creator', icon: Sparkles },
        { name: 'Líderes', href: '/leader', icon: Users },
        { name: 'Planos de Expansão', href: '/admin/mpm/expansion', icon: Network },
        { name: 'Ativações', href: '/onboarding', icon: CheckSquare },
        {
          name: 'Convites / Indicações',
          href: '/trials',
          icon: Gift,
          subItems: [
            { name: 'Convites VIP', href: '/company/invites' }
          ]
        },
      ]
    },
    {
      id: 'financeiro',
      title: 'FINANCEIRO',
      icon: Wallet,
      items: [
        { name: 'Visão Financeira', href: '/admin/financial-reports', icon: BarChart3 },
        {
          name: 'Carteira & Créditos',
          href: '/wallet',
          icon: Wallet,
          subItems: [
            { name: 'Pacotes de Crédito', href: '/credit-packages' },
            { name: 'Atribuição de Créditos', href: '/admin/credits' },
          ]
        },
        { name: 'Cobranças & Asaas', href: '/admin/asaas-reconciliation', icon: ShieldCheck },
        {
          name: 'Repasses',
          href: '/seller-statement',
          icon: Receipt,
          subItems: [
            { name: 'Histórico de Repasses', href: '/seller-payout-history' },
          ]
        },
        {
          name: 'Contas de Recebimento',
          href: '/admin/seller-financial-profiles',
          icon: Building2,
          subItems: [
            { name: 'Cadastro Financeiro', href: '/seller-financial-profile' },
          ]
        },
        {
          name: 'Payout',
          href: '/admin/seller-payouts',
          icon: DollarSign,
          subItems: [
            { name: 'Transferências Payout (Master)', href: '/admin/seller-payout-transfers' },
            { name: 'Simulação de Payout', href: '/seller-payouts' },
          ]
        },
      ]
    },
    {
      id: 'administracao',
      title: 'ADMINISTRAÇÃO',
      icon: ShieldAlert,
      items: [
        { name: 'Configurações da Plataforma', href: '/admin/platform-settings', icon: Sliders },
        {
          name: 'Integrações Sociais',
          href: '/creator',
          icon: Sparkles,
          badge: 'Meta pendente',
          badgeType: 'warning'
        },
        {
          name: 'Vitrine Pública',
          href: '/onde-anunciar',
          icon: Store,
          subItems: [
            { name: 'Ver Vitrine Pública ao vivo', href: '/' }
          ]
        },
        {
          name: 'Termos & Conformidade',
          href: '/admin/terms',
          icon: FileText,
          subItems: [
            { name: 'Conformidade da Empresa', href: '/company-compliance' }
          ]
        },
        { name: 'Biblioteca Informativa', href: '/admin/informative-content', icon: Newspaper },
        { name: 'Logs de Auditoria', href: '/audit-logs', icon: ShieldAlert },
      ]
    },
    {
      id: 'ajuda-conta',
      title: 'AJUDA & CONTA',
      icon: CircleHelp,
      items: [
        { name: 'Central de Ajuda', href: '/help/getting-started', icon: CircleHelp },
        { name: 'Segurança da Conta', href: '/admin/account-security', icon: KeyRound },
      ]
    }
  ], []);

  // 2. Definição para EMPRESA
  const companyGroups: NavGroup[] = useMemo(() => [
    {
      id: 'principal-empresa',
      title: 'MENU EMPRESA',
      items: [
        { name: 'Início', href: '/dashboard', icon: LayoutDashboard },
        {
          name: 'Minhas TVs',
          href: '/screens',
          icon: Tv,
          subItems: [
            { name: 'Lista de TVs', href: '/screens' },
            { name: 'Conteúdo Informativo', href: '/company/content-sources' },
            { name: 'Preferências de Rede', href: '/network-settings' },
          ]
        },
        {
          name: 'Minha Mídia',
          href: '/media',
          icon: ImageIcon,
          subItems: [
            { name: 'Playlists de Vídeo', href: '/playlists' },
          ]
        },
        {
          name: 'Benefícios & Prêmios',
          href: '/benefits',
          icon: Gift,
          subItems: [
            { name: 'Meus Benefícios', href: '/benefits' },
            { name: 'Cadastrar Benefício', href: '/benefits/new' },
            { name: 'Cupons & Resgates', href: '/benefits/coupons' },
            { name: 'Divulgação Gerada', href: '/benefits/media' },
          ]
        },
        {
          name: 'Marketplace',
          href: '/marketplace',
          icon: Store,
          subItems: [
            { name: 'Solicitações Recebidas', href: '/media-requests' },
            { name: 'Meus Planos & Ofertas', href: '/ad-offers' },
            { name: 'Pedidos de Mídia', href: '/ad-offer-orders' },
          ]
        },
        { name: 'Minhas Campanhas', href: '/campaigns', icon: Megaphone },
        { name: 'Redes Sociais', href: '/company/social', icon: Share2 },
        { name: 'Convites VIP', href: '/company/invites', icon: Gift },
        { name: 'Meu Plano', href: '/plans', icon: CreditCard },
        {
          name: 'Carteira & Créditos',
          href: '/wallet',
          icon: Wallet,
          subItems: [
            { name: 'Extrato Financeiro', href: '/seller-statement' },
            { name: 'Cadastro Bancário', href: '/seller-financial-profile' },
          ]
        },
        { name: 'Ajuda', href: '/help/getting-started', icon: CircleHelp },
        { name: 'Segurança da Conta', href: '/admin/account-security', icon: KeyRound },
      ]
    }
  ], []);

  // 3. Definição para CREATOR
  const creatorGroups: NavGroup[] = useMemo(() => [
    {
      id: 'principal-creator',
      title: 'MENU CREATOR',
      items: [
        { name: 'Início (Painel Creator)', href: '/creator', icon: Sparkles },
        { name: 'Campanhas & Propostas', href: '/creator', icon: Megaphone },
        { name: 'Marketplace de Creators', href: '/marketplace', icon: Store },
        { name: 'Programa de Expansão', href: '/creator', icon: Network },
        { name: 'Comissões & Extrato', href: '/seller-statement', icon: Receipt },
        { name: 'Meu Perfil & Preços', href: '/creator', icon: Building2 },
        { name: 'Ajuda & Onboarding', href: '/help/getting-started', icon: CircleHelp },
      ]
    }
  ], []);

  // 4. Definição para LÍDER MPM
  const leaderGroups: NavGroup[] = useMemo(() => [
    {
      id: 'principal-lider',
      title: 'LÍDER MPM',
      items: [
        { name: 'Início (Painel Líder)', href: '/leader', icon: Users },
        { name: 'Minha Equipe', href: '/leader', icon: Users },
        { name: 'Comissões de Expansão', href: '/seller-statement', icon: Receipt },
        { name: 'Ajuda', href: '/help/getting-started', icon: CircleHelp },
      ]
    }
  ], []);

  // 5. Definição para REDE ORGÂNICA / PESSOA FÍSICA
  const organicGroups: NavGroup[] = useMemo(() => [
    {
      id: 'principal-organico',
      title: 'REDE ORGÂNICA',
      items: [
        { name: 'Início', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Minhas Telas', href: '/screens', icon: Tv },
        { name: 'Rede Orgânica', href: '/organic', icon: MonitorPlay },
        { name: 'Créditos & Benefícios', href: '/wallet', icon: Wallet },
        { name: 'Prêmios Orgânicos', href: '/organic-rewards', icon: Gift },
        { name: 'Ajuda', href: '/help/getting-started', icon: CircleHelp },
      ]
    }
  ], []);

  // Seleciona os grupos ativos baseado na perspectiva
  const activeGroups: NavGroup[] = useMemo(() => {
    switch (activePerspective) {
      case 'master':
        return masterGroups;
      case 'company':
        return companyGroups;
      case 'creator':
        return creatorGroups;
      case 'leader':
        return leaderGroups;
      case 'organic':
        return organicGroups;
      default:
        return masterGroups;
    }
  }, [activePerspective, masterGroups, companyGroups, creatorGroups, leaderGroups, organicGroups]);

  // Expandir automaticamente o grupo que contém a rota atual
  useEffect(() => {
    let matchedGroupId: string | null = null;
    let matchedSubitemHref: string | null = null;

    for (const group of activeGroups) {
      for (const item of group.items) {
        if (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) {
          matchedGroupId = group.id;
        }
        if (item.subItems) {
          for (const sub of item.subItems) {
            if (pathname === sub.href || pathname.startsWith(sub.href)) {
              matchedGroupId = group.id;
              matchedSubitemHref = item.href;
            }
          }
        }
      }
    }

    if (matchedGroupId) {
      setOpenGroups((prev) => {
        // No mobile (drawer com onClose), manter apenas 1 grupo aberto
        if (onClose) {
          return { [matchedGroupId!]: true };
        }
        return { ...prev, [matchedGroupId!]: true };
      });
    }

    if (matchedSubitemHref) {
      setExpandedSubItems((prev) => ({ ...prev, [matchedSubitemHref!]: true }));
    }
  }, [pathname, activeGroups, onClose]);

  // Alternar grupo
  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const isCurrentlyOpen = Boolean(prev[groupId]);
      if (onClose) {
        // Mobile accordion: só 1 aberto por vez
        return isCurrentlyOpen ? {} : { [groupId]: true };
      }
      return {
        ...prev,
        [groupId]: !isCurrentlyOpen,
      };
    });
  };

  // Alternar subitens
  const toggleSubItem = (href: string) => {
    setExpandedSubItems((prev) => ({
      ...prev,
      [href]: !prev[href],
    }));
  };

  return (
    <aside className="w-64 sm:w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30 select-none">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-xl text-white shadow-md shadow-purple-600/30">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-white tracking-tight leading-none text-sm sm:text-base">Mídia por Mídia</h1>
              <span className="text-[11px] font-semibold text-purple-400">Rede Omnichannel MPM</span>
            </div>
          </div>

          {/* Botão de Fechar no Mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Seletor de Perspectiva (Master Admin & Usuários Híbridos) */}
        {isMasterAdmin ? (
          <div className="p-3 bg-slate-950/60 border-b border-slate-800/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visualização:</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                Master Admin
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {(['master', 'company', 'creator', 'leader', 'organic'] as UserRolePerspective[]).map((role) => (
                <button
                  key={role}
                  onClick={() => setActivePerspective(role)}
                  className={`py-1 rounded-lg text-[10px] font-bold transition text-center capitalize ${
                    activePerspective === role
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title={`Alternar visão para ${role}`}
                >
                  {role === 'master' ? 'Master' : role === 'company' ? 'Empresa' : role === 'creator' ? 'Creator' : role === 'leader' ? 'Líder' : 'Org'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400 text-[11px]">Perfil:</span>
            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[11px] font-bold capitalize">
              {activePerspective === 'company' ? 'Empresa Anunciante' : activePerspective === 'creator' ? 'Creator' : activePerspective === 'leader' ? 'Líder MPM' : 'Rede Orgânica'}
            </span>
          </div>
        )}

        {/* Grupos e Links de Navegação */}
        <nav className="p-3 space-y-1.5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {activeGroups.map((group) => {
            const isOpen = Boolean(openGroups[group.id] ?? true);
            const GroupIcon = group.icon;

            return (
              <div key={group.id} className="rounded-xl overflow-hidden">
                {/* Cabeçalho do Grupo (Recolhível) */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    {GroupIcon && <GroupIcon className="w-3.5 h-3.5 text-purple-400/80" />}
                    <span className="tracking-wider uppercase">{group.title}</span>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-transform" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-transform" />
                  )}
                </button>

                {/* Conteúdo do Grupo */}
                {isOpen && (
                  <div className="mt-1 space-y-0.5 pl-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href || (item.href !== '/dashboard' && item.href !== '/' && pathname.startsWith(item.href));
                      const hasSub = Boolean(item.subItems && item.subItems.length > 0);
                      const isSubExpanded = Boolean(expandedSubItems[item.href]);

                      return (
                        <div key={item.name} className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Link
                              href={item.href}
                              onClick={handleItemClick}
                              className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                                isActive
                                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20 font-bold'
                                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                <span className="truncate">{item.name}</span>
                              </div>

                              {item.badge && (
                                <span
                                  className={`ml-1 px-1.5 py-0.2 text-[9px] font-black rounded uppercase tracking-wider shrink-0 ${
                                    item.badgeType === 'warning'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : 'bg-purple-500/20 text-purple-300'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </Link>

                            {/* Botão de Toggle de Subitens se existirem */}
                            {hasSub && (
                              <button
                                type="button"
                                onClick={() => toggleSubItem(item.href)}
                                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                                title="Ver páginas relacionadas"
                              >
                                {isSubExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Subitens da Rota */}
                          {hasSub && isSubExpanded && (
                            <div className="ml-5 pl-2 border-l border-slate-800 space-y-0.5 py-1">
                              {item.subItems!.map((sub) => {
                                const isSubActive = pathname === sub.href;
                                return (
                                  <Link
                                    key={sub.name}
                                    href={sub.href}
                                    onClick={handleItemClick}
                                    className={`block px-2.5 py-1.5 rounded-lg text-[11px] transition-colors truncate ${
                                      isSubActive
                                        ? 'bg-purple-500/20 text-purple-300 font-bold border-l-2 border-purple-500'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                    }`}
                                  >
                                    {sub.name}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer / Alterar Senha & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 space-y-1">
        <Link
          href="/reset-password"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
        >
          <KeyRound className="w-3.5 h-3.5 text-sky-400" />
          <span>Alterar Minha Senha</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair da Conta</span>
        </button>
      </div>
    </aside>
  );
}
