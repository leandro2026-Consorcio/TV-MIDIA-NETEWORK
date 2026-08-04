'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const PASSWORD_MIN_LENGTH = 12;

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (!/[a-z]/.test(password)) return 'Inclua pelo menos uma letra minúscula.';
  if (!/[A-Z]/.test(password)) return 'Inclua pelo menos uma letra maiúscula.';
  if (!/[0-9]/.test(password)) return 'Inclua pelo menos um número.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Inclua pelo menos um caractere especial.';
  return null;
}

export default function AccountSecurityPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState('');
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await (supabase.from('profiles') as any)
        .select('is_master_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_master_admin) {
        router.replace('/dashboard');
        return;
      }

      if (active) {
        setEmail(user.email || '');
        setCheckingAccess(false);
      }
    }

    void checkAccess();
    return () => { active = false; };
  }, [router, supabase]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email) {
      setError('Não foi possível identificar o e-mail da conta atual.');
      return;
    }
    if (!currentPassword) {
      setError('Informe a senha atual.');
      return;
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('A nova senha deve ser diferente da senha atual.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: reauthenticationError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (reauthenticationError) {
        setError('A senha atual está incorreta.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message || 'Não foi possível alterar a senha.');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Senha alterada. Por segurança, todas as sessões serão encerradas.');

      await supabase.auth.signOut({ scope: 'global' });
      router.replace('/login');
      router.refresh();
    } catch {
      setError('Ocorreu um erro inesperado ao alterar a senha. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingAccess) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
        Validando acesso Master Admin...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-amber-400">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-widest">Master Admin</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Segurança da Conta</h1>
        <p className="mt-1 text-sm text-slate-400">
          Altere sua senha administrativa confirmando primeiro a senha atual.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="rounded-xl bg-purple-500/10 p-3 text-purple-400">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-bold text-white">Alterar senha</h2>
            <p className="text-xs text-slate-500">Conta: {email}</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-5 flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <PasswordField
            id="current-password"
            label="Senha atual"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <PasswordField
            id="new-password"
            label="Nova senha"
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
          />
          <PasswordField
            id="confirm-password"
            label="Confirmar nova senha"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          <p className="rounded-xl bg-slate-950 p-3 text-xs leading-relaxed text-slate-400">
            A nova senha deve ter pelo menos 12 caracteres, com letra maiúscula, minúscula, número e caractere especial.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
            {submitting ? 'Alterando senha...' : 'Alterar senha e encerrar sessões'}
          </button>
        </form>
      </section>
    </div>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">
        {label}
      </label>
      <input
        id={id}
        type="password"
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
      />
    </div>
  );
}
