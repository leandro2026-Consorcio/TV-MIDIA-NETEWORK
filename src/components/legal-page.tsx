import Link from 'next/link';
import type { ReactNode } from 'react';

export function LegalPage({
  title,
  description,
  updatedAt,
  children,
}: {
  title: string;
  description: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-200 sm:px-6 sm:py-16">
      <article className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-cyan-950/20 sm:p-10">
        <Link href="/" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300">
          ← Mídia por Mídia
        </Link>
        <header className="mt-6 border-b border-white/10 pb-7">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">Transparência e conformidade</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-4 leading-7 text-slate-300">{description}</p>
          <p className="mt-3 text-xs text-slate-500">Atualizada em {updatedAt}.</p>
        </header>
        <div className="legal-content mt-8 space-y-8 leading-7 text-slate-300">{children}</div>
        <footer className="mt-10 border-t border-white/10 pt-6 text-sm text-slate-400">
          Dúvidas sobre privacidade: <a className="font-semibold text-cyan-400 hover:underline" href="mailto:contatompm@msdeducacao.com.br">contatompm@msdeducacao.com.br</a>
        </footer>
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-bold text-white">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
