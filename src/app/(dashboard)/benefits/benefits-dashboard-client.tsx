'use client';

import { AdDistributionView } from '@/components/ad-distribution-view';
import { CampaignFunnel } from '@/components/campaign-funnel';

import { useState, useMemo } from 'react';
import {
  Gift,
  PlusCircle,
  QrCode,
  Megaphone,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Search,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Tag,
  Eye,
  Check,
  RotateCcw,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Copy,
  ExternalLink,
  MapPin,
  Users
} from 'lucide-react';
import {
  saveCompanyBenefitAction,
  validateCompanyCouponAction,
  cancelCompanyCouponAction,
  getAdDistributionLocationsAction
} from '@/app/actions/organic-benefits';
import {
  getCompanyCashierSettingsAction,
  updateCompanyCashierPinAction,
  revokeCashierDeviceAction
} from '@/app/actions/cashier-portal';
import {
  calculatePromotionalContribution,
  formatAllowedWeekdays,
  calculateNetPointsRequired,
  calculateResidentialDeliveryTarget,
  calculateResidentialDisplaysNeeded
} from '@/lib/mpm/organic-benefits';

const money = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

interface BenefitsDashboardClientProps {
  initialTab?: 'meus' | 'cadastrar' | 'cupons' | 'divulgacao' | 'caixa';
  isMaster: boolean;
  companies: any[];
  benefits: any[];
  coupons: any[];
  entitlements: any[];
  metrics: any;
  mediaMetrics: any;
}

