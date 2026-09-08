'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company, Segment } from '@/types';
import { ArrowLeft, Loader2, AlertCircle, Save, Check } from 'lucide-react';

export default function EditCompanyPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [allSegments, setAllSegments] = useState<Segment[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [primarySegment, setPrimarySegment] = useState<string>('');

  const [tradeName, setTradeName] = useState('');
  const [corporateName, setCorporateName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [acceptsExternalMedia, setAcceptsExternalMedia] = useState(true);
  const [acceptsExchange, setAcceptsExchange] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadCompanyData() {
      try {
        // 1. Carregar Empresa
        const { data: companyData, error: companyErr } = await (supabase.from('companies') as any)
          .select('*')
          .eq('id', companyId)
          .single();

        if (companyErr || !companyData) {
          setError('Empresa não encontrada ou você não possui permissão.');
          setLoading(false);
          return;
        }

        const comp = companyData as Company;
        setCompany(comp);
        setTradeName(comp.trade_name);
        setCorporateName(comp.corporate_name || '');
        setCnpj(comp.cnpj || '');
        setCity(comp.city);
        setState(comp.state);
        setNeighborhood(comp.neighborhood || '');
        setAddress(comp.address || '');
        setAcceptsExternalMedia(Boolean(comp.accepts_external_media));
        setAcceptsExchange(Boolean(comp.accepts_exchange));

        // 2. Carregar Segmentos Globais
        const { data: segmentsData } = await (supabase.from('segments') as any).select('*').order('name');
        setAllSegments((segmentsData || []) as Segment[]);

        // 3. Carregar Segmentos já vinculados à Empresa
        const { data: companySegs } = await (supabase.from('company_segments') as any)
          .select('*')
          .eq('company_id', companyId);

        if (companySegs) {
          const segRows = companySegs as any[];
          const segIds = segRows.map((cs) => cs.segment_id);
          setSelectedSegments(segIds);
          const primary = segRows.find((cs) => cs.is_primary);
          if (primary) {
            setPrimarySegment(primary.segment_id);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadCompanyData();
  }, [companyId, supabase]);

  const handleToggleSegment = (segmentId: string) => {
    if (selectedSegments.includes(segmentId)) {
      setSelectedSegments(selectedSegments.filter((id) => id !== segmentId));
      if (primarySegment === segmentId) {
        setPrimarySegment('');
      }
    } else {
      setSelectedSegments([...selectedSegments, segmentId]);
      if (!primarySegment) {
        setPrimarySegment(segmentId);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 1. Atualizar Dados da Empresa
      const { error: updateErr } = await (supabase.from('companies') as any)
        .update({
          trade_name: tradeName,
          corporate_name: corporateName || null,
          cnpj: cnpj || null,
          city,
          state: state.toUpperCase(),
          neighborhood: neighborhood || null,
          address: address || null,
          accepts_external_media: acceptsExternalMedia,
          accepts_exchange: acceptsExchange,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (updateErr) {
        setError(updateErr.message);
        setSaving(false);
        return;
      }

      // 2. Atualizar Vínculos de Segmentos (Limpar e Recriar)
      await (supabase.from('company_segments') as any).delete().eq('company_id', companyId);

      if (selectedSegments.length > 0) {
        const segmentsToInsert = selectedSegments.map((segId) => ({
          company_id: companyId,
          segment_id: segId,
          is_primary: segId === primarySegment,
        }));
        await (supabase.from('company_segments') as any).insert(segmentsToInsert);
      }

      // 3. Log de Auditoria
      if (user) {
        await (supabase.from('audit_logs') as any).insert({
          user_id: user.id,
          company_id: companyId,
          action: 'COMPANY_UPDATED',
          details: {
            trade_name: tradeName,
            segments_count: selectedSegments.length,
          },
        });
      }

      setSuccess(true);
      setSaving(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar empresa.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/companies"
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Editar Empresa</h1>
            <p className="text-slate-400 text-sm">{tradeName}</p>
          </div>
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

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-3">
            <Check className="w-5 h-5 shrink-0" />
            <span>Alterações salvas com sucesso!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-sm">
          {/* Dados Gerais */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-200 text-base border-b border-slate-800 pb-2">
              Informações Gerais
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Nome Fantasia *</label>
                <input
                  type="text"
                  required
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Razão Social</label>
                <input
                  type="text"
                  value={corporateName}
                  onChange={(e) => setCorporateName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-medium text-slate-300 mb-1">CNPJ</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Cidade *</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">UF *</label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500 uppercase"
                />
              </div>
            </div>
          </div>

          {/* Módulo de Segmentos */}
          <div className="space-y-4 pt-4">
            <h3 className="font-bold text-slate-200 text-base border-b border-slate-800 pb-2">
              Segmentos de Atuação
            </h3>
            <p className="text-xs text-slate-400">
              Selecione os segmentos do seu estabelecimento para aplicar regras de permuta e bloqueios concorrenciais.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allSegments.map((seg) => {
                const isSelected = selectedSegments.includes(seg.id);
                const isPrimary = primarySegment === seg.id;

                return (
                  <div
                    key={seg.id}
                    onClick={() => handleToggleSegment(seg.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/30 text-white'
                        : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-xs text-slate-200">{seg.name}</p>
                      <p className="text-[10px] text-slate-500">{seg.description}</p>
                    </div>

                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrimarySegment(seg.id);
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                          isPrimary
                            ? 'bg-sky-500 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {isPrimary ? 'Principal' : 'Tornar Principal'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Regras da Rede */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h3 className="font-bold text-slate-200 text-base pb-2">Configurações da Rede</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptsExternalMedia}
                onChange={(e) => setAcceptsExternalMedia(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-sky-500"
              />
              <span className="text-slate-300 font-medium">Aceita mídias de empresas externas</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptsExchange}
                onChange={(e) => setAcceptsExchange(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-sky-500"
              />
              <span className="text-slate-300 font-medium">Aceita participar da rede de permuta local</span>
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Link
              href="/companies"
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition"
            >
              Voltar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
