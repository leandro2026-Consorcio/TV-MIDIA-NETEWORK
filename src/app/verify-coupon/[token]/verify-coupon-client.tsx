'use client';

import { useState } from 'react';
import { QrCode, CheckCircle2, XCircle, Clock, AlertTriangle, Building2, User, Gift } from 'lucide-react';
import { validateCompanyCouponAction } from '@/app/actions/organic-benefits';
import { formatAllowedWeekdays } from '@/lib/mpm/organic-benefits';

interface VerifyCouponClientProps {
  coupon: any;
  token: string;
}

export function VerifyCouponClient({ coupon: initialCoupon, token }: VerifyCouponClientProps) {
  const [coupon, setCoupon] = useState<any>(initialCoupon);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const isReserved = coupon?.status === 'reserved';
  const isRedeemed = coupon?.status === 'redeemed';
  const isExpired = coupon?.status === 'expired' || new Date(coupon?.expires_at).getTime() <= Date.now();

  const handleValidate = async () => {
    setBusy(true);
    setResult(null);

    const res = await validateCompanyCouponAction(token, undefined, 'qr');
    setBusy(false);

    if (res.success) {
      setResult({
        type: 'ok',
        text: `Baixa confirmada! Benefício entregue a ${res.redemption.participant_name}.`,
      });
      setCoupon((prev: any) => ({ ...prev, status: 'redeemed', redeemed_at: new Date().toISOString() }));
    } else {
      setResult({
        type: 'err',
        text: res.error || 'Falha ao validar cupom.',
      });
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Ticket Top Banner */}
        <div
          className={`p-6 text-slate-950 ${
            isRedeemed
              ? 'bg-emerald-400'
              : isExpired
              ? 'bg-rose-400'
              : 'bg-gradient-to-r from-amber-400 to-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-900/80">Validador Oficial MPM</span>
            <QrCode className="h-5 w-5" />
          </div>
          <h1 className="mt-1 text-2xl font-black">CUPOM MPM #{coupon.coupon_code}</h1>
          <p className="text-xs font-bold opacity-90">
            {isRedeemed ? 'CUPOM UTILIZADO' : isExpired ? 'CUPOM EXPIRADO' : 'AGUARDANDO BAIXA'}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {result && (
            <div
              className={`rounded-xl border p-4 text-sm font-bold ${
                result.type === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              }`}
            >
              {result.text}
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950 p-5 text-xs">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-500" />
              <div>
                <span className="text-[10px] text-slate-500">Cliente Autorizado</span>
                <p className="font-bold text-white text-sm">{coupon.participant_display_name || 'Participante MPM'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
              <Gift className="h-4 w-4 text-amber-400" />
              <div>
                <span className="text-[10px] text-slate-500">Benefício / Prêmio</span>
                <p className="font-bold text-slate-200 text-sm">{coupon.organic_campaign_rewards?.title || 'Benefício'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
              <Building2 className="h-4 w-4 text-slate-500" />
              <div>
                <span className="text-[10px] text-slate-500">Estabelecimento</span>
                <p className="text-slate-300">{coupon.companies?.trade_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
              <Clock className="h-4 w-4 text-slate-500" />
              <div>
                <span className="text-[10px] text-slate-500">Validade Máxima</span>
                <p className="font-mono text-amber-300">
                  {new Date(coupon.expires_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <span className="text-[10px] text-slate-500">Dias Permitidos:</span>
              <p className="text-slate-300 font-bold">
                {formatAllowedWeekdays(coupon.organic_campaign_rewards?.allowed_weekdays)}
              </p>
              {coupon.organic_campaign_rewards?.allowed_time_start && coupon.organic_campaign_rewards?.allowed_time_end && (
                <p className="text-[11px] text-slate-400">
                  Horário: {coupon.organic_campaign_rewards.allowed_time_start} às {coupon.organic_campaign_rewards.allowed_time_end}
                </p>
              )}
            </div>
          </div>

          {/* Action Button */}
          {isReserved && !isExpired ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleValidate}
              className="w-full rounded-2xl bg-emerald-500 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40 shadow-lg"
            >
              {busy ? 'Processando...' : 'VALIDAR E DAR BAIXA NO ESTABELECIMENTO'}
            </button>
          ) : isRedeemed ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
              <p className="mt-2 text-sm font-bold text-emerald-300">Cupom já baixado com sucesso.</p>
              <p className="text-xs text-slate-400">Reutilização bloqueada pelo sistema.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-center">
              <XCircle className="mx-auto h-8 w-8 text-rose-400" />
              <p className="mt-2 text-sm font-bold text-rose-300">Cupom expirado ou inválido.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