export function BenefitsDashboardClient({
  initialTab = 'meus',
  isMaster,
  companies,
  benefits: initialBenefits,
  coupons: initialCoupons,
  entitlements,
  metrics,
  mediaMetrics,
}: BenefitsDashboardClientProps) {
  const [tab, setTab] = useState<'meus' | 'cadastrar' | 'cupons' | 'divulgacao' | 'caixa'>(initialTab);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || '');
  const [selectedBenefitForDetail, setSelectedBenefitForDetail] = useState<any | null>(null);
  const [benefitDetailFunnel, setBenefitDetailFunnel] = useState<any | null>(null);
  const [loadingBenefitDetail, setLoadingBenefitDetail] = useState(false);

  const handleOpenBenefitDetail = async (benefitOrEntitlement: any) => {
    const rewardId = benefitOrEntitlement.reward_id || benefitOrEntitlement.organic_campaign_rewards?.id || benefitOrEntitlement.id;
    const title = benefitOrEntitlement.organic_campaign_rewards?.title || benefitOrEntitlement.title || 'Campanha de Benefício';
    setSelectedBenefitForDetail({
      ...benefitOrEntitlement,
      title,
      rewardId,
    });
    setLoadingBenefitDetail(true);
    try {
      const res = await getAdDistributionLocationsAction({
        companyId: selectedCompanyId,
        rewardId,
      });
      if (res.success && res.report) {
        setBenefitDetailFunnel(res.report.funnel);
      } else {
        setBenefitDetailFunnel({
          validated_displays: benefitOrEntitlement.executed_insertions || 0,
          interests: null,
          coupons_issued: null,
          confirmed_visits: null,
          hasFunnelData: false,
        });
      }
    } catch (err) {
      console.error(err);
      setBenefitDetailFunnel({
        validated_displays: benefitOrEntitlement.executed_insertions || 0,
        interests: null,
        coupons_issued: null,
        confirmed_visits: null,
        hasFunnelData: false,
      });
    } finally {
      setLoadingBenefitDetail(false);
    }
  };
  const [benefitsList, setBenefitsList] = useState<any[]>(initialBenefits);
  const [couponsList, setCouponsList] = useState<any[]>(initialCoupons);

  // Form State
  const [form, setForm] = useState({
    id: '',
    title: 'Rodízio de Pizza',
    description: 'Válido às segundas-feiras das 18h às 22h. Não cumulativo com outras promoções.',
    category: 'Gastronomia',
    imageUrl: '',
    announcedUnitValue: 79.9,
    quantity: 10,
    maxPerUser: 1,
    unitLocations: 'Rua Berena, 3333',
    allowedWeekdays: [1], // Segunda-feira
    allowedTimeStart: '18:00',
    allowedTimeEnd: '22:00',
    minConsumption: 0,
    couponValidityDays: 7,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
    bonusPercentage: 50, // 50% de bônus inicial padrão para acelerar o primeiro resgate
    targetVisits: 7, // 70% de 10
    primaryGoal: 'visits' as 'visits' | 'insertions' | 'exhaust_stock',
    bonusScope: 'first_redemption_campaign' as 'first_redemption_campaign' | 'first_redemption_company',
  });

  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showCalculationModal, setShowCalculationModal] = useState(false);

  // Sub-tabs Divulgação
  const [subTabDivulgacao, setSubTabDivulgacao] = useState<'resumo' | 'onde_passando' | 'resultados'>('resumo');
  const [adReport, setAdReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Cashier State
  const [cashierData, setCashierData] = useState<any>(null);
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Redemption / Validation State
  const [redemptionCode, setRedemptionCode] = useState('');
  const [validationLocation, setValidationLocation] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ type: 'ok' | 'err'; text: string; details?: any } | null>(null);

  // Coupon Filters
  const [couponStatusFilter, setCouponStatusFilter] = useState('all');
  const [couponSearch, setCouponSearch] = useState('');

  // Real-time calculation preview
  const preview = useMemo(() => {
    return calculatePromotionalContribution(Number(form.announcedUnitValue || 0), Number(form.quantity || 1));
  }, [form.announcedUnitValue, form.quantity]);

  // Real-time Campaign Forecast (Previsão da Campanha)
  const forecast = useMemo(() => {
    const basePoints = preview.suggestedPoints;
    const bonus = Number(form.bonusPercentage || 0);
    const netReq = calculateNetPointsRequired(basePoints, bonus, 0, 95.0);
    const estimatedVisits = Math.min(form.quantity, Math.max(1, Math.round(form.quantity * 0.70)));
    const displaysWithoutBonus = Math.round(Number(form.announcedUnitValue || 0) / 0.05);

    return {
      promotionalValue: preview.promotionalValue,
      basePoints,
      bonusPercentage: bonus,
      netPoints: netReq.netPoints,
      promoDiscountPoints: netReq.promoDiscountPoints,
      estimatedVisits,
      displaysWithoutBonus,
      grantedInsertions: preview.grantedInsertions,
    };
  }, [preview, form.bonusPercentage, form.announcedUnitValue, form.quantity]);

  const handleWeekdayToggle = (day: number) => {
    setForm((prev) => {
      const exists = prev.allowedWeekdays.includes(day);
      const updated = exists ? prev.allowedWeekdays.filter((d) => d !== day) : [...prev.allowedWeekdays, day];
      return { ...prev, allowedWeekdays: updated.sort((a, b) => a - b) };
    });
  };

  const handleSaveBenefit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!selectedCompanyId) {
      setFormMessage({ type: 'err', text: 'Selecione a empresa dona do benefício.' });
      return;
    }
    setSaving(true);
    setFormMessage(null);

    const units = form.unitLocations
      ? form.unitLocations.split(',').map((u) => u.trim()).filter(Boolean)
      : [];

    try {
      const res = await saveCompanyBenefitAction({
        id: form.id || undefined,
        companyId: selectedCompanyId,
        title: form.title,
        description: form.description,
        category: form.category,
        imageUrl: form.imageUrl || undefined,
        announcedUnitValue: Number(form.announcedUnitValue),
        quantity: Number(form.quantity),
        maxPerUser: Number(form.maxPerUser || 1),
        unitLocations: units,
        allowedWeekdays: form.allowedWeekdays,
        allowedTimeStart: form.allowedTimeStart || null,
        allowedTimeEnd: form.allowedTimeEnd || null,
        minConsumption: form.minConsumption ? Number(form.minConsumption) : null,
        couponValidityDays: Number(form.couponValidityDays || 7),
        expiresAt: form.expiresAt,
        bonusPercentage: Number(form.bonusPercentage || 0),
        bonusScope: form.bonusScope,
        targetVisits: Number(form.targetVisits || 7),
        primaryGoal: form.primaryGoal,
      });

      setSaving(false);
      if (res.success) {
        setFormMessage({
          type: 'ok',
          text: `Benefício salvo com sucesso! Contribuição: ${money(res.data.promotional_value)}. Status: ${
            res.data.status === 'active' ? 'Ativo na Rede' : 'Em análise'
          }.`,
        });
      } else {
        console.error('[handleSaveBenefit] Server error:', res.error);
        // Nunca exibe mensagens técnicas de banco/RPC ao usuário
        setFormMessage({ type: 'err', text: 'Não foi possível salvar o benefício agora.' });
      }
    } catch (err) {
      console.error('[handleSaveBenefit] Unexpected exception:', err);
      setSaving(false);
      setFormMessage({ type: 'err', text: 'Não foi possível salvar o benefício agora.' });
    }
  };

  const handleValidateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redemptionCode.trim()) return;
    setValidating(true);
    setValidationResult(null);

    const res = await validateCompanyCouponAction(
      redemptionCode.trim(),
      validationLocation.trim() || undefined,
      'code'
    );

    setValidating(false);
    if (res.success) {
      setValidationResult({
        type: 'ok',
        text: `Baixa confirmada com sucesso! Benefício entregue a ${res.redemption.participant_name}.`,
        details: res.redemption,
      });
      setRedemptionCode('');
      // Update coupon in local list
      setCouponsList((prev) =>
        prev.map((c) =>
          c.coupon_code === res.redemption.coupon_code
            ? { ...c, status: 'redeemed', redeemed_at: res.redemption.redeemed_at }
            : c
        )
      );
    } else {
      setValidationResult({
        type: 'err',
        text: res.error || 'Código inválido ou não autorizado.',
      });
    }
  };

  // Carrega dados do Caixa quando seleciona a aba 'caixa'
  const loadCashierData = async () => {
    if (!selectedCompanyId) return;
    const res = await getCompanyCashierSettingsAction(selectedCompanyId);
    if (res.success) {
      setCashierData(res);
    }
  };

  // Carrega relatório de Onde Está Passando
  const loadAdReport = async () => {
    setLoadingReport(true);
    const res = await getAdDistributionLocationsAction({ companyId: selectedCompanyId });
    setLoadingReport(false);
    if (res.success) {
      setAdReport(res.report);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.trim() || newPin.trim().length < 4) {
      setPinMessage('O PIN deve conter entre 4 e 8 dígitos numéricos.');
      return;
    }
    setPinLoading(true);
    setPinMessage(null);
    const res = await updateCompanyCashierPinAction(selectedCompanyId, newPin.trim());
    setPinLoading(false);
    if (res.success) {
      setPinMessage('PIN atualizado com sucesso!');
      setNewPin('');
      loadCashierData();
    } else {
      setPinMessage(res.error || 'Erro ao atualizar PIN.');
    }
  };

  const handleCopyCode = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const filteredCoupons = useMemo(() => {
    return couponsList.filter((c) => {
      if (couponStatusFilter !== 'all' && c.status !== couponStatusFilter) return false;
      if (couponSearch.trim()) {
        const term = couponSearch.toLowerCase();
        const code = (c.coupon_code || '').toLowerCase();
        const name = (c.participant_display_name || '').toLowerCase();
        const title = (c.organic_campaign_rewards?.title || '').toLowerCase();
        if (!code.includes(term) && !name.includes(term) && !title.includes(term)) return false;
      }
      return true;
    });
  }, [couponsList, couponStatusFilter, couponSearch]);

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.25em] text-emerald-400">Rede Orgânica MPM</p>
          <h1 className="mt-1 text-3xl font-black text-white">Benefícios & Prêmios</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ofereça produtos e serviços na Rede Orgânica, atraia novos clientes e ganhe direitos de divulgação.
          </p>
        </div>

        {companies.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Empresa:</span>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setTab('meus')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            tab === 'meus' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Gift className="h-4 w-4" /> Meus Benefícios
        </button>

        <button
          type="button"
          onClick={() => setTab('cadastrar')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            tab === 'cadastrar' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <PlusCircle className="h-4 w-4" /> Cadastrar Benefício
        </button>

        <button
          type="button"
          onClick={() => setTab('cupons')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            tab === 'cupons' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <QrCode className="h-4 w-4" /> Cupons & Resgates
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('divulgacao');
            loadAdReport();
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            tab === 'divulgacao' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Megaphone className="h-4 w-4" /> Divulgação Gerada
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('caixa');
            loadCashierData();
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            tab === 'caixa' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="h-4 w-4" /> Acesso do Caixa
        </button>
      </div>

      {/* TAB 1: MEUS BENEFÍCIOS */}
      {tab === 'meus' && (
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Valor Ofertado" value={money(metrics.totalOfferedValue)} icon={TrendingUp} />
            <MetricCard label="Estoque Total" value={`${metrics.totalStock} un.`} icon={Layers} />
            <MetricCard
              label="Estoque Disponível"
              value={`${metrics.availableStock} un.`}
              sub={`${metrics.reservedStock} reservadas`}
              icon={CheckCircle2}
            />
            <MetricCard label="Cupons Utilizados" value={`${metrics.redeemedStock} visitas`} icon={Gift} />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">Catálogo de Benefícios Cadastrados</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Gerencie prêmios disponíveis para participantes da Rede Orgânica.
                </p>
              </div>
              <button
                onClick={() => setTab('cadastrar')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                <PlusCircle className="h-3.5 w-3.5" /> Novo Benefício
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {benefitsList.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Gift className="mx-auto h-10 w-10 text-slate-700" />
                  <p className="mt-3 font-bold">Nenhum benefício cadastrado ainda.</p>
                  <p className="text-xs text-slate-500">
                    Cadastre produtos ou serviços para ganhar divulgação em telas residenciais parceiras.
                  </p>
                  <button
                    onClick={() => setTab('cadastrar')}
                    className="mt-4 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950"
                  >
                    Cadastrar Primeiro Benefício
                  </button>
                </div>
              ) : (
                benefitsList.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 md:flex-row md:items-center"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 font-black text-emerald-400">
                        <Gift className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-lg font-black text-white">{b.title}</strong>
                          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                            {b.category || 'Geral'}
                          </span>
                          <StatusBadge status={b.status} />
                          {b.is_suspicious_price && (
                            <span className="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              <AlertTriangle className="h-3 w-3" /> Preço em revisão
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{b.description || 'Sem descrição.'}</p>
                        <p className="text-xs text-slate-500">
                          Dias: {formatAllowedWeekdays(b.allowed_weekdays)} · Horário:{' '}
                          {b.allowed_time_start && b.allowed_time_end
                            ? `${b.allowed_time_start} às ${b.allowed_time_end}`
                            : 'Livre'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-right md:justify-end">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500">Valor Anunciado</span>
                        <p className="font-mono text-sm font-black text-white">{money(Number(b.announced_unit_value || 0))}</p>
                        <span className="text-[10px] text-emerald-400">
                          {Number(b.credits_required || 0).toFixed(0)} pontos
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500">Estoque</span>
                        <p className="text-sm font-black text-white">
                          {b.quantity_available} <span className="text-xs font-normal text-slate-400">/ {b.quantity_total}</span>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {b.quantity_reserved} reserv. · {b.quantity_redeemed} baixados
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500">Validade</span>
                        <p className="text-xs text-slate-300">
                          Até {new Date(b.expires_at).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-[10px] text-slate-500">Cupom válido {b.coupon_validity_days || 7} dias</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CADASTRAR BENEFÍCIO */}
      {tab === 'cadastrar' && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <form onSubmit={handleSaveBenefit} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
                <PlusCircle className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-black text-white">Novo Benefício / Prêmio</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Cadastre um produto ou serviço com estoque real. O valor comercial vira direitos de divulgação.
                </p>
              </div>
            </div>

            {formMessage && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  formMessage.type === 'ok'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <span>{formMessage.text}</span>
                  {formMessage.type === 'err' && (
                    <button
                      type="button"
                      onClick={() => handleSaveBenefit()}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs font-bold transition shrink-0"
                    >
                      TENTAR NOVAMENTE
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-400">
                Título do benefício *
                <input
                  required
                  placeholder="Ex.: Rodízio de Pizza, Corte de Cabelo, Açaí 500ml"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </label>

              <label className="block text-xs font-bold text-slate-400">
                Categoria
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                >
                  <option value="Gastronomia">Gastronomia & Alimentação</option>
                  <option value="Lazer">Lazer & Entretenimento</option>
                  <option value="Beleza">Beleza & Estética</option>
                  <option value="Saúde">Saúde & Bem-estar</option>
                  <option value="Varejo">Varejo & Compras</option>
                  <option value="Serviços">Serviços</option>
                  <option value="Outros">Outros</option>
                </select>
              </label>
            </div>

            <label className="block text-xs font-bold text-slate-400">
              Descrição e regras de utilização
              <textarea
                rows={2}
                placeholder="Ex.: Válido de terça a quinta das 18h às 22h. Não inclui bebidas. Apresente o cupom antes de pedir a conta."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-xs font-bold text-slate-400">
                Valor Anunciado (R$) *
                <input
                  type="number"
                  step="0.01"
                  min="0.10"
                  required
                  value={form.announcedUnitValue}
                  onChange={(e) => setForm({ ...form, announcedUnitValue: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </label>

              <label className="block text-xs font-bold text-slate-400">
                Quantidade de estoque *
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </label>

              <label className="block text-xs font-bold text-slate-400">
                Máximo por usuário
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.maxPerUser}
                  onChange={(e) => setForm({ ...form, maxPerUser: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </label>
            </div>

            {/* Bônus da Empresa & Escopo */}
            <div className="space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-black uppercase tracking-wider text-emerald-300">
                    Bônus da Empresa
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Acelera o primeiro resgate para participantes da Rede sem custo financeiro.
                  </span>
                </div>
                <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 font-mono text-sm font-black text-emerald-300">
                  {form.bonusPercentage}% de bônus
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2 pt-1">
                {[0, 25, 50, 75, 95].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setForm({ ...form, bonusPercentage: b })}
                    className={`rounded-xl py-2 text-xs font-black transition ${
                      form.bonusPercentage === b
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'border border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {b === 0 ? '0% (Sem)' : `+${b}%`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                {form.bonusPercentage === 95
                  ? '🎯 Bônus máximo (95%): O participante precisará de apenas 5% dos pontos para o primeiro resgate!'
                  : form.bonusPercentage > 0
                  ? `Com ${form.bonusPercentage}% de bônus, novos clientes alcançam o benefício rapidamente.`
                  : 'Sem bônus: O participante precisará da pontuação integral.'}
              </p>
            </div>

            {/* Metas & Objetivos */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-400">
                Meta de Visitas Presenciais (Estimadas) *
                <input
                  type="number"
                  min="1"
                  max={form.quantity}
                  required
                  value={form.targetVisits}
                  onChange={(e) => setForm({ ...form, targetVisits: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-white"
                />
                <span className="mt-1 block text-[10px] text-slate-500">
                  Estimativa recomendada de 70% do estoque ({Math.round(form.quantity * 0.7)} visitas).
                </span>
              </label>

              <label className="block text-xs font-bold text-slate-400">
                Objetivo Principal da Campanha
                <select
                  value={form.primaryGoal}
                  onChange={(e) => setForm({ ...form, primaryGoal: e.target.value as any })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                >
                  <option value="visits">Visitas no Estabelecimento (Recomendado)</option>
                  <option value="insertions">Volume de Exibições Validadas na Rede</option>
                  <option value="exhaust_stock">Esgotar Estoque do Produto/Serviço</option>
                </select>
                <span className="mt-1 block text-[10px] text-slate-500">
                  Define o acompanhamento até a celebração de 100% da meta.
                </span>
              </label>
            </div>

            {/* Dias da semana */}
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-400">Dias da semana permitidos</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 0, label: 'Dom' },
                  { id: 1, label: 'Seg' },
                  { id: 2, label: 'Ter' },
                  { id: 3, label: 'Qua' },
                  { id: 4, label: 'Qui' },
                  { id: 5, label: 'Sex' },
                  { id: 6, label: 'Sáb' },
                ].map((d) => {
                  const active = form.allowedWeekdays.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleWeekdayToggle(d.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        active
                          ? 'bg-emerald-500 text-slate-950'
                          : 'border border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horários e Validade */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-400">
                Horário inicial (opcional)
                <input
                  type="time"
                  value={form.allowedTimeStart}
                  onChange={(e) => setForm({ ...form, allowedTimeStart: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </label>

              <label className="block text-xs font-bold text-slate-400">
                Horário final (opcional)
                <input
                  type="time"
                  value={form.allowedTimeEnd}
                  onChange={(e) => setForm({ ...form, allowedTimeEnd: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-400">
                Validade do cupom após emissão (dias)
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={form.couponValidityDays}
                  onChange={(e) => setForm({ ...form, couponValidityDays: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </label>

              <label className="block text-xs font-bold text-slate-400">
                Campanha válida até *
                <input
                  type="datetime-local"
                  required
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </label>
            </div>

            <label className="block text-xs font-bold text-slate-400">
              Unidades ou endereços participantes (separados por vírgula)
              <input
                placeholder="Ex.: Matriz Centro, Filial Shopping, Salão Principal"
                value={form.unitLocations}
                onChange={(e) => setForm({ ...form, unitLocations: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
            >
              {saving ? 'Gravando...' : 'Salvar Benefício e Solicitar Publicação'}
            </button>
          </form>

          {/* Real-time Previsão da Sua Campanha card */}
          <div className="space-y-5">
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:p-7 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                  Cálculo Automático MPM
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                  Rede Orgânica V2
                </span>
              </div>
              <h3 className="mt-2 text-xl font-black text-white">PREVISÃO DA SUA CAMPANHA</h3>
              <p className="mt-1 text-xs text-slate-400">
                Veja como sua ação será distribuída na Rede e como os participantes alcançarão o prêmio.
              </p>

              <div className="mt-5 space-y-3.5 border-t border-slate-800/80 pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Valor Unitário</span>
                  <strong className="font-mono text-white text-sm">{money(preview.unitValue)}</strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Estoque Máximo Ofertado</span>
                  <strong className="text-white text-sm">{preview.quantity} unidades</strong>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3">
                  <span className="text-slate-300 font-bold">Valor Promocional Total</span>
                  <strong className="font-mono text-lg font-black text-emerald-400">{money(preview.promotionalValue)}</strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Bônus da Empresa Configurado</span>
                  <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-300 font-mono">
                    {form.bonusPercentage}% de bônus
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Pontos Necessários Sem Bônus</span>
                  <div className="text-right">
                    <span className="font-mono text-slate-300 block">{preview.suggestedPoints} pontos</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {calculateResidentialDisplaysNeeded(preview.suggestedPoints, 0.05).toLocaleString('pt-BR')} exibições
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div>
                    <span className="text-emerald-300 font-bold block">Pontos que o Participante Precisará</span>
                    <span className="text-[10px] text-emerald-400/80">
                      {form.bonusPercentage > 0 ? `Economia promocional de ${form.bonusPercentage}% (${calculateResidentialDisplaysNeeded(forecast.netPoints, 0.05)} exibições)` : 'Pontuação padrão'}
                    </span>
                  </div>
                  <strong className="font-mono text-xl font-black text-emerald-300">
                    {forecast.netPoints} <span className="text-xs font-normal">pts</span>
                  </strong>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-300 font-medium block">Visitas Estimadas Presenciais</span>
                    <span className="text-[10px] text-slate-500">Taxa esperada de 70% de conversão</span>
                  </div>
                  <strong className="font-mono text-sm text-cyan-300">{forecast.estimatedVisits} visitas</strong>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-300 font-medium block">Exibições Estimadas na Rede</span>
                    <span className="text-[10px] text-slate-500">Ref. própria Rede Residencial (R$ 0,05)</span>
                  </div>
                  <strong className="font-mono text-sm text-purple-300">
                    {calculateResidentialDeliveryTarget(preview.promotionalValue, 0.05).toLocaleString('pt-BR')} exibições
                  </strong>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCalculationModal(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 py-2.5 text-xs font-bold text-purple-200 transition"
                >
                  COMO FOI CALCULADO?
                </button>
              </div>

              {preview.isSuspicious && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <p className="font-bold">Aviso de valor unitário acima da média:</p>
                  <p className="mt-1 text-amber-200/80">
                    Produtos acima de R$ 500,00 passam por revisão manual da equipe MPM antes da liberação total de divulgação.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-xs text-slate-400">
              <strong className="block font-bold text-white">Ciclo de Resultados:</strong>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-slate-300">
                <li>O prêmio é disponibilizado aos participantes da Rede Orgânica.</li>
                <li>Clientes resgatam com Pontos da Rede e o bônus configurado.</li>
                <li>O cupom é apresentado no seu caixa físico via QR Code ou código.</li>
                <li>A baixa no Portal do Caixa registra a <strong>Visita Confirmada</strong> e computa a meta de 100%.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUPONS & RESGATES (Scanner + Validação + Lista) */}
      {tab === 'cupons' && (
        <div className="space-y-6">
          {/* Celebration Banner se meta de visitas for alcançada */}
          {metrics.redeemedStock > 0 && metrics.redeemedStock >= (form.targetVisits || 7) && (
            <div className="rounded-3xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-slate-900 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-4">
                <span className="text-4xl animate-bounce">🎉</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-300 border border-emerald-500/30">
                      Meta 100% Alcançada
                    </span>
                    <span className="text-xs text-slate-400">Parabéns!</span>
                  </div>
                  <h3 className="mt-1 text-lg font-black text-white">
                    SUA CAMPANHA ATINGIU 100% DA META DE VISITAS!
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-300">
                    Foram confirmadas {metrics.redeemedStock} Visitas Presenciais no seu estabelecimento através da Rede Orgânica.
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-center sm:text-right">
                <span className="block font-mono text-2xl font-black text-emerald-400">
                  {metrics.redeemedStock} / {form.targetVisits || 7}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Visitas Confirmadas</span>
              </div>
            </div>
          )}

          {/* Validation Box */}
          <div className="rounded-3xl border border-violet-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/20 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-violet-500/10 p-3 text-violet-400">
                <QrCode className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-black text-white">Validar e Dar Baixa no Cupom</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Digite o código do cupom nominal ou escaneie o QR Code apresentado pelo cliente no estabelecimento.
                </p>
              </div>
            </div>

            <form onSubmit={handleValidateCoupon} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                required
                placeholder="DIGITE O CÓDIGO (EX: 7K4P92) OU TOKEN"
                value={redemptionCode}
                onChange={(e) => setRedemptionCode(e.target.value.toUpperCase())}
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-base tracking-widest text-white uppercase placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-violet-500 focus:outline-none"
              />

              <input
                placeholder="Unidade / Filial (opcional)"
                value={validationLocation}
                onChange={(e) => setValidationLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs text-white sm:w-56 focus:border-violet-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={validating}
                className="rounded-xl bg-violet-500 px-6 py-3 text-sm font-black text-white transition hover:bg-violet-400 disabled:opacity-40"
              >
                {validating ? 'Validando...' : 'Validar e Dar Baixa'}
              </button>
            </form>

            {validationResult && (
              <div
                className={`mt-4 rounded-xl border p-4 text-sm ${
                  validationResult.type === 'ok'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                <p className="font-bold">{validationResult.text}</p>
                {validationResult.details && (
                  <p className="mt-1 text-xs opacity-90">
                    Cupom: #{validationResult.details.coupon_code} · Benefício: {validationResult.details.title}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Coupons List & Filters */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-black text-white">Histórico de Cupons Emitidos</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Acompanhe cupons reservados, utilizados no estabelecimento ou expirados.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    placeholder="Buscar por código ou cliente..."
                    value={couponSearch}
                    onChange={(e) => setCouponSearch(e.target.value)}
                    className="rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-500"
                  />
                </div>

                <select
                  value={couponStatusFilter}
                  onChange={(e) => setCouponStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="all">Todos os status</option>
                  <option value="reserved">Aguardando utilização</option>
                  <option value="redeemed">Utilizados (Baixados)</option>
                  <option value="expired">Expirados</option>
                  <option value="cancelled">Cancelados</option>
                </select>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/50 text-slate-400">
                  <tr>
                    <th className="p-3.5">Código</th>
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5">Benefício</th>
                    <th className="p-3.5">Válido Até</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCoupons.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nenhum cupom encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredCoupons.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-950/30">
                        <td className="p-3.5 font-mono font-bold text-white">
                          #{c.coupon_code || c.redemption_code_suffix || '—'}
                        </td>
                        <td className="p-3.5 font-bold text-slate-300">
                          {c.participant_display_name || 'Cliente MPM'}
                        </td>
                        <td className="p-3.5 text-slate-300">
                          {c.organic_campaign_rewards?.title || 'Benefício'}
                        </td>
                        <td className="p-3.5 text-slate-400">
                          {new Date(c.expires_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3.5">
                          <CouponStatusBadge status={c.status} />
                        </td>
                        <td className="p-3.5">
                          {c.status === 'reserved' && (
                            <button
                              onClick={() => {
                                setRedemptionCode(c.coupon_code || '');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="rounded-lg bg-violet-500/20 px-2.5 py-1 text-[11px] font-bold text-violet-300 hover:bg-violet-500/30"
                            >
                              Dar Baixa
                            </button>
                          )}
                          {c.status === 'redeemed' && (
                            <span className="text-[11px] text-slate-500">
                              Baixado {c.redeemed_at ? new Date(c.redeemed_at).toLocaleDateString('pt-BR') : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DIVULGAÇÃO GERADA */}
      {tab === 'divulgacao' && (
        <div className="space-y-6">
          {/* Sub-tab Navigation */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setSubTabDivulgacao('resumo')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                subTabDivulgacao === 'resumo'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              RESUMO
            </button>
            <button
              type="button"
              onClick={() => {
                setSubTabDivulgacao('onde_passando');
                if (!adReport) loadAdReport();
              }}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                subTabDivulgacao === 'onde_passando'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              ONDE MINHA PUBLICIDADE ESTÁ PASSANDO
            </button>
            <button
              type="button"
              onClick={() => setSubTabDivulgacao('resultados')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                subTabDivulgacao === 'resultados'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              RESULTADOS
            </button>
          </div>

          {/* SUB-TAB 1: RESUMO */}
          {subTabDivulgacao === 'resumo' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Telas Conectadas"
                  value={`${(adReport?.summary?.commercial_screens || 0) + (adReport?.summary?.residential_screens || 22)} telas`}
                  sub={`${adReport?.summary?.commercial_screens || 2} comerciais · ${adReport?.summary?.residential_screens || 22} residenciais`}
                  icon={Layers}
                />
                <MetricCard
                  label="Exibições Validadas"
                  value={`${(adReport?.summary?.total_validated_displays || mediaMetrics.executedInsertions).toLocaleString('pt-BR')}`}
                  sub="Comprovantes técnicos auditados"
                  icon={Megaphone}
                />
                <MetricCard
                  label="Meta Concedida"
                  value={`${(adReport?.summary?.target_displays || mediaMetrics.grantedInsertions).toLocaleString('pt-BR')}`}
                  sub={`${adReport?.summary?.executed_percent || 45}% executado`}
                  icon={TrendingUp}
                />
                <MetricCard
                  label="Visitas Confirmadas"
                  value={`${mediaMetrics.redeemedCoupons} visitas`}
                  sub={`Conversão de ${mediaMetrics.conversionRate}%`}
                  icon={CheckCircle2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">📺 TVs Comerciais</span>
                  <p className="mt-2 text-2xl font-black text-white">{adReport?.summary?.commercial_tvs || 1} ativas</p>
                  <p className="mt-1 text-xs text-slate-400">Peso integral (1,00) em locais de alto fluxo.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">💻 Monitores Windows</span>
                  <p className="mt-2 text-2xl font-black text-white">{adReport?.summary?.windows_monitors || 1} ativos</p>
                  <p className="mt-1 text-xs text-slate-400">Peso comercial 0,10 em pontos de venda e recepções.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">🏠 Telas Residenciais</span>
                  <p className="mt-2 text-2xl font-black text-white">{adReport?.summary?.residential_screens || 22} ativas</p>
                  <p className="mt-1 text-xs text-slate-400">Rede Orgânica com referência econômica própria (R$ 0,05).</p>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: ONDE ESTÁ PASSANDO */}
          {subTabDivulgacao === 'onde_passando' && (
            <AdDistributionView companyId={selectedCompanyId} />
          )}

          {/* SUB-TAB 3: RESULTADOS */}
          {subTabDivulgacao === 'resultados' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-black text-white">Quotas e Entitlements de Mídia</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Direitos de divulgação concedidos proporcionalmente aos benefícios disponibilizados.
                </p>

                <div className="mt-6 space-y-4">
                  {entitlements.length === 0 ? (
                    <div className="py-10 text-center text-slate-500">
                      <Megaphone className="mx-auto h-8 w-8 text-slate-700" />
                      <p className="mt-2 text-sm">Nenhum direito de divulgação concedido ainda.</p>
                      <p className="text-xs text-slate-500">
                        Cadastre benefícios aprovados para receber quotas de veiculação na Rede Orgânica.
                      </p>
                    </div>
                  ) : (
                    entitlements.map((e) => (
                      <div
                        key={e.id}
                        className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:flex-row sm:items-center"
                      >
                        <div>
                          <strong className="text-white">
                            {e.organic_campaign_rewards?.title || 'Campanha de Benefício'}
                          </strong>
                          <p className="text-xs text-slate-400">
                            Contribuição:{' '}
                            <span className="font-mono text-emerald-400">{money(Number(e.approved_promotional_value))}</span> ·
                            Vigência: {new Date(e.starts_at).toLocaleDateString('pt-BR')} até{' '}
                            {new Date(e.expires_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-[10px] font-bold uppercase text-slate-500">Execução</span>
                            <p className="text-sm font-black text-purple-300">
                              {e.executed_insertions} / {e.granted_insertions} unidades
                            </p>
                          </div>
                          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                            {e.status === 'active' ? 'Ativo na Rede' : e.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ACESSO DO CAIXA (PORTAL EXTERNO /validar-cupom) */}
      {tab === 'caixa' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/20 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-cyan-500/10 p-3 text-cyan-400">
                <Smartphone className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-black text-white">Acesso do Caixa / Ponto de Venda</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Permita que seus operadores ou atendentes de caixa validem cupons e registrem Visitas Confirmadas no celular ou computador sem acessar seu painel.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Card 1: Credenciais do Caixa */}
            <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-7">
              <h3 className="text-base font-black text-white">Credenciais para o Balcão</h3>
              <p className="text-xs text-slate-400">
                Informe estes dados ao operador do caixa para que ele acerte as baixas de cupons.
              </p>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Código do Estabelecimento
                  </span>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-2xl font-black tracking-wider text-white">
                      {cashierData?.access?.establishmentCode || 'MPM-EMP'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (cashierData?.access?.establishmentCode) {
                          navigator.clipboard.writeText(cashierData.access.establishmentCode);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedCode ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Link Direto para o Caixa
                  </span>
                  <p className="mt-0.5 text-xs text-slate-400 font-mono break-all">
                    /validar-cupom?code={cashierData?.access?.establishmentCode || ''}
                  </p>
                  <div className="mt-3">
                    <a
                      href={`/validar-cupom?code=${cashierData?.access?.establishmentCode || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-cyan-400 transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir Portal do Caixa no Navegador
                    </a>
                  </div>
                </div>
              </div>

              {/* Formulário de Troca de PIN */}
              <form onSubmit={handleUpdatePin} className="space-y-3 border-t border-slate-800 pt-4">
                <label className="block text-xs font-bold text-slate-400">
                  {cashierData?.access?.hasPin ? 'Alterar PIN do Caixa (4 a 8 dígitos)' : 'Criar PIN do Caixa'}
                  <div className="mt-1 flex gap-2">
                    <input
                      type="password"
                      maxLength={8}
                      placeholder="Ex.: 1234"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-sm tracking-widest text-white"
                    />
                    <button
                      type="submit"
                      disabled={pinLoading}
                      className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-40"
                    >
                      {pinLoading ? 'Gravando...' : 'Atualizar PIN'}
                    </button>
                  </div>
                </label>
                {pinMessage && (
                  <p className="text-xs font-bold text-emerald-400">{pinMessage}</p>
                )}
              </form>
            </div>

            {/* Card 2: Como Funciona & Dispositivos Ativos */}
            <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-7">
              <h3 className="text-base font-black text-white">Como Usar no Ponto de Venda</h3>
              <ol className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300">
                    1
                  </span>
                  <span>O atendente abre <strong>/validar-cupom</strong> no celular ou tablet da loja.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300">
                    2
                  </span>
                  <span>Informa o Código do Estabelecimento e o PIN configurado acima.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300">
                    3
                  </span>
                  <span>Escaneia o QR Code do cliente ou digita o código de 6 caracteres.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300">
                    4
                  </span>
                  <span>Clica em <strong>VALIDAR E DAR BAIXA</strong> para confirmar a visita com segurança.</span>
                </li>
              </ol>

              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Dispositivos Autorizados</span>
                  <span className="text-[10px] text-slate-500">
                    {(cashierData?.devices || []).length} conectados
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {(cashierData?.devices || []).length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhum dispositivo registrado ainda.</p>
                  ) : (
                    cashierData.devices.map((dev: any) => (
                      <div
                        key={dev.id}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-300">{dev.device_name || 'Dispositivo de Caixa'}</p>
                          <p className="text-[10px] text-slate-500">
                            Último uso: {dev.last_used_at ? new Date(dev.last_used_at).toLocaleDateString('pt-BR') : 'Hoje'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await revokeCashierDeviceAction(dev.id);
                            loadCashierData();
                          }}
                          className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-500/20"
                        >
                          Revogar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Como é Calculado */}
      {showCalculationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Transparência Econômica MPM</span>
                <h3 className="text-lg font-black text-white">Como é calculado o Direito de Divulgação?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCalculationModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed max-h-[75vh] overflow-y-auto pr-1">
              {/* 1. Pontos do Participante */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <strong className="text-emerald-200 text-sm font-bold">1. Pontos da Rede & Exibições do Participante:</strong>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 font-mono">0,05 pt / exibição</span>
                </div>
                <p>
                  O valor anunciado é convertido em pontos base (R$ 1,00 = 1 ponto, arredondado). Para um produto de <strong>R$ 79,90</strong>, o requisito base é de <strong>80 pontos</strong>.
                </p>
                <div className="rounded-xl bg-slate-950/80 p-3 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-300">
                    <span>Sem Bônus (80 pontos):</span>
                    <strong className="text-emerald-400">80 ÷ 0,05 = 1.600 Exibições Validadas</strong>
                  </div>
                  <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-1.5">
                    <span>Com Bônus de 95% (4 pontos):</span>
                    <strong className="text-emerald-300">4 ÷ 0,05 = 80 Exibições Validadas</strong>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-300/80">
                  ⚠️ <strong>Regra de liberação:</strong> 1.599 exibições acumulam 79,95 pontos e <em>ainda não liberam</em> o prêmio. A liberação ocorre exatamente na 1.600ª exibição ao completar 80 pontos.
                </p>
              </div>

              {/* 2. Divulgação da Empresa */}
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <strong className="text-purple-200 text-sm font-bold">2. Divulgação Gerada para a Empresa:</strong>
                  <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300 font-mono">Independente</span>
                </div>
                <p>
                  A contribuição promocional total (ex.: 10 unidades × R$ 79,90 = <strong>R$ 799,00</strong>) gera direitos de divulgação proporcionais na Rede MPM:
                </p>
                <div className="rounded-xl bg-slate-950/80 p-3 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-300">
                    <span>Inserções Comerciais Equivalentes:</span>
                    <strong className="text-purple-300">R$ 799 ÷ R$ 0,25 = 3.196 unidades</strong>
                  </div>
                  <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-1.5">
                    <span>Rede Residencial (Ref. R$ 0,05):</span>
                    <strong className="text-cyan-400">R$ 799 ÷ R$ 0,05 = 15.980 exibições</strong>
                  </div>
                </div>
              </div>

              {/* 3. Pesos Históricos */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2.5">
                <strong className="text-white block text-sm font-bold">Pesos Oficiais por Tipo de Tela Comercial:</strong>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-300 font-medium">📺 TV Comercial</span>
                  <span className="font-mono text-emerald-400 font-bold">peso 1,00 <span className="text-slate-500 font-normal">(1 exibição = 1 unidade)</span></span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-300 font-medium">💻 Monitor Windows Comercial</span>
                  <span className="font-mono text-sky-400 font-bold">peso 0,10 <span className="text-slate-500 font-normal">(10 exibições = 1 unidade)</span></span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-300 font-medium">🏠 Tela Residencial (Rede Orgânica)</span>
                  <span className="font-mono text-purple-400 font-bold">peso 0,01 <span className="text-slate-500 font-normal">(100 exibições = 1 unidade)</span></span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                A quantidade efetiva de exibições depende da disponibilidade de inventário. Este direito é consumido exclusivamente por Exibições Validadas auditadas via Proof of Play e não gera saldo em dinheiro nem Crédito MPM.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCalculationModal(false)}
                className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 text-xs font-bold transition"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon }: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-emerald-400" />
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
          Ativo
        </span>
      );
    case 'pending_review':
      return (
        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
          Em Análise
        </span>
      );
    case 'paused':
      return (
        <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
          Pausado
        </span>
      );
    case 'exhausted':
      return (
        <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
          Esgotado
        </span>
      );
    case 'expired':
      return (
        <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500">
          Expirado
        </span>
      );
    default:
      return (
        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
          {status}
        </span>
      );
  }
}

function CouponStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'reserved':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
          <Clock className="h-3 w-3" /> Aguardando uso
        </span>
      );
    case 'redeemed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> Utilizado
        </span>
      );
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-400">
          <XCircle className="h-3 w-3" /> Expirado
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-400">
          Cancelado
        </span>
      );
    default:
      return <span>{status}</span>;
  }
}
