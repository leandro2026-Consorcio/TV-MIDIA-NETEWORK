import Link from 'next/link';
import { Tv, ShieldCheck, Coins, Building2, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between">
      {/* Header Landing */}
      <header className="border-b border-slate-800 px-6 py-4 flex justify-between items-center max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="bg-sky-500 p-2 rounded-xl text-white">
            <Tv className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">Rede Indoor Local</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-slate-300 hover:text-white font-medium px-4 py-2 text-sm transition"
          >
            Entrar
          </Link>
          <Link
            href="/empresa/cadastro"
            className="bg-sky-500 hover:bg-sky-600 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition shadow-lg shadow-sky-500/20"
          >
            Testar 60 dias grátis
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-20 text-center flex-1 flex flex-col justify-center items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-6 border border-sky-500/20">
          Fundação SaaS Multiempresa
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl text-white leading-tight mb-6">
          Rede de Mídia Indoor Compartilhada e Inteligente
        </h1>

        <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed">
          Gerencie suas TVs, conecte seu estabelecimento a marcas parceiras locais e rentabilize seu tempo de tela com créditos auditáveis.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
          <Link
            href="/empresa/cadastro"
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-8 py-4 rounded-xl text-base transition flex items-center justify-center gap-2 shadow-xl shadow-sky-500/25"
          >
            Começar 60 dias grátis <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-8 py-4 rounded-xl text-base transition border border-slate-700"
          >
            Acessar Painel
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20 text-left w-full">
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-800">
            <Building2 className="w-8 h-8 text-sky-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Multiempresa & Tenants</h3>
            <p className="text-slate-400 text-sm">
              Isolamento total de dados via PostgreSQL RLS. Gerencie múltiplas unidades ou empresas em uma única conta.
            </p>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-800">
            <Coins className="w-8 h-8 text-amber-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Carteira Auditável</h3>
            <p className="text-slate-400 text-sm">
              Sistema de créditos imutável acionado via RPC atômico. Extrato completo de cada inserção ou recarga.
            </p>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-800">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Segurança & Moderação</h3>
            <p className="text-slate-400 text-sm">
              Papéis de acesso granulares (Master Admin, Admin da Empresa, Operador e Anunciante Externo).
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-slate-500 text-sm">
        Rede Indoor Local &copy; {new Date().getFullYear()} — Antigravity Multi-tenant SaaS Foundation
      </footer>
    </div>
  );
}
