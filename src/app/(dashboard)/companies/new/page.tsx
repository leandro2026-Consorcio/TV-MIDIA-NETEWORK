'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function NewCompanyPage() {
  const [tradeName, setTradeName] = useState('');
  const [corporateName, setCorporateName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [acceptsExternalMedia, setAcceptsExternalMedia] = useState(true);
  const [acceptsExchange, setAcceptsExchange] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Usuário não autenticado.');
        setLoading(false);
        return;
      }

      // 1. Inserir a Empresa
      const { data: newCompany, error: companyError } = await (supabase.from('companies') as any)
        .insert({
          trade_name: tradeName,
          corporate_name: corporateName || null,
          cnpj: cnpj || null,
          city,
          state: state.toUpperCase(),
          neighborhood: neighborhood || null,
          address: address || null,
          accepts_external_media: acceptsExternalMedia,
          accepts_exchange: acceptsExchange,
        })
        .select()
        .single();

      if (companyError || !newCompany) {
        setError(companyError?.message || 'Erro ao cadastrar empresa.');
        setLoading(false);
        return;
      }

      // 2. Vincular o usuário criador como admin da empresa em company_users
      const { error: linkError } = await (supabase.from('company_users') as any).insert({
        company_id: newCompany.id,
        user_id: user.id,
        role: 'admin',
        is_active: true,
      });

      if (linkError) {
        console.error('Erro ao vincular usuário criador:', linkError);
      }

      // 3. Registrar Log de Auditoria
      await (supabase.from('audit_logs') as any).insert({
        user_id: user.id,
        company_id: newCompany.id,
        action: 'COMPANY_CREATED',
        details: {
          trade_name: tradeName,
          city,
          state,
        },
      });

      router.push('/companies');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar empresa.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/companies"
          className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cadastrar Nova Empresa</h1>
          <p className="text-slate-400 text-sm">Adicione um novo estabelecimento parceiro ao sistema</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Nome Fantasia <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Ex: Academia Fit Life"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Razão Social</label>
              <input
                type="text"
                value={corporateName}
                onChange={(e) => setCorporateName(e.target.value)}
                placeholder="Ex: Fit Life Serviços Esportivos LTDA"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">CNPJ</label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-00"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-300 mb-1">
                Cidade <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: São Paulo"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                UF <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="SP"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Bairro</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ex: Centro"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Endereço Completo</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Av. Paulista, 1000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Rules Checkbox */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
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
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                'Salvar Empresa'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
