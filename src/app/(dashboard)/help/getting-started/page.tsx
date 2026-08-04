'use client';

import { HelpButton } from '@/components/help-button';
import { OnboardingTour } from '@/components/onboarding-tour';
import { CopyTvLinkButton, TV_PLAYER_URL } from '@/components/copy-tv-link-button';

const topics = [
  ['1. Cadastre sua TV', 'A TV ou tela é o dispositivo onde suas propagandas serão exibidas. Cadastre-a em TVs & Telas.'],
  ['2. Abra o link da TV', 'Na Smart TV, TV Box ou computador conectado, abra o endereço do player abaixo.'],
  ['3. Pareie a TV', 'O player mostra um código temporário. Abra a TV cadastrada no painel e informe esse código para vinculá-la.'],
  ['4. Envie sua mídia', 'Abra a Biblioteca de Mídias e envie uma imagem ou um vídeo da sua empresa.'],
  ['5. Crie a programação', 'A playlist define quais mídias aparecem, a ordem e o tempo de exibição. Depois, vincule-a à TV.'],
  ['6. Inicie a apresentação', 'No player da TV, clique em “Iniciar apresentação”. O sistema tentará usar tela cheia; se a TV mantiver a barra do navegador, a reprodução continuará.'],
  ['7. Convide parceiros', 'Em Convites VIP, copie um dos três links disponíveis. A empresa convidada também recebe 60 dias gratuitos.'],
];

export default function GettingStartedHelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <OnboardingTour autoOpen />
      <header className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-wider text-sky-400">Central de ajuda</p><h1 className="mt-2 text-3xl font-extrabold text-white">Primeiros passos</h1><p className="mt-2 text-sm text-slate-400">Da primeira TV à primeira propaganda em exibição.</p></div>
        <HelpButton />
      </header>
      <div className="space-y-4">
        {topics.map(([title, text], index) => (
          <section key={title} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
            {index === 1 && <div className="mt-4 rounded-xl bg-slate-950 p-4"><code className="mb-3 block break-all text-xs text-slate-300">{TV_PLAYER_URL}</code><CopyTvLinkButton /></div>}
          </section>
        ))}
      </div>
    </div>
  );
}
