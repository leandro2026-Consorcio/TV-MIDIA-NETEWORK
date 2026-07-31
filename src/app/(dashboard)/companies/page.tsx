'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { Building2, Plus, Edit3, MapPin, Loader2 } from 'lucide-react';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchCompanies() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        // RLS cuidará da filtragem automática de acordo com as permissões do usuário
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erro ao buscar empresas:', error);
        } else {
          setCompanies((data || []) as Company[]);
        }
      } catch (err) {
        console.error('Erro inesperado:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCompanies();
  }, [supabase]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Empresas Cadastradas</h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerencie estabelecimentos parceiros e anunciantes da rede multi-tenant.
          </p>
        </div>

        <Link
          href="/companies/new"
          className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> Nova Empresa
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        </div>
      ) : companies.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Nenhuma empresa encontrada</h3>
          <p className="text-slate-400 text-sm mb-6">
            Você ainda não possui empresas cadastradas ou vinculadas à sua conta.
          </p>
          <Link
            href="/companies/new"
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Cadastrar Primeira Empresa
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition group shadow-xl"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="bg-sky-500/10 text-sky-400 p-2.5 rounded-xl border border-sky-500/20">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <Link
                    href={`/companies/${company.id}`}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
                    title="Editar Empresa"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Link>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition truncate">
                  {company.trade_name}
                </h3>
                {company.corporate_name && (
                  <p className="text-xs text-slate-400 truncate mb-3">{company.corporate_name}</p>
                )}

                <div className="space-y-1.5 text-xs text-slate-400 mt-4 border-t border-slate-800/80 pt-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {company.city} - {company.state}
                      {company.neighborhood ? `, ${company.neighborhood}` : ''}
                    </span>
                  </div>
                  {company.cnpj && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      CNPJ: {company.cnpj}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Permuta / Externa:</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      company.accepts_exchange
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {company.accepts_exchange ? 'Permuta ON' : 'Permuta OFF'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
