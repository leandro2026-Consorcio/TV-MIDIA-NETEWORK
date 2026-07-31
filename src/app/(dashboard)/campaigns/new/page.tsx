'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { createCampaignAction } from '@/app/actions/campaigns';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function NewCampaignPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetInsertions, setTargetInsertions] = useState<string>('100');
  const [companyId, setCompanyId] = useState('');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCompanies, setFetchingCompanies] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadCompanies() {
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

        let query;
        if (isMaster) {
          query = (supabase.from('companies') as any).select('*').order('trade_name');
        } else {
          const { data: userLinks } = await (supabase.from('company_users') as any)
            .select('company_id')
            .eq('user_id', user.id)
            .eq('is_active', true);

          const ids = ((userLinks || []) as any[]).map((r) => r.company_id);
          if (ids.length > 0) {
            query = (supabase.from('companies') as any).select('*').in('id', ids).order('trade_name');
          }
        }

        if (query) {
          const { data: compList } = await query;
          if (compList && compList.length > 0) {
            setCompanies(compList as Company[]);
            setCompanyId(compList[0].id);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err);
      } finally {
        setFetchingCompanies(false);
      }
    }

    loadCompanies();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!companyId) {
      setError('Selecione uma empresa.');
      setLoading(false);
      return;
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError('A data de término não pode ser anterior à data de início.');
      setLoading(false);
      return;
    }

    const res = await createCampaignAction({
      company_id: companyId,
      name,
      description,
      start_date: startDate || null,
      end_date: endDate || null,
      target_insertions: targetInsertions ? parseInt(targetInsertions, 10) : null,
    });

    if (!res.success || !res.campaign) {
      setError(res.error || 'Erro ao criar campanha.');
      setLoading(false);
      return;
    }

    router.push(`/campaigns/${res.campaign.id}`);
    router.refresh();
  };

  if (fetchingCompanies) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/campaigns"
          className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Criar Nova Campanha Interna</h1>
          <p className="text-slate-400 text-sm">Organize anúncios comerciais e acompanhe relatórios de inserções</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-sm">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Empresa Proprietária *</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name} ({c.city} - {c.state})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Nome da Campanha *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Lançamento Menu Verão"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Data de Início</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Data de Término</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Meta de Inserções (Exibições Concluídas)</label>
            <input
              type="number"
              min={1}
              value={targetInsertions}
              onChange={(e) => setTargetInsertions(e.target.value)}
              placeholder="Ex: 500"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Descrição Comercial (Opcional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Anúncios institucionais promovendo novos produtos"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
            <Link
              href="/campaigns"
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Rascunho de Campanha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
