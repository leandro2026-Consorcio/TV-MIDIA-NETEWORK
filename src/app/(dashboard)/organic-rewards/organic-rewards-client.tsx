'use client';

import { useState } from 'react';
import {
  Gift,
  QrCode,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  X,
  AlertCircle,
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react';
import { reserveOrganicCouponAction } from '@/app/actions/organic-benefits';
import { formatAllowedWeekdays } from '@/lib/mpm/organic-benefits';
import { getQrCodeImageUrl, getQrVerificationUrl } from '@/lib/qr';

interface OrganicRewardsClientProps {
  participant: any;
  rewards: any[];
  coupons: any[];
}

export function OrganicRewardsClient({
  participant: initialParticipant,
  rewards: initialRewards,
  coupons: initialCoupons,
}: OrganicRewardsClientProps) {
  const [participant, setParticipant] = useState<any>(initialParticipant);
  const [rewards, setRewards] = useState<any[]>(initialRewards);
  const [coupons, setCoupons] = useState<any[]>(initialCoupons);
  const [activeTab, setActiveTab] = useState<'catalogo' | 'meus_cupons'>('catalogo');

  // Confirmation & Coupon Modal
  const [selectedReward, setSelectedReward] = useState<any | null>(null);
  const [activeCouponModal, setActiveCouponModal] = useState<any | null>(null);
  const [reserving, setReserving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableBalance = Number(participant?.available_balance || 0);

  const handleConfirmRedemption = async () => {
    if (!selectedReward) return;
    setReserving(true);
    setErrorMsg(null);

    const res = await reserveOrganicCouponAction(selectedReward.id);
    setReserving(false);

    if (res.success) {
      // Deduct balance and update rewards locally
      const cost = Number(selectedReward.credits_required || 0);
      setParticipant((prev: any) => ({
        ...prev,
        available_balance: Math.max(0, Number(prev?.available_balance || 0) - cost),
      }));

      setRewards((prev) =>
        prev.map((r) =>
          r.id === selectedReward.id
            ? {
                ...r,
                quantity_available: Math.max(0, r.quantity_available - 1),
                quantity_reserved: (r.quantity_reserved || 0) + 1,
              }
            : r
        )
      );

      const newCoupon = {
        id: res.redemption.redemption_id,
        coupon_code: res.redemption.coupon_code,
        qr_token: res.redemption.qr_token,
        participant_display_name: res.redemption.participant_name,
        status: 'reserved',
        reserved_at: new Date().toISOString(),
        expires_at: res.redemption.expires_at,
        organic_campaign_rewards: selectedReward,
        companies: selectedReward.companies,
      };

      setCoupons((prev) => [newCoupon, ...prev]);
      setSelectedReward(null);
      setActiveCouponModal(newCoupon);
    } else {
      setErrorMsg(res.error || 'Não foi possível reservar o benefício.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">Rede Orgânica MPM</p>
          <h1 className="mt-1 text-3xl font-black text-white">Prêmios Orgânicos</h1>
          <p className="mt-1 text-sm text-slate-400">
            Troque seus pontos acumulados em telas residenciais por prêmios e experiências locais.
          </p>
        </div>

        {participant && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-3">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <div>
              <span className="text-[10px] font-bold uppercase text-amber-300">Meu Saldo Disponível</span>
              <p className="font-mono text-xl font-black text-white">
                {availableBalance.toFixed(0)} <span className="text-xs font-normal text-amber-300">pontos</span>
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('catalogo')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'catalogo'
              ? 'bg-amber-400 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Gift className="h-4 w-4" /> Catálogo de Prêmios
        </button>

        <button
          onClick={() => setActiveTab('meus_cupons')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'meus_cupons'
              ? 'bg-amber-400 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <QrCode className="h-4 w-4" /> Meus Cupons ({coupons.length})
        </button>
      </div>

      {/* TAB: CATÁLOGO */}
      {activeTab === 'catalogo' && (
        <section className="space-y-6">
          {rewards.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 py-16 text-center text-slate-500">
              <Gift className="mx-auto h-12 w-12 text-slate-700" />
              <p className="mt-3 text-lg font-bold text-white">Nenhum prêmio disponível no momento.</p>
              <p className="text-xs text-slate-400">Novos estabelecimentos parceiros estão adicionando benefícios.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rewards.map((reward) => {
                const requiredPoints = Math.round(Number(reward.credits_required || 1));
                const canAfford = availableBalance >= requiredPoints;
                const inStock = Number(reward.quantity_available) > 0;

                return (
                  <article
                    key={reward.id}
                    className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 transition hover:border-slate-700"
                  >
                    <div>
                      {/* Image or Category Banner */}
                      <div className="relative h-40 w-full bg-gradient-to-tr from-amber-500/20 via-slate-800 to-purple-500/10 p-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-slate-950/80 px-2.5 py-1 text-[11px] font-bold text-amber-300 backdrop-blur-sm">
                            {reward.category || 'Gastronomia'}
                          </span>
                          <span className="rounded-full bg-slate-950/80 px-2.5 py-1 text-[11px] font-bold text-slate-300 backdrop-blur-sm">
                            Restam {reward.quantity_available}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-300">{reward.companies?.trade_name}</p>
                          <h3 className="mt-0.5 text-xl font-black text-white">{reward.title}</h3>
                        </div>
                      </div>

                      <div className="p-5 space-y-3">
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {reward.description || 'Apresente seu cupom no estabelecimento para resgatar.'}
                        </p>

                        <div className="space-y-1.5 border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-amber-400" />
                            <span>Uso: {formatAllowedWeekdays(reward.allowed_weekdays)}</span>
                          </div>

                          {reward.allowed_time_start && reward.allowed_time_end && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-amber-400" />
                              <span>
                                Horário: {reward.allowed_time_start} às {reward.allowed_time_end}
                              </span>
                            </div>
                          )}

                          {reward.city && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-amber-400" />
                              <span>
                                {reward.city}, {reward.state || 'MT'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-800 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500">Pontos</span>
                          <p className="text-xl font-black text-amber-300">{requiredPoints} pts</p>
                        </div>

                        <button
                          type="button"
                          disabled={!canAfford || !inStock}
                          onClick={() => {
                            setSelectedReward(reward);
                            setErrorMsg(null);
                          }}
                          className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-30"
                        >
                          {!inStock ? 'Esgotado' : !canAfford ? 'Saldo insuficiente' : 'RESGATAR'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB: MEUS CUPONS */}
      {activeTab === 'meus_cupons' && (
        <section className="space-y-4">
          {coupons.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 py-16 text-center text-slate-500">
              <QrCode className="mx-auto h-12 w-12 text-slate-700" />
              <p className="mt-3 text-lg font-bold text-white">Você ainda não possui cupons resgatados.</p>
              <p className="text-xs text-slate-400">Escolha um prêmio no catálogo acima e clique em Resgatar.</p>
              <button
                onClick={() => setActiveTab('catalogo')}
                className="mt-4 rounded-xl bg-amber-400 px-5 py-2 text-xs font-black text-slate-950"
              >
                Explorar Prêmios
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coupons.map((c) => {
                const isWaiting = c.status === 'reserved';
                const isRedeemed = c.status === 'redeemed';
                const isExpired = c.status === 'expired';

                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveCouponModal(c)}
                    className="cursor-pointer rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-white">#{c.coupon_code || '—'}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          isWaiting
                            ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300'
                            : isRedeemed
                            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border border-slate-700 bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isWaiting ? 'Aguardando uso' : isRedeemed ? 'Utilizado' : 'Expirado'}
                      </span>
                    </div>

                    <h4 className="mt-3 font-black text-white">{c.organic_campaign_rewards?.title || 'Benefício'}</h4>
                    <p className="text-xs text-slate-400">{c.companies?.trade_name || 'Estabelecimento Parceiro'}</p>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
                      <span>Válido até {new Date(c.expires_at).toLocaleDateString('pt-BR')}</span>
                      <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                        Abrir Cupom <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* CONFIRMATION RESGATE MODAL */}
      {selectedReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-amber-400/10 p-2.5 text-amber-400">
                <Gift className="h-5 w-5" />
              </span>
              <button onClick={() => setSelectedReward(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <h3 className="mt-4 text-xl font-black text-white">Confirmar Resgate de Prêmio</h3>
            <p className="mt-1 text-xs text-slate-400">
              Ao confirmar, os pontos serão debitados e um cupom nominal exclusivo será gerado.
            </p>

            <div className="mt-5 space-y-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Benefício:</span>
                <strong className="text-white">{selectedReward.title}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estabelecimento:</span>
                <span className="text-slate-300">{selectedReward.companies?.trade_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pontos necessários:</span>
                <strong className="text-amber-300">{Math.round(Number(selectedReward.credits_required))} pontos</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dias permitidos:</span>
                <span className="text-slate-300">{formatAllowedWeekdays(selectedReward.allowed_weekdays)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Validade do cupom:</span>
                <span className="text-slate-300">{selectedReward.coupon_validity_days || 7} dias após emissão</span>
              </div>
            </div>

            {errorMsg && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedReward(null)}
                className="flex-1 rounded-xl border border-slate-700 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={reserving}
                onClick={handleConfirmRedemption}
                className="flex-1 rounded-xl bg-amber-400 py-3 text-xs font-black text-slate-950 hover:bg-amber-300 disabled:opacity-40"
              >
                {reserving ? 'Gerando Cupom...' : 'Confirmar Resgate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUPOM MPM MODAL (Section 17: CUPOM MPM) */}
      {activeCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-amber-400/30 bg-slate-900 shadow-2xl">
            {/* Header Ticket Style */}
            <div className="bg-gradient-to-r from-amber-400 to-amber-300 p-5 text-slate-950 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-900/80">Cupom Oficial</p>
                <h3 className="text-2xl font-black">CUPOM MPM</h3>
              </div>
              <button
                onClick={() => setActiveCouponModal(null)}
                className="rounded-full bg-slate-950/10 p-1.5 text-slate-950 hover:bg-slate-950/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-center">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Código do Cupom</span>
                <strong className="mt-1 block font-mono text-3xl font-black tracking-widest text-white">
                  {activeCouponModal.coupon_code}
                </strong>
              </div>

              {/* QR Code */}
              <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border border-slate-800 bg-white p-2 shadow-md">
                <img
                  src={getQrCodeImageUrl(getQrVerificationUrl(activeCouponModal.qr_token || activeCouponModal.coupon_code), 180)}
                  alt="QR Code do Cupom"
                  className="h-full w-full object-contain"
                />
              </div>

              {/* Status Badge */}
              <div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                    activeCouponModal.status === 'reserved'
                      ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300'
                      : activeCouponModal.status === 'redeemed'
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border border-slate-700 bg-slate-800 text-slate-400'
                  }`}
                >
                  {activeCouponModal.status === 'reserved' ? 'AGUARDANDO UTILIZAÇÃO' : activeCouponModal.status.toUpperCase()}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-left text-xs">
                <div>
                  <span className="text-[10px] text-slate-500">Cliente:</span>
                  <p className="font-bold text-white">
                    {activeCouponModal.participant_display_name || participant?.display_name || 'Participante MPM'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Benefício:</span>
                  <p className="font-bold text-slate-200">
                    {activeCouponModal.organic_campaign_rewards?.title || 'Benefício'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Estabelecimento:</span>
                  <p className="text-slate-300">
                    {activeCouponModal.companies?.trade_name || activeCouponModal.organic_campaign_rewards?.companies?.trade_name}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Válido até:</span>
                  <p className="font-mono text-amber-300">
                    {new Date(activeCouponModal.expires_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Dias permitidos:</span>
                  <p className="text-slate-300">
                    {formatAllowedWeekdays(activeCouponModal.organic_campaign_rewards?.allowed_weekdays)}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Apresente esta tela ou o código no estabelecimento para que o atendente dê baixa na visita.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
