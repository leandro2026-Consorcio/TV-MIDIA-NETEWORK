'use client';

import { useState } from 'react';
import { Newspaper, Sparkles } from 'lucide-react';
import type { PlayerPlaylistItem } from '@/app/actions/playlist-player';

export function InformativeContentCard({ item }: { item: PlayerPlaylistItem }) {
  const [showImage, setShowImage] = useState(!!item.image_url);
  const isRss = item.item_type === 'informative_rss';
  const published = item.published_at
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.published_at))
    : null;
  const titleSize = item.title.length > 120
    ? 'text-[clamp(1.8rem,3.5vw,4.2rem)]'
    : item.title.length > 75
      ? 'text-[clamp(2.1rem,4.2vw,5rem)]'
      : 'text-[clamp(2.4rem,5vw,5.8rem)]';
  const summarySize = item.summary && item.summary.length > 320
    ? 'text-[clamp(1rem,1.7vw,1.65rem)]'
    : 'text-[clamp(1.1rem,2vw,2rem)]';

  return (
    <article className="relative flex h-full w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />

      <div className={`relative z-10 h-full w-full ${showImage ? 'grid grid-cols-[1.4fr_0.6fr]' : 'flex'}`}>
        <div className="flex min-h-0 min-w-0 flex-col justify-center overflow-hidden px-[7vw] py-[6vh]">
          <div className="mb-6 flex items-center gap-3 text-sky-300">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-[clamp(0.8rem,1.3vw,1.15rem)] font-bold uppercase tracking-[0.18em]">
              {isRss ? <Newspaper className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              {item.category || (isRss ? 'Notícias' : 'Conteúdo informativo')}
            </span>
          </div>

          <h1 className={`line-clamp-3 max-w-5xl break-words text-balance font-black leading-[1.04] tracking-tight ${titleSize}`}>
            {item.title}
          </h1>
          {item.summary && (
            <p className={`mt-5 max-w-5xl break-words text-pretty leading-relaxed text-slate-200 ${showImage ? 'line-clamp-4' : 'line-clamp-5'} ${summarySize}`}>
              {item.summary}
            </p>
          )}

          <footer className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[clamp(0.75rem,1.1vw,1rem)] font-medium text-slate-400">
            <span>Fonte: <strong className="text-slate-200">{item.source_name || 'Mídia por Mídia'}</strong></span>
            {published && <><span aria-hidden>•</span><time>{published}</time></>}
          </footer>
        </div>

        {showImage && item.image_url && (
          <div className="relative h-full min-w-0 overflow-hidden">
            <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-900 via-slate-900/20 to-transparent" />
            <img
              src={item.image_url}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={() => setShowImage(false)}
            />
          </div>
        )}
      </div>
    </article>
  );
}
