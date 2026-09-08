import Link from 'next/link';
import { getPublicShowcaseDataAction } from '@/app/actions/showcase';
import {
  MapPin,
  Tv,
  Store,
  Building2,
  ShieldCheck,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const revalidate = 60;

export default async function OndeAnunciarPage() {
  const res = await getPublicShowcaseDataAction();
  const data = res.success ? res.data : null;
  const locations = data?.locations || [];
  const metrics = data?.metrics || { total_companies: 0, total_public_screens: 0, cities_count: 0, cities: [] };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-purple-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">
              MÍDIA<span className="text-purple-400">POR</span>MÍDIA
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/marketplace"
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Marketplace de TVs
            </Link>
            <Link
              href="/empresa/cadastro"
              className="rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold transition-colors"
            >
              Colocar Minha TV
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* Banner */}
        <section className="rounded-3xl border border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 p-8 sm:p-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold border border-purple-500/20 uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5" /> Rede de Telas Conectadas
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
            Onde sua marca pode aparecer
          </h1>
          <p className="text-slate-300 max-w-2xl text-sm sm:text-base leading-relaxed">
            Descubra os pontos de mídia indoor comerciais em clínicas, academias, comércios e restaurantes parceiros.
            Telas com exibição auditada por Proof of Delivery e isolamento de concorrência.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 max-w-xl">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-bold uppercase text-slate-400">Telas no Ar</span>
              <div className="text-2xl font-black text-purple-400 mt-1">{metrics.total_public_screens}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-bold uppercase text-slate-400">Empresas</span>
              <div className="text-2xl font-black text-white mt-1">{metrics.total_companies}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 col-span-2 sm:col-span-1">
              <span className="text-xs font-bold uppercase text-slate-400">Cidades</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">{metrics.cities_count}</div>
            </div>
          </div>
        </section>

        {/* Locations Listing */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-white">Pontos Comerciais Autorizados</h2>
              <p className="text-xs text-slate-400">
                Apenas estabelecimentos que optaram por exibição pública constam nesta lista.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.length > 0 ? (
              locations.map((loc: any) => (
                <div
                  key={loc.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 hover:border-purple-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {loc.venue_category || loc.venue_type || 'Comércio'}
                      </span>
                      <span className="text-xs font-bold text-emerald-400">● Ativa</span>
                    </div>

                    <h3 className="text-lg font-black text-white line-clamp-1">{loc.name}</h3>
                    <p className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      {loc.company_name}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {loc.city}, {loc.state}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Inserção a partir de</span>
                      <span className="text-sm font-black text-purple-400">
                        {loc.indicative_price_credits} crédito
                      </span>
                    </div>
                    <Link
                      href={`/marketplace?city=${encodeURIComponent(loc.city)}`}
                      className="rounded-xl bg-purple-600/80 hover:bg-purple-600 px-3 py-1.5 text-xs font-bold text-white transition-colors flex items-center gap-1"
                    >
                      Anunciar <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center rounded-3xl border border-dashed border-slate-800 p-8">
                <Tv className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Nenhum ponto comercial público cadastrado no momento.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
