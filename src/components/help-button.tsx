'use client';

import { CircleHelp } from 'lucide-react';

export function HelpButton({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('open-onboarding-tour'))}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-2.5 text-xs font-bold text-sky-300 hover:bg-sky-500/20 ${className}`}
    >
      <CircleHelp className="h-4 w-4" /> Ajuda / Primeiros passos
    </button>
  );
}
