'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CompanyAdOffer } from '@/types';
import { getMarketplaceOffersAction, getMarketplaceFiltersDataAction } from '@/app/actions/marketplace';
import { Store, Search, Filter, MapPin, Tag, ArrowRight, Loader2, AlertCircle, Building2 } from 'lucide-react';

export default function MarketplacePage() {
  const [offers, setOffers] = useState<CompanyAdOffer[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const loadMarketplaceData = async () => {
    try {
      setLoading(true);
      const filtersRes = await getMarketplaceFiltersDataAction();
      if (filtersRes.success) {
        setCities(filtersRes.cities || []);
        setCompanies(filtersRes.companies || []);
        setSegments(filtersRes.segments || []);
      }

      const offersRes = await getMarketplaceOffersAction({
        search: search || undefined,
        city: selectedCity || undefined,
        companyId: selectedCompanyId || undefined,
        segmentId: selectedSegmentId || undefined,
      });

      if (offersRes.success) {
        setOffers((offersRes.offers || []) as CompanyAdOffer[]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketplaceData();
  }, [supabase, selectedCity, selectedCompanyId, selectedSegmentId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadMarketplaceData();
  };

  if (loading && offers.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900/40 via-slate-900 to-slate-900 border border-purple-500/30 rounded-3xl p-8 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-purple-500/20 p-2.5 rounded-2xl text-purple-400 border border-purple-500/30">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider block">
              Marketplace Interno de Mídia
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Vitrine da Rede Indoor Local
            </h1>
          </div>
        </div>
        <p className="text-slate-400 text-sm max-w-2xl">
          Explore planos de mídia disponíveis em TVs de empresas parceiras na sua região e solicite veiculação.
        </p>

        {/* Barra de Pesquisa Rápida */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título do plano, descrição ou nome da empresa..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-lg shadow-purple-500/20"
          >
            Buscar
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filtros de Seleção */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-purple-400" /> Filtrar por Cidade:
          </label>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="">Todas as Cidades</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-purple-400" /> Filtrar por Empresa:
          </label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="">Todas as Empresas</option>
            {companies.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.trade_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-purple-400" /> Filtrar por Segmento:
          </label>
          <select
            value={selectedSegmentId}
            onChange={(e) => setSelectedSegmentId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="">Todos os Segmentos</option>
            {segments.map((seg) => (
              <option key={seg.id} value={seg.id}>
                {seg.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid de Cards de Mídia Ativos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {offers.length === 0 ? (
          <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Store className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">Nenhum plano de mídia encontrado</h3>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              Não há ofertas ativas com os filtros selecionados no momento. Tente limpar os filtros de busca.
            </p>
          </div>
        ) : (
          offers.map((offer: any) => (
            <div
              key={offer.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl hover:border-purple-500/40 transition group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-purple-400 block truncate max-w-[180px]">
                    {offer.company?.trade_name || 'Empresa Exibidora'}
                  </span>
                  <span className="text-[11px] text-amber-400 font-mono font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded shrink-0">
                    {offer.credits_amount} CR
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition">{offer.title}</h3>
                {offer.description && <p className="text-xs text-slate-400 line-clamp-2">{offer.description}</p>}

                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{offer.company?.city || 'Localidade não informada'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-500 block font-mono">PREÇO DO PLANO</span>
                  <strong className="text-base font-extrabold text-white font-mono">
                    R$ {(offer.price_cents / 100).toFixed(2)}
                  </strong>
                </div>

                <Link
                  href={`/marketplace/${offer.id}`}
                  className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
                >
                  Ver Detalhes <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
