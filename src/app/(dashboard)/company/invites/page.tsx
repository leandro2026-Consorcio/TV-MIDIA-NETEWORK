'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, Copy, Gift, Loader2, Share2, MessageSquare, ArrowRight, Sparkles } from 'lucide-react';
import { getOnboardingContextAction, markOnboardingEventAction } from '@/app/actions/onboarding';

export default function CompanyInvitesPage() {
  const [context, setContext] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'link' | 'message' | null>(null);
  const [selectedInviteCode, setSelectedInviteCode] = useState<string>('');
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    getOnboardingContextAction().then((ctx) => {
      setContext(ctx);
      if (ctx?.invites && ctx.invites.length > 0) {
        const firstAvail = ctx.invites.find((i: any) => i.status === 'available' || i.status === 'created') || ctx.invites[0];
        setSelectedInviteCode(firstAvail.invite_code);
      }
    });
  }, []);

  const invites = context?.invites || [];
  const availableInvites = invites.filter((i: any) => i.status === 'available' || i.status === 'created');
  const activeInviteCode = selectedInviteCode || (invites[0]?.invite_code ?? '');
  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/invite/${encodeURIComponent(activeInviteCode)}`
    : `https://midiapormidia.com.br/invite/${encodeURIComponent(activeInviteCode)}`;

  // Dynamic message template from platform_settings
  const defaultTemplate = 'Olá! Quero te convidar para conhecer o Mídia por Mídia, uma rede que conecta empresas para divulgação de propagandas em telas comerciais na nossa região.\n\nAcesse pelo meu convite:\n{{link}}';
  const template = context?.vipConfig?.messageTemplate || defaultTemplate;
  const messageText = template.replace('{{link}}', inviteLink);

  async function handleCopy(type: 'link' | 'message') {
    setCopying(true);
    setCopyError(null);
    const content = type === 'link' ? inviteLink : messageText;

    try {
      await copyTextToClipboard(content);
      const result = await markOnboardingEventAction('invite_copied');

      if (result.success && result.progress) {
        setContext((current: any) => ({
          ...current,
          progress: result.progress,
          checklist: { ...current?.checklist, inviteCopied: true },
        }));
      }

      setCopiedType(type);
      setCopiedCode(activeInviteCode);
      const remaining = Math.max(0, availableInvites.length);
      setFeedbackMessage(`Convite pronto. Você ainda possui ${remaining} convites disponíveis.`);
      window.setTimeout(() => {
        setCopiedType(null);
        setCopiedCode(null);
      }, 3000);
    } catch {
      setCopyError('Não foi possível copiar automaticamente. Selecione e copie o texto manualmente.');
    } finally {
      setCopying(false);
    }
  }

  function handleSendWhatsApp() {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');
    void markOnboardingEventAction('invite_copied');
    const remaining = Math.max(0, availableInvites.length);
    setFeedbackMessage(`Convite pronto. Você ainda possui ${remaining} convites disponíveis.`);
  }

  if (!context) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-7 pb-12">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <span className="bg-purple-500/10 text-purple-400 p-3 rounded-xl border border-purple-500/20">
            <Gift className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Convites VIP da Minha Empresa</h1>
            <p className="text-slate-400 text-sm">
              Você possui <strong className="text-purple-300">{availableInvites.length} convite(s) disponível(is)</strong> para indicar estabelecimentos parceiros.
            </p>
          </div>
        </div>

        <Link
          href="/help/getting-started"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition self-start sm:self-auto"
        >
          Fazer depois
        </Link>
      </header>

      {/* Reward Card */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 p-5 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <strong className="text-purple-200 text-sm font-bold block">
              Sua recompensa: Ganhe 1 mensalidade quando uma empresa indicada se tornar um cliente elegível.
            </strong>
            <p className="text-slate-300 text-xs leading-relaxed">
              Indique estabelecimentos com fluxo de clientes na sua cidade (academias, clínicas, restaurantes, lojas). Ao fortalecerem a rede de mídia local, você amplia seus canais de divulgação e ganha descontos diretos na sua mensalidade.
            </p>
          </div>
        </div>
      </div>

      {/* Success / Copied Feedback Banner */}
      {feedbackMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <strong className="text-sm font-bold block text-white">✅ {feedbackMessage}</strong>
              <p className="text-xs text-emerald-300/80">Sua indicação ajuda a formar uma rede colaborativa forte na sua região.</p>
            </div>
          </div>

          <Link
            href="/help/getting-started"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition shrink-0"
          >
            CONTINUAR CONFIGURAÇÃO <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {copyError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {copyError}
        </div>
      )}

      {/* Share Box */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-purple-400" /> Mensagem Pronta para Compartilhar
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Copie a mensagem recomendada ou envie diretamente pelo WhatsApp da empresa parceira.
          </p>
        </div>

        {/* Invite Code Selection */}
        {invites.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-semibold">Usar convite:</span>
            {invites.map((inv: any, idx: number) => {
              const isSelected = inv.invite_code === activeInviteCode;
              const isUsed = inv.status === 'accepted';
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setSelectedInviteCode(inv.invite_code)}
                  disabled={isUsed}
                  className={`text-xs px-3 py-1.5 rounded-xl border font-mono transition ${
                    isSelected
                      ? 'border-purple-500 bg-purple-950/40 text-purple-300 font-bold'
                      : isUsed
                      ? 'border-slate-800 bg-slate-950/50 text-slate-600 cursor-not-allowed'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Convite {idx + 1} ({inv.invite_code}) {isUsed ? '— Aceito' : ''}
                </button>
              );
            })}
          </div>
        )}

        {/* Message Preview Box */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 font-sans whitespace-pre-line leading-relaxed">
          {messageText}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleCopy('message')}
            disabled={copying}
            className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition shadow-md shadow-purple-500/10"
          >
            {copiedType === 'message' ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
            {copiedType === 'message' ? 'Mensagem copiada!' : 'COPIAR MENSAGEM'}
          </button>

          <button
            type="button"
            onClick={() => handleCopy('link')}
            disabled={copying}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition"
          >
            {copiedType === 'link' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            {copiedType === 'link' ? 'Link copiado!' : 'COPIAR LINK'}
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition ml-auto"
          >
            <MessageSquare className="w-4 h-4" /> ENVIAR PELO WHATSAPP
          </button>
        </div>
      </section>

      {/* Invites List */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white">Seus Convites Cadastrados ({invites.length})</h2>

        <div className="space-y-3">
          {invites.map((invite: any, index: number) => (
            <article
              key={invite.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-sm">Convite {index + 1}</span>
                  <Status status={invite.status} />
                </div>
                <code className="text-purple-300 text-xs block mt-1.5 font-mono">{invite.invite_code}</code>
                {invite.invited_company_name && (
                  <p className="text-xs text-slate-400 mt-1.5">
                    Utilizado por: <strong className="text-slate-200">{invite.invited_company_name}</strong>
                  </p>
                )}
                {invite.accepted_at && (
                  <p className="text-[11px] text-slate-500">
                    Aceito em {new Date(invite.accepted_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedInviteCode(invite.invite_code);
                    handleCopy('link');
                  }}
                  disabled={copying || invite.status === 'accepted' || invite.status === 'expired'}
                  className="bg-slate-950 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-purple-300 px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2"
                >
                  {copiedCode === invite.invite_code && copiedType === 'link' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copiar Link
                    </>
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {}
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  let copied = false;
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    copied = document.execCommand('copy');
  } finally {
    textarea.remove();
  }
  if (!copied) throw new Error('CLIPBOARD_COPY_FAILED');
}

function Status({ status }: { status: string }) {
  const labels: Record<string, string> = {
    available: 'Disponível',
    created: 'Disponível',
    sent: 'Enviado',
    accepted: 'Aceito',
    expired: 'Expirado',
    cancelled: 'Cancelado',
  };
  const style =
    status === 'accepted'
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      : status === 'expired'
      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
      : 'bg-purple-500/10 text-purple-300 border border-purple-500/20';
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${style}`}>
      {labels[status] || status}
    </span>
  );
}
