'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { requestPasswordResetAction } from '@/app/actions/auth';
import { Tv, Lock, Mail, Loader2, AlertCircle, Eye, EyeOff, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
        setLoading(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao realizar login.');
      setLoading(false);
    }
  };

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

      setRecoverySuccess(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao enviar o e-mail de recuperação.');
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
          <h1 className="text-xl font-semibold text-slate-200">
            {mode === 'login' ? 'Acesse sua conta' : 'Recuperar Senha'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === 'login'
              ? 'Gerencie suas telas, mídias, campanhas e rede'
              : 'Enviaremos instruções para o seu e-mail cadastrado'}
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'login' ? (
            /* Formulário de Login */
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setRecoverySuccess(false);
                      setMode('forgot');
                    }}
                    className="text-xs text-sky-400 hover:text-sky-300 hover:underline font-medium transition"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-11 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  Primeiro acesso? Use a senha pessoal criada no cadastro ou recupere o acesso.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-semibold py-3 rounded-xl text-sm transition flex justify-center items-center gap-2 shadow-lg shadow-sky-500/25"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Entrando...
                  </>
                ) : (
                  'Entrar no Painel'
                )}
              </button>
            </form>
          ) : (
            /* Modo Recuperação de Senha */
            <div className="space-y-5">
              {recoverySuccess ? (
                <div className="text-center py-2 space-y-4">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">E-mail de recuperação enviado!</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Enviamos as instruções de redefinição para <strong className="text-sky-300">{email}</strong>. Verifique sua caixa de entrada e pasta de spam.
                  </p>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 text-left">
                    <p className="font-semibold text-slate-200 mb-1">Dica de primeiro acesso:</p>
                    Use a senha pessoal criada no cadastro. Se precisar, redefina o acesso pelo e-mail.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setRecoverySuccess(false);
                      setError(null);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl text-xs transition"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar ao Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="p-3.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-200 flex items-start gap-2.5">
                    <KeyRound className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span>
                      Informe o e-mail da sua conta. Você receberá um link seguro para cadastrar uma nova senha.
                    </span>
                  </div>

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
                        placeholder="seu@email.com"
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
                      'Enviar Link no E-mail'
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMode('login');
                      }}
                      className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o Login
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {mode === 'login' && (
            <div className="mt-8 text-center text-sm text-slate-400 border-t border-slate-800/80 pt-6">
              Ainda não possui uma conta?{' '}
              <Link href="/empresa/cadastro" className="text-sky-400 font-medium hover:underline">
                Cadastre-se gratuitamente
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
