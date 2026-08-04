'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  MapPin, 
  Tag, 
  MessageSquare, 
  Search, 
  Loader2, 
  CheckCircle2, 
  Users, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { getPublicNetworkCompaniesAction } from '@/app/actions/network';
import { getPublicSegmentsAction } from '@/app/actions/onboarding';

export default function NetworkCompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');

  async function loadData() {
    setLoading(true);
    const [compRes, segRes] = await Promise.all([
      getPublicNetworkCompaniesAction({
        city: cityFilter,
        state: stateFilter,
        segmentId: segmentFilter,
      }),
      getPublicSegmentsAction(),
    ]);

    if (compRes.success) {
      setCompanies(compRes.companies);
    }
    if (segRes.success) {
      setSegments(segRes.segments);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [cityFilter, stateFilter, segmentFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-400 mb-2">
            <Users className="h-3.5 w-3.5" /> Rede Colaborativa Local
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Empresas da Rede
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-xl">
            Conheça as empresas parceiras que aceitaram participar da rede Mídia por Mídia na sua região.
          </p>
        </div>

        <Link
          href="/network-settings"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 transition"
        >
          Minha Visibilidade na Rede
        </Link>
      </header>

      {/* Filtros */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6 space-y-4">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Search className="h-4 w-4 text-sky-400" /> Filtrar Empresas Participantes
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-300">
            Cidade
            <input
              type="text"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder="Ex: Sinop, Cuiabá"
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </label>

          <label className="text-xs font-semibold text-slate-300">
            UF (Estado)
            <input
              type="text"
              maxLength={2}
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value.toUpperCase())}
              placeholder="Ex: MT, SP"
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </label>

          <label className="text-xs font-semibold text-slate-300">
            Segmento
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="">Todos os segmentos</option>
              {segments.map((seg) => (
                <option key={seg.id} value={seg.id}>
                  {seg.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Grid de Empresas */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
        </div>
      ) : companies.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-12 text-center space-y-3">
          <Building2 className="h-12 w-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhuma empresa participante encontrada</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Tente ajustar os filtros por cidade ou segmento. Convide empresas parceiras usando seus Convites VIP para expandir a rede na sua cidade.
          </p>
          <Link
            href="/company/invites"
            className="inline-block mt-2 bg-sky-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs"
          >
            Ver meus convites VIP
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company, idx) => {
            const rawPhone = company.publicWhatsapp?.replace(/\D/g, '') || '';
            const whatsappUrl = rawPhone ? `https://wa.me/55${rawPhone}` : null;

            return (
              <article
                key={company.companyId || idx}
                className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4 hover:border-sky-500/30 transition shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-base leading-snug">
                          {company.tradeName}
                        </h3>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                          <ShieldCheck className="h-3 w-3" /> Participante da Rede
                        </span>
                      </div>
                    </div>
                  </div>

                  {company.publicDescription && (
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                      {company.publicDescription}
                    </p>
                  )}

                  <div className="space-y-1.5 pt-2 text-xs text-slate-400 border-t border-slate-800/80">
                    {(company.city || company.state) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                        <span>
                          {company.city}
                          {company.city && company.state ? ` / ${company.state}` : company.state}
                        </span>
                      </div>
                    )}

                    {company.segmentName && (
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                        <span>{company.segmentName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {whatsappUrl && (
                  <div className="pt-3 border-t border-slate-800/80">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition"
                    >
                      <MessageSquare className="h-4 w-4" /> WhatsApp Comercial <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
