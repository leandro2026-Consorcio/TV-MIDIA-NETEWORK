'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Tv, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setHasSession(!!session);
          setCheckingSession(false);
        }
      } catch {
        if (mounted) setCheckingSession(false);
      }
    }

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não conferem.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          must_change_password: false,
          initial_password: false,
          password_updated_at: new Date().toISOString(),
        },
      });

      if (updateError) {
        setError(updateError.message || 'Não foi possível redefinir a senha.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao atualizar a senha.');
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
          <h1 className="text-xl font-semibold text-slate-200">Redefinir Senha</h1>
          <p className="text-slate-400 text-sm mt-1">Crie uma nova senha segura para acessar sua conta</p>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
          {checkingSession ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
              <span className="text-sm">Verificando sessão de recuperação...</span>
            </div>
          ) : success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-white">Senha alterada com sucesso!</h2>
              <p className="text-sm text-slate-400">
                Sua nova senha foi salva. Redirecionando para o seu painel...
              </p>
              <div className="pt-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 rounded-xl text-sm transition shadow-lg shadow-sky-500/25"
                >
                  Ir para o Painel <ArrowRight className="w-4 h-4" />
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

              <div className="mb-6 p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-300 text-xs leading-relaxed">
                <strong>Segurança:</strong> Digite sua nova senha pessoal. Se você utilizava a senha inicial temporária <code className="text-sky-200 bg-sky-950/60 px-1 py-0.5 rounded font-mono">midiapormidia@123</code>, escolha agora uma senha forte e de seu uso exclusivo.
              </div>

              <form onSubmit={handleResetPassword} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-11 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
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
                      <Loader2 className="w-5 h-5 animate-spin" /> Salvando nova senha...
                    </>
                  ) : (
                    'Salvar Nova Senha'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-400 border-t border-slate-800/80 pt-5">
                <Link href="/login" className="text-sky-400 font-medium hover:underline text-xs">
                  ← Voltar para o Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
