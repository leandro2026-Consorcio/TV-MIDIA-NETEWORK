'use client';

import { MessageCircle } from 'lucide-react';

export function WhatsAppButton() {
  const whatsappUrl =
    'https://wa.me/5566996086030?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20M%C3%ADdia%20por%20M%C3%ADdia%20e%20gostaria%20de%20atendimento%20imediato.';

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contato imediato pelo WhatsApp - (66) 99608-6030"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full bg-emerald-500 px-4 py-3.5 text-white font-extrabold shadow-2xl shadow-emerald-500/40 border border-emerald-400/60 transition-all duration-300 hover:scale-105 hover:bg-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-400/30 group"
    >
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
      </span>

      <MessageCircle className="h-6 w-6 text-white shrink-0 fill-white/20" />
      
      <div className="flex flex-col text-left">
        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100 leading-tight">
          Atendimento WhatsApp
        </span>
        <span className="text-xs font-extrabold text-white leading-tight">
          (66) 99608-6030
        </span>
      </div>
    </a>
  );
}
