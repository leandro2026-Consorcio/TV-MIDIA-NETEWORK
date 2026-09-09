'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { activateOrganicParticipantAction } from '@/app/actions/organic-network';

export default function OrganicRegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: 'midiapormidia@123',
    city: '',
    state: 'MT',
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    const effectivePassword = form.password?.trim() || 'midiapormidia@123';
    const isInitialDefault = effectivePassword === 'midiapormidia@123';

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: effectivePassword,
      options: {
        data: {
          full_name: form.name,
          account_type: 'organic',
          initial_password: isInitialDefault,
          must_change_password: isInitialDefault,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    if (data.session) {
      const result = await activateOrganicParticipantAction({
        displayName: form.name,
        city: form.city,
        state: form.state,
      });

      if (!result.success) {
        setMessage(result.error || 'Conta criada. Entre para concluir a ativação.');
        setBusy(false);
        return;
      }

      router.push('/organic');
      router.refresh();
      return;
    }

    setMessage('Conta criada. Confirme o e-mail, entre no portal e abra Rede Orgânica para concluir.');
    setBusy(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-sm text-cyan-300">
          ← Voltar ao site
        </Link>
        <h1 className="mt-8 text-3xl font-black">Quero ser uma Tela Orgânica</h1>
        <p className="mt-3 text-slate-400">
          Cadastre-se como pessoa participante. Você não receberá acesso empresarial.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-cyan-400/20 bg-slate-900 p-7">
          <Field label="Nome" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} />
          <Field label="E-mail" type="email" value={form.email} onChange={(v: string) => setForm({ ...form, email: v })} />
          <div>
            <Field
              label="Senha de acesso"
              type="text"
              minLength={6}
              value={form.password}
              onChange={(v: string) => setForm({ ...form, password: v })}
            />
            <span className="block mt-1 text-[11px] text-cyan-300">
              🔑 Senha inicial padrão: <strong className="font-mono">midiapormidia@123</strong> (recomendado alterar no primeiro acesso).
            </span>
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <Field label="Cidade" value={form.city} onChange={(v: string) => setForm({ ...form, city: v })} />
            <Field label="UF" maxLength={2} value={form.state} onChange={(v: string) => setForm({ ...form, state: v.toUpperCase() })} />
          </div>
          <label className="flex gap-3 text-xs leading-5 text-slate-400">
            <input required type="checkbox" /> Aceito participar com fator residencial 0,01, saldo pendente para validação e limites de segurança.
          </label>
          {message && <p className="rounded-xl bg-amber-300/10 p-3 text-sm text-amber-200">{message}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50">
            {busy ? 'Criando...' : 'Criar conta orgânica'}
          </button>
          <p className="text-center text-xs text-slate-500">
            Já possui conta? <Link href="/login" className="text-cyan-300">Entrar</Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({ label, onChange, ...props }: any) {
  return (
    <label className="block text-xs font-bold text-slate-400">
      {label}
      <input
        required
        {...props}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
      />
    </label>
  );
}
