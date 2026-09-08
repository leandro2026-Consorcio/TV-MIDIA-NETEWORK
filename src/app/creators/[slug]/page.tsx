import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCreatorPublicProfileAction } from '@/app/actions/showcase';
import {
  CheckCircle2,
  MapPin,
  Sparkles,
  Star,
  Users,
  Eye,
  TrendingUp,
  Instagram,
  Facebook,
  ShieldCheck,
  Calendar,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';

export const revalidate = 60;

export default async function CreatorPublicProfilePage({ params }: { params: { slug: string } }) {
  const res = await getCreatorPublicProfileAction(params.slug);
  if (!res.success || !res.profile) {
    notFound();
  }

  const creator = res.profile;
  const metrics = creator.metrics;
  const scores = creator.scores;
  const channels = creator.channels || [];
  const rateCards = creator.rate_cards || [];
  const reviews = creator.reviews || [];

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-fuchsia-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">
              MÍDIA<span className="text-purple-400">POR</span>MÍDIA
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/marketplace?tab=creators"
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              ← Todos os Creators
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* Profile Header Banner */}
        <section className="rounded-3xl border border-purple-500/20 bg-gradient-to-b from-purple-950/40 via-slate-900 to-slate-900 p-6 sm:p-10 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            <div className="relative">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 p-1 shadow-2xl">
                {creator.avatar_url ? (
                  <img
                    src={creator.avatar_url}
                    alt={creator.display_name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center text-3xl font-black text-purple-300">
                    {creator.display_name?.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              {creator.is_verified && (
                <div className="absolute -bottom-2 -right-2 bg-purple-500 text-white p-1.5 rounded-full shadow-lg border-2 border-slate-950">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            <div className="space-y-3 text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {creator.tier || 'Starter'}
                </span>
                {creator.is_verified && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verificado MPM
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{creator.display_name}</h1>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400">
                {creator.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    {creator.city}, {creator.state}
                  </span>
                )}
                {creator.completed_campaigns > 0 && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    {creator.completed_campaigns} campanhas entregues
                  </span>
                )}
              </div>

              {creator.bio && <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">{creator.bio}</p>}

              {creator.niches?.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                  {creator.niches.map((n: string) => (
                    <span
                      key={n}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/60"
                    >
                      #{n}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Action Box */}
            <div className="sm:w-64 w-full bg-slate-950/80 border border-purple-500/30 rounded-2xl p-5 text-center space-y-4 shadow-xl">
              {rateCards.length > 0 && (
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Mídia a partir de</span>
                  <div className="text-2xl font-black text-purple-400 mt-0.5">
                    {rateCards[0].price_credits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} créditos
                  </div>
                </div>
              )}
              <Link
                href={`/login?redirect=/marketplace?creator=${encodeURIComponent(creator.id)}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-3 text-sm font-bold text-white transition-all shadow-lg shadow-purple-600/30"
              >
                Contratar este Creator <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-[11px] text-slate-500 leading-tight">
                Cotação congelada e entrega comprovada via Proof of Publication.
              </p>
            </div>
          </div>
        </section>

        {/* Public Metrics & Scores Grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics && (
            <>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                  <Users className="w-4 h-4 text-purple-400" /> Seguidores
                </div>
                <div className="text-2xl font-black text-white mt-2">
                  {metrics.followers ? metrics.followers.toLocaleString('pt-BR') : 'Privado'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Engajamento
                </div>
                <div className="text-2xl font-black text-white mt-2">
                  {metrics.engagement_rate ? `${Number(metrics.engagement_rate).toFixed(1)}%` : 'Ótimo'}
                </div>
              </div>
            </>
          )}

          {scores && (
            <>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Creator Score
                </div>
                <div className="text-2xl font-black text-amber-300 mt-2">
                  {scores.creator_score ? `${Number(scores.creator_score).toFixed(0)}/100` : 'Verificado'}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">Confiabilidade e cumprimento de prazos</span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                  <Star className="w-4 h-4 text-fuchsia-400" /> Media Value Score
                </div>
                <div className="text-2xl font-black text-fuchsia-400 mt-2">
                  {scores.media_value_score ? `${Number(scores.media_value_score).toFixed(0)}/100` : 'Alto'}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">Relevância regional e entrega de valor</span>
              </div>
            </>
          )}
        </section>

        {/* Rate Cards / Formats Available */}
        {rateCards.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">Formatos e Valores Disponíveis</h2>
              <p className="text-xs text-slate-400">
                Preços vigentes garantidos no momento do fechamento da cotação.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rateCards.map((rc: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3 hover:border-purple-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
                      {rc.format.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500">Prazo: {rc.turnaround_hours}h</span>
                  </div>
                  <div className="text-2xl font-black text-white">
                    {Number(rc.price_credits).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} créditos
                  </div>
                  <p className="text-xs text-slate-400">
                    Publicação com comprovação de entrega e relatório de engajamento no painel da sua empresa.
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Connected Channels */}
        {channels.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Canais Conectados</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {channels.map((ch: any) => (
                <div
                  key={ch.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-800 text-purple-400">
                      {ch.provider === 'instagram' ? <Instagram className="w-5 h-5" /> : <Facebook className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{ch.display_name}</div>
                      <div className="text-xs text-slate-400 capitalize">
                        {ch.channel_type.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {ch.feed_publish_capable && (
                      <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                        Feed
                      </span>
                    )}
                    {ch.reel_publish_capable && (
                      <span className="text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">
                        Reels
                      </span>
                    )}
                    {ch.story_publish_capable && (
                      <span className="text-[10px] font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded">
                        Story
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Avaliações de Empresas Anunciantes</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {reviews.map((rev: any, idx: number) => (
                <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300">{rev.company_name}</span>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span className="text-xs font-bold">{rev.rating}/5</span>
                    </div>
                  </div>
                  {rev.comment && <p className="text-xs text-slate-300 italic">"{rev.comment}"</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
