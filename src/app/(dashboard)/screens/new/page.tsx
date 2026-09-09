'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { ArrowLeft, Download, Loader2, AlertCircle, Monitor } from 'lucide-react';

export default function NewScreenPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [deviceType, setDeviceType] = useState<'tv' | 'windows_monitor'>('tv');
  const [resolution, setResolution] = useState('1920x1080');
  const [locationDescription, setLocationDescription] = useState('');
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
          // Apenas onde o usuário é admin
          const { data: adminLinks } = await (supabase.from('company_users') as any)
            .select('company_id')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .eq('is_active', true);

          const ids = ((adminLinks || []) as any[]).map((r) => r.company_id);
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
        console.error('Erro ao buscar empresas:', err);
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
      setError('Por favor, selecione uma empresa vinculada.');
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Usuário não autenticado.');
        setLoading(false);
        return;
      }

      // 1. Criar Tela
      const { data: newScreen, error: screenErr } = await (supabase.from('screens') as any)
        .insert({
          company_id: companyId,
          name,
          description: description || null,
          orientation,
          device_type: deviceType,
          resolution,
          location_description: locationDescription || null,
          status: 'pending_pairing',
        })
        .select()
        .single();

      if (screenErr || !newScreen) {
        setError(screenErr?.message || 'Erro ao cadastrar tela.');
        setLoading(false);
        return;
      }

      // 2. Registrar Log de Auditoria
      await (supabase.from('audit_logs') as any).insert({
        user_id: user.id,
        company_id: companyId,
        action: 'SCREEN_CREATED',
        details: {
          screen_id: newScreen.id,
          name,
          orientation,
        },
      });

      router.push(`/screens/${newScreen.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar tela.');
      setLoading(false);
    }
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/screens"
          className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cadastrar Nova Tela</h1>
          <p className="text-slate-400 text-sm">Escolha TV ou Monitor Windows para iniciar o pareamento</p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-sm">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Tipo de dispositivo *</label>
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as 'tv' | 'windows_monitor')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="tv">TV / Smart TV / TV Box</option>
              <option value="windows_monitor">Monitor Windows / computador</option>
            </select>
            <p className="text-xs text-slate-500 mt-1.5">Monitor Windows receberá instruções para iniciar automaticamente com o computador.</p>
            {deviceType === 'windows_monitor' && (
              <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-slate-300 space-y-2">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <Monitor className="h-4 w-4 text-sky-400" /> Instalador Nativo para Windows 10 e Windows 11
                </p>
                <p className="text-slate-400">
                  Instalação per-user sem necessidade de administrador. O player inicia automaticamente com o sistema e mantém a tela sempre ativa em modo quiosque.
                </p>
                <a
                  href="/downloads/mpm-player/windows"
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3.5 py-2 font-bold text-white hover:bg-sky-600 transition shadow-md shadow-sky-500/20"
                >
                  <Download className="h-4 w-4" /> BAIXAR PARA WINDOWS (MPM-Player-Setup.exe)
                </a>
              </div>
            )}
          </div>
          <div>
            <label className="block font-medium text-slate-300 mb-1">Empresa Proprietária *</label>
            {companies.length === 0 ? (
              <p className="text-rose-400 text-xs">
                Você não possui permissão de Administrador em nenhuma empresa ativa.
              </p>
            ) : (
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
            )}
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Nome da Tela *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: TV Recepção Principal"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Orientação da TV *</label>
              <select
                value={orientation}
                onChange={(e: any) => {
                  setOrientation(e.target.value);
                  setResolution(e.target.value === 'horizontal' ? '1920x1080' : '1080x1920');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-sky-500 capitalize"
              >
                <option value="horizontal">Horizontal (16:9)</option>
                <option value="vertical">Vertical (9:16)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Resolução Nativa</label>
              <input
                type="text"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="1920x1080"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Localização Física / Descrição de Ponto</label>
            <input
              type="text"
              value={locationDescription}
              onChange={(e) => setLocationDescription(e.target.value)}
              placeholder="Ex: Sala de Espera ao lado da recepção"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Descrição Adicional (Opcional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: TV Samsung 55 polegadas Smart TV"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
            <Link
              href="/screens"
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading || companies.length === 0}
              className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                'Salvar e Ir para Pareamento'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
