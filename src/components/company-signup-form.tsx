'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Building2, CheckCircle2, Gift, Loader2, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  getPublicInviteAction,
  getOnboardingContextAction,
  getPublicSegmentsAction,
  getPublicSignupSettingsAction,
  registerCompanyWithTrialAction,
  type PublicSignupSettings,
} from '@/app/actions/onboarding';

export function CompanySignupForm({ inviteCode }: { inviteCode?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [settings, setSettings] = useState<PublicSignupSettings | null>(null);
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [invite, setInvite] = useState<{ code: string; inviterName: string; trialDays: number } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [phone, setPhone] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [participatesInNetwork, setParticipatesInNetwork] = useState(true);

  useEffect(() => {
    async function load() {
      const [settingsResult, segmentsResult, inviteResult, existingContext] = await Promise.all([
        getPublicSignupSettingsAction(),
        getPublicSegmentsAction(),
        inviteCode ? getPublicInviteAction(inviteCode) : Promise.resolve(null),
        getOnboardingContextAction(),
      ]);
      if (existingContext.success && existingContext.hasCompany) {
        router.replace('/dashboard');
        return;
      }
      setSettings(settingsResult.settings);
      setSegments(segmentsResult.segments);
      if (inviteResult) {
        if (inviteResult.success) setInvite(inviteResult.invite);
        else setInviteError(inviteResult.error);
      }
      setLoading(false);
    }
    load();
  }, [inviteCode, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');
    const result = await registerCompanyWithTrialAction({
      fullName: String(form.get('fullName') || ''),
      email,
      password,
      phone,
      tradeName: String(form.get('tradeName') || ''),
      corporateName: String(form.get('corporateName') || ''),
      cnpj,
      city: String(form.get('city') || ''),
      state: String(form.get('state') || ''),
      segmentId: String(form.get('segmentId') || ''),
      acceptedTerms: form.get('acceptedTerms') === 'on',
      participatesInNetwork,
      inviteCode: invite?.code,
    });

    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
      if ('alreadyOnboarded' in result && result.alreadyOnboarded) router.push('/dashboard');
      return;
    }

    if (result.shouldSignIn) {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        setSuccess(true);
        setError('Empresa criada. Entre com seu e-mail e senha para continuar.');
        setSubmitting(false);
        return;
      }
    }

    setSuccess(true);
    router.push('/onboarding');
    router.refresh();
  }

  if (loading) {
    return <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-sky-400" /></div>;
  }

  if (!settings?.enabled) {
    return (
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Cadastro temporariamente indisponível</h1>
        <p className="text-slate-400 text-sm mb-6">{settings?.disabledMessage}</p>
        <Link href="/login" className="text-sky-400 text-sm font-semibold hover:underline">Já tenho conta</Link>
      </div>
    );
  }

  if (inviteCode && inviteError) {
    return (
      <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Convite indisponível</h1>
        <p className="text-slate-400 text-sm mb-6">{inviteError}</p>
        <Link href="/empresa/cadastro" className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">Fazer cadastro normal</Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-sky-500/15 to-purple-500/15 border-b border-slate-800 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="bg-sky-500 p-3 rounded-2xl text-white"><Building2 className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Cadastre sua empresa</h1>
            <p className="text-slate-400 text-sm mt-1">
              Comece agora com {invite?.trialDays || settings.trialDays} dias gratuitos e {settings.invitesCount} convites VIP.
            </p>
            {invite && (
              <p className="mt-3 inline-flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full px-3 py-1.5">
                <Gift className="w-3.5 h-3.5" /> Convite de {invite.inviterName}
              </p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
        {error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex gap-3"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
        {success && <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" />Cadastro concluído. Preparando seu painel…</div>}

        <fieldset className="space-y-4">
          <legend className="text-sm font-bold text-white mb-3">Responsável pela conta</legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field name="fullName" label="Nome completo" required />
            <Field
              name="phone"
              label="Telefone / WhatsApp"
              required
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(66) 99999-8989"
            />
            <Field name="email" label="E-mail" type="email" required />
            <div>
              <Field
                name="password"
                label="Senha inicial de acesso"
                type="text"
                defaultValue="midiapormidia@123"
                required
                minLength={6}
                placeholder="midiapormidia@123"
              />
              <p className="mt-1.5 text-[11px] text-sky-400 flex items-center gap-1">
                <span>🔑 Senha inicial padrão: <strong className="font-mono text-sky-200">midiapormidia@123</strong> (recomendado alterar no primeiro acesso).</span>
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-slate-800 pt-6">
          <legend className="text-sm font-bold text-white mb-3">Dados da empresa</legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field name="tradeName" label="Nome fantasia" required />
            <Field name="corporateName" label="Razão social (opcional)" />
            <Field
              name="cnpj"
              label="CNPJ (opcional)"
              value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
            />
            <label className="text-xs font-semibold text-slate-300">
              Segmento <span className="text-rose-400">*</span>
              <select name="segmentId" required defaultValue="" className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-sky-500">
                <option value="" disabled>Selecione</option>
                {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
              </select>
            </label>
            <Field name="city" label="Cidade" required />
            <Field name="state" label="UF" required maxLength={2} placeholder="MT" />
          </div>
        </fieldset>

        {/* Consentimento de Participação na Rede */}
        <fieldset className="space-y-3 border-t border-slate-800 pt-6">
          <label className="flex items-start gap-3 text-xs text-slate-300 bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={participatesInNetwork}
              onChange={(e) => setParticipatesInNetwork(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
            />
            <div className="space-y-1">
              <strong className="block font-bold text-white">Quero participar da rede Mídia por Mídia da minha cidade</strong>
              <span className="block text-slate-300 leading-relaxed">
                Ao participar, sua empresa poderá aparecer para outras empresas participantes com nome fantasia, cidade e segmento para parcerias e campanhas locais. Você pode alterar essa preferência no painel quando quiser.
              </span>
            </div>
          </label>
        </fieldset>

        <label className="flex items-start gap-3 text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-4">
          <input name="acceptedTerms" type="checkbox" required className="mt-0.5 accent-sky-500" />
          <span>Li e aceito os termos de uso e a política de privacidade da plataforma.</span>
        </label>

        <button disabled={submitting || success} className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
          Criar empresa e iniciar período gratuito
        </button>
      </form>
    </div>
  );
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="text-xs font-semibold text-slate-300">
      {label} {props.required && <span className="text-rose-400">*</span>}
      <input {...props} className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500" />
    </label>
  );
}
