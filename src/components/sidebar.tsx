'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Send,
  Share2,
  Network,
  MonitorPlay,
  ShieldCheck,
  Crown,
  FileText,
  Newspaper,
  Rss,
  KeyRound,
  CircleHelp,
  Sparkles,
  BarChart3,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface SidebarProps {
  isMasterAdmin: boolean;
  hasCompany: boolean;
  isTrial: boolean;
}

export function Sidebar({ isMasterAdmin, hasCompany, isTrial }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  let navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Rede Orgânica',
      href: '/organic',
      icon: MonitorPlay,
    },
    {
      name: 'Marketplace de Mídia',
      href: '/marketplace',
      icon: Store,
    },
    {
      name: 'Solicitações de Mídia',
      href: '/media-requests',
      icon: Inbox,
    },
    {
      name: 'Empresas',
      href: '/companies',
      icon: Building2,
    },
    {
      name: 'TVs & Telas',
      href: '/screens',
      icon: Tv,
    },
    {
      name: 'Biblioteca de Mídias',
      href: '/media',
      icon: ImageIcon,
    },
    {
      name: 'Playlists',
      href: '/playlists',
      icon: ListVideo,
    },
    {
      name: 'Campanhas Internas',
      href: '/campaigns',
      icon: Megaphone,
    },
    {
      name: 'Extrato Financeiro',
      href: '/seller-statement',
      icon: Receipt,
    },
    {
      name: 'Trial & Convites VIP',
      href: '/trials',
      icon: Gift,
    },
    {
      name: 'Proof of Play (Logs)',
      href: '/playback-logs',
      icon: Play,
    },
    {
      name: 'Carteira & Créditos',
      href: '/wallet',
      icon: Wallet,
    },
    {
      name: 'Ecossistema MPM',
      href: '/ecosystem',
      icon: BarChart3,
    },
    {
      name: 'Creator MPM',
      href: '/creator',
      icon: Sparkles,
    },
    {
      name: 'Líder MPM',
      href: '/leader',
      icon: Users,
    },
    {
      name: 'Inventário Cedido',
      href: '/network-inventory',
      icon: Layers,
    },
    {
      name: 'Cadastro Financeiro',
      href: '/seller-financial-profile',
      icon: CreditCard,
    },
    {
      name: 'Simulação de Payout',
      href: '/seller-payouts',
      icon: DollarSign,
    },
    {
      name: 'Histórico de Repasses',
      href: '/seller-payout-history',
      icon: Receipt,
    },
    {
      name: 'Conformidade & Termos',
      href: '/company-compliance',
      icon: ShieldCheck,
    },
    {
      name: 'Preferências da Rede',
      href: '/network-settings',
      icon: Settings2,
    },
    {
      name: 'Meus Planos de Mídia',
      href: '/ad-offers',
      icon: Tag,
    },
    {
      name: 'Pedidos de Mídia',
      href: '/ad-offer-orders',
      icon: ShoppingCart,
    },
    {
      name: 'Brindes da Rede Orgânica',
      href: '/organic-rewards',
      icon: Gift,
    },
  ];

  if (!isMasterAdmin && !hasCompany) {
    navItems = [
      navItems[0],
      navItems[1],
      { name: 'Completar cadastro', href: '/empresa/cadastro', icon: Building2 },
    ];
  } else if (!isMasterAdmin && isTrial) {
    const trialRoutes = new Set([
      '/dashboard', '/organic', '/screens', '/media', '/playlists', '/campaigns',
    ]);
    navItems = navItems.filter((item) => trialRoutes.has(item.href));
    navItems.push(
      { name: 'Empresas da Rede', href: '/network/companies', icon: Building2 },
      { name: 'Convites VIP', href: '/company/invites', icon: Gift },
      { name: 'Primeiros passos', href: '/onboarding', icon: CheckSquare },
      { name: 'Planos & atendimento', href: '/plans', icon: CreditCard },
    );
  }

  if (hasCompany && !navItems.some((item) => item.href === '/help/getting-started')) {
    navItems.push({ name: 'Central de Ajuda', href: '/help/getting-started', icon: CircleHelp });
  }

  if (isMasterAdmin) {
    navItems.push(
      {
        name: 'Segurança da Conta',
        href: '/admin/account-security',
        icon: KeyRound,
      },
      {
        name: 'Configurações da Plataforma',
        href: '/admin/platform-settings',
        icon: Sliders,
      },
      {
        name: 'Operação MPM',
        href: '/admin/mpm',
        icon: BarChart3,
      },
      {
        name: 'Planos de Expansão',
        href: '/admin/mpm/expansion',
        icon: Network,
      },
      {
        name: 'Categorias de Conteúdo',
        href: '/admin/content-categories',
        icon: Tag,
      },
      {
        name: 'Biblioteca Informativa',
        href: '/admin/informative-content',
        icon: Newspaper,
      },
      {
        name: 'Fontes RSS',
        href: '/admin/content-sources',
        icon: Rss,
      },
      {
        name: 'Transferências Payout (Master)',
        href: '/admin/seller-payout-transfers',
        icon: Receipt,
      },
      {
        name: 'Elegibilidade Payout (Master)',
        href: '/admin/seller-payouts',
        icon: DollarSign,
      },
      {
        name: 'Perfis Financeiros Exibidores',
        href: '/admin/seller-financial-profiles',
        icon: Building2,
      },
      {
        name: 'Conciliação Asaas',
        href: '/admin/asaas-reconciliation',
        icon: ShieldCheck,
      },
      {
        name: 'Financeiro da Plataforma',
        href: '/admin/financial-reports',
        icon: DollarSign,
      },
      {
        name: 'Gestão de Termos de Uso',
        href: '/admin/terms',
        icon: FileText,
      },
      {
        name: 'Revisão de Ofertas',
        href: '/admin/ad-offers',
        icon: CheckSquare,
      },
      {
        name: 'Políticas da Rede',
        href: '/admin/credit-policies',
        icon: Sliders,
      },
      {
        name: 'Pacotes de Crédito',
        href: '/credit-packages',
        icon: Package,
      },
      {
        name: 'Atribuição de Créditos',
        href: '/admin/credits',
        icon: PlusCircle,
      }
    );
  }

  if (isMasterAdmin || (hasCompany && !isTrial)) {
    navItems.push({
      name: 'Logs de Auditoria',
      href: '/audit-logs',
      icon: ShieldAlert,
    });
  }

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-purple-500 p-2 rounded-xl text-white shadow-md shadow-purple-500/20">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-white tracking-tight leading-none text-base">Rede Indoor</h1>
            <span className="text-xs font-semibold text-purple-400">SaaS Multi-tenant</span>
          </div>
        </div>

        {/* Master Badge */}
        {isMasterAdmin && (
          <div className="mx-4 mt-4 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-amber-400 text-xs font-semibold">
            <span>Perfil Ativo:</span>
            <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-bold uppercase text-[10px]">
              Master Admin
            </span>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="p-4 space-y-1 mt-2 overflow-y-auto max-h-[calc(100vh-160px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition ${
                  isActive
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair da Conta</span>
        </button>
      </div>
    </aside>
  );
}
