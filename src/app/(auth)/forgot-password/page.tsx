'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { requestPasswordResetAction } from '@/app/actions/auth';
import { Tv, Mail, Loader2, AlertCircle, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [supabase] = useState(() => createClient());

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Informe seu e-mail cadastrado.');
      setLoading(false);
      return;
    }

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const res = await requestPasswordResetAction(cleanEmail, origin);

      if (!res.success) {
        // Fallback no cliente via Supabase Browser SDK
        const { error: clientError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${origin}/auth/callback?next=/reset-password`,
        });

        if (clientError) {
          setError(clientError.message || res.error || 'Não foi possível enviar o e-mail de recuperação.');
          setLoading(false);
          return;
        }
      }

      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar o pedido de recuperação.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <div className="bg-sky-500 p-2.5 rounded-2xl text-white shadow-lg shadow-sky-500/20">
              <Tv className="w-7 h-7" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-white">Mídia por Mídia</span>
          </Link>
          <h1 className="text-xl font-semibold text-slate-200">Recuperar Senha</h1>
          <p className="text-slate-400 text-sm mt-1">Enviaremos um link de redefinição para o seu e-mail</p>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-white">Verifique sua caixa de entrada</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Enviamos um link de recuperação para <strong className="text-sky-300 font-semibold">{email}</strong>. Clique no link recebido para criar sua nova senha.
              </p>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
                Não recebeu? Verifique sua caixa de spam ou lixeira. O link é seguro e de uso único.
              </div>
              <div className="p-3.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-200 text-left flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Aviso para contas novas:</strong> Se você acabou de se cadastrar na plataforma, a senha inicial padrão é <code className="bg-sky-900/60 px-1.5 py-0.5 rounded font-mono font-bold text-sky-100">midiapormidia@123</code>.
                </span>
              </div>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl text-sm transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar para o Login
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mb-6 p-3.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-200 flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Dica de Primeiro Acesso:</strong> Se esta é uma conta recém-criada, a senha inicial atribuída é <code className="bg-sky-900/60 px-1 py-0.5 rounded font-mono text-sky-100">midiapormidia@123</code>. Se ainda não a alterou, tente fazer login com ela.
                </span>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Seu E-mail Cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ex: seu@email.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-semibold py-3 rounded-xl text-sm transition flex justify-center items-center gap-2 shadow-lg shadow-sky-500/25"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Enviando instruções...
                    </>
                  ) : (
                    'Enviar Senha / Link no E-mail'
                  )}
                </button>
              </form>

              <div className="mt-8 text-center text-sm text-slate-400 border-t border-slate-800/80 pt-6">
                Lembrou da senha?{' '}
                <Link href="/login" className="text-sky-400 font-medium hover:underline">
                  Voltar para o login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
