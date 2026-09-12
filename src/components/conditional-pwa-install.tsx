'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function ConditionalPwaInstall() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  if (!promptEvent) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await promptEvent.prompt();
        await promptEvent.userChoice;
        setPromptEvent(null);
      }}
      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-sky-500/30 px-3 py-2 text-xs font-bold text-sky-300 hover:bg-sky-500/10"
    >
      <Download className="h-4 w-4" /> Instalar MPM nesta TV
    </button>
  );
}
