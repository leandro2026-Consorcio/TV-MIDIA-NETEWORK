'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export const TV_PLAYER_URL = 'https://midiapormidia.com.br/tv';

export function CopyTvLinkButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(TV_PLAYER_URL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-sky-300 hover:bg-slate-700">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Link copiado' : 'Copiar link da TV'}
    </button>
  );
}
