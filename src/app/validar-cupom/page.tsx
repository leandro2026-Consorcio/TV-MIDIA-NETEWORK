'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  cashierLoginAction,
  cashierLookupCouponAction,
  cashierRedeemCouponAction,
  cashierLogoutAction,
} from '@/app/actions/cashier-portal';
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  Store,
  Clock,
  MapPin,
  Calendar,
  Lock,
  LogOut,
  RefreshCw,
  Sparkles,
  Ticket,
} from 'lucide-react';

function CashierPortalContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || searchParams.get('estabelecimento') || '';

  // Auth state
  const [establishmentCode, setEstablishmentCode] = useState(initialCode);
  const [pin, setPin] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Search & Validation state
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundCoupon, setFoundCoupon] = useState<any>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<any>(null);

  // Scanner simulation or input
  const [showManualInput, setShowManualInput] = useState(true);

  // Auto-login from localStorage if available
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('mpm_cashier_token');
      const savedCompany = localStorage.getItem('mpm_cashier_company');
      if (savedSession && savedCompany) {
        setSessionToken(savedSession);
        setCompanyInfo(JSON.parse(savedCompany));
      }
    } catch {}
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await cashierLoginAction({
        establishmentCode,
        pin,
        rememberDevice,
        deviceName: typeof navigator !== 'undefined' ? `${navigator.userAgent.slice(0, 30)}` : 'Terminal Caixa',
      });

      if (!res.success) {
        setLoginError(res.error || 'Credenciais inválidas.');
      } else {
        setSessionToken(res.sessionToken);
        setCompanyInfo(res.company);
        try {
          localStorage.setItem('mpm_cashier_token', res.sessionToken);
          localStorage.setItem('mpm_cashier_company', JSON.stringify(res.company));
        } catch {}
      }
    } catch (err: any) {
      setLoginError(err.message || 'Falha de conexão com o servidor.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    if (sessionToken) {
      await cashierLogoutAction(sessionToken);
    }
    setSessionToken(null);
    setCompanyInfo(null);
    setFoundCoupon(null);
    setRedeemSuccess(null);
    try {
      localStorage.removeItem('mpm_cashier_token');
      localStorage.removeItem('mpm_cashier_company');
    } catch {}
  };

  const handleLookup = async (codeToSearch?: string) => {
    const code = codeToSearch || couponCodeInput;
    if (!code || code.trim().length < 4) {
      setLookupError('Digite pelo menos 4 caracteres do cupom.');
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setFoundCoupon(null);
    setRedeemSuccess(null);

    try {
      const res = await cashierLookupCouponAction({
        codeOrToken: code.trim(),
        sessionToken: sessionToken || undefined,
      });

      if (!res.success) {
        setLookupError(res.error || 'Cupom não encontrado.');
      } else {
        setFoundCoupon(res.coupon);
      }
    } catch (err: any) {
      setLookupError(err.message || 'Erro ao consultar cupom.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!foundCoupon) return;

    setRedeemLoading(true);
    setLookupError(null);

    try {
      const res = await cashierRedeemCouponAction({
        couponIdOrCode: foundCoupon.code || foundCoupon.id,
        validationMethod: 'code',
        sessionToken: sessionToken || undefined,
      });

      if (!res.success) {
        setLookupError(res.error || 'Falha ao validar o cupom.');
      } else {
        setRedeemSuccess(res);
        setFoundCoupon(null);
        setCouponCodeInput('');
      }
    } catch (err: any) {
      setLookupError(err.message || 'Erro ao processar baixa.');
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleResetForNext = () => {
    setFoundCoupon(null);
    setRedeemSuccess(null);
    setLookupError(null);
    setCouponCodeInput('');
  };

  // Se não estiver logado no Caixa, exibe formulário de identificação
  if (!sessionToken || !companyInfo) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl mb-3 border border-emerald-500/20">
              <Store className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Portal do Caixa</h1>
            <p className="text-sm text-slate-400 mt-1">Validação Rápida de Cupons MPM</p>
          </div>

          {loginError && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Código do Estabelecimento
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ex: PIZZA4821"
                  value={establishmentCode}
                  onChange={(e) => setEstablishmentCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-lg tracking-wider placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                PIN do Caixa (4 a 8 dígitos)
              </label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-lg tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <Lock className="w-5 h-5 absolute right-3.5 top-3.5 text-slate-500" />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="remember"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-slate-400 cursor-pointer">
                Lembrar este dispositivo no caixa
              </label>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-3 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition duration-150 flex justify-center items-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Acessando Caixa...</span>
                </>
              ) : (
                <span>Entrar no Caixa</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-500">
              Precisa do Código ou PIN? Solicite ao administrador da sua empresa em{' '}
              <span className="text-slate-400">Benefícios & Prêmios → Acesso do Caixa</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Caixa Logado - Interface Operacional Mobile-First
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header Compacto do Estabelecimento */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">{companyInfo.tradeName}</h2>
            <p className="text-xs text-slate-400">
              {companyInfo.neighborhood ? `${companyInfo.neighborhood} — ` : ''}{companyInfo.city || 'MPM Rede'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Sair do Caixa"
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Conteúdo Principal do Caixa */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-center">
        {/* Banner de Sucesso Imediato: Visita Confirmada */}
        {redeemSuccess && (
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-4 shadow-xl mb-4 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Visita Confirmada ✅
              </span>
              <h3 className="text-xl font-bold text-white mt-3">{redeemSuccess.rewardTitle || 'Benefício Validado'}</h3>
              <p className="text-sm text-slate-300 mt-1">
                Cliente: <strong className="text-white">{redeemSuccess.participantName || 'Cliente MPM'}</strong>
              </p>
            </div>

            {redeemSuccess.goalReached && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-semibold">META DE VISITAS ATINGIDA 🎉</span>
              </div>
            )}

            <button
              onClick={handleResetForNext}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Validar Próximo Cupom</span>
            </button>
          </div>
        )}

        {/* Card do Cupom Localizado (Prévia antes da Baixa) */}
        {foundCoupon && !redeemSuccess && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl mb-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Cupom Válido
              </span>
              <span className="text-xs font-mono font-bold text-slate-300 tracking-wider">
                #{foundCoupon.code}
              </span>
            </div>

            <div className="space-y-2.5 text-sm">
              <div>
                <span className="text-xs text-slate-400">Benefício a Entregar:</span>
                <p className="text-lg font-bold text-white">{foundCoupon.benefitTitle}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-0.5">Cliente</span>
                  <p className="font-semibold text-white truncate">{foundCoupon.clientFirstName}</p>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-0.5">Horário Permitido</span>
                  <p className="font-semibold text-white flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {foundCoupon.allowedHours}
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {foundCoupon.allowedUnit}
                </span>
                <span className="text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> até {new Date(foundCoupon.expiresAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={handleRedeem}
                disabled={redeemLoading}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 text-base disabled:opacity-50"
              >
                {redeemLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Confirmando Visita...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Validar e Dar Baixa</span>
                  </>
                )}
              </button>

              <button
                onClick={handleResetForNext}
                className="w-full py-2.5 text-slate-400 hover:text-white text-xs font-semibold rounded-lg transition"
              >
                Cancelar busca
              </button>
            </div>
          </div>
        )}

        {/* Formulário de Busca e Leitura de Cupom */}
        {!foundCoupon && !redeemSuccess && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="text-center">
              <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl mb-2 border border-emerald-500/20">
                <Ticket className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-white">Validar Cupom</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Digite o código de 6 caracteres fornecido pelo cliente
              </p>
            </div>

            {lookupError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                <span>{lookupError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Código do Cupom
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="Ex: 7K4P92"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3.5 text-white font-mono text-xl tracking-widest text-center placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 uppercase font-bold"
                  />
                </div>
              </div>

              <button
                onClick={() => handleLookup()}
                disabled={lookupLoading || !couponCodeInput.trim()}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
              >
                {lookupLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Buscando Cupom...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>Consultar Cupom</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800/80 text-center">
              <span className="text-[11px] text-slate-500">
                🔒 Operação registrada com auditoria e controle de visita única.
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CashierPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
        </div>
      }
    >
      <CashierPortalContent />
    </Suspense>
  );
}
