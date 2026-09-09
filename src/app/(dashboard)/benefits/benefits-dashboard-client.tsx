'use client';

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
  RotateCcw
} from 'lucide-react';
import {
  saveCompanyBenefitAction,
  validateCompanyCouponAction,
  cancelCompanyCouponAction
} from '@/app/actions/organic-benefits';
import { calculatePromotionalContribution, formatAllowedWeekdays } from '@/lib/mpm/organic-benefits';

const money = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

interface BenefitsDashboardClientProps {
  initialTab?: 'meus' | 'cadastrar' | 'cupons' | 'divulgacao';
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
  const [tab, setTab] = useState<'meus' | 'cadastrar' | 'cupons' | 'divulgacao'>(initialTab);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || '');
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
  });

  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showCalculationModal, setShowCalculationModal] = useState(false);

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
          onClick={() => setTab('divulgacao')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            tab === 'divulgacao' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Megaphone className="h-4 w-4" /> Divulgação Gerada
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

          {/* Real-time preview card */}
          <div className="space-y-5">
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Cálculo Automático MPM</p>
              <h3 className="mt-2 text-xl font-black text-white">Sua Contribuição Promocional</h3>
              <p className="mt-1 text-xs text-slate-400">
                O valor informado é convertido automaticamente em pontuação para participantes e direitos de divulgação.
              </p>

              <div className="mt-6 space-y-4 border-t border-slate-800 pt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Valor Unitário</span>
                  <strong className="font-mono text-white">{money(preview.unitValue)}</strong>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Estoque Ofertado</span>
                  <strong className="text-white">{preview.quantity} unidades</strong>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3 text-sm">
                  <span className="text-slate-300">Valor Promocional Total</span>
                  <strong className="font-mono text-lg text-emerald-400">{money(preview.promotionalValue)}</strong>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Pontuação para Resgate</span>
                  <strong className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-emerald-300">
                    {preview.suggestedPoints} pontos
                  </strong>
                </div>

                <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 block">
                        Direito de Divulgação Gerado
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Referência comercial: R$ 0,25 / exibição equivalente
                      </span>
                    </div>
                    <strong className="text-lg font-black text-purple-200 font-mono">
                      {preview.grantedInsertions.toLocaleString('pt-BR')} unidades equivalentes
                    </strong>
                  </div>

                  <p className="text-[11px] text-slate-300">
                    Na Rede MPM cada tipo de tela possui um peso diferente. Telas residenciais e monitores Windows consomem uma fração menor desse saldo.
                  </p>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCalculationModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-200 text-xs font-bold transition"
                    >
                      COMO É CALCULADO?
                    </button>
                  </div>
                </div>
              </div>

              {preview.isSuspicious && (
                <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <p className="font-bold">Aviso de valor unitário acima da média:</p>
                  <p className="mt-1 text-amber-200/80">
                    Produtos acima de R$ 500,00 passam por revisão manual da equipe MPM antes da liberação total de
                    divulgação.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-xs text-slate-400">
              <strong className="block font-bold text-white">Como funciona o ciclo:</strong>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>O benefício é disponibilizado aos participantes da Rede Orgânica.</li>
                <li>Clientes resgatam com pontos acumulados mantendo telas ativas.</li>
                <li>O cupom nominal é apresentado na sua loja com código e QR Code.</li>
                <li>Você valida o cupom na aba Cupons & Resgates e confirma a visita.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUPONS & RESGATES (Scanner + Validação + Lista) */}
      {tab === 'cupons' && (
        <div className="space-y-6">
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
          {/* Metrics summary */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Contribuição Total"
              value={money(mediaMetrics.totalPromotionalValue)}
              sub="Convertida em mídia"
              icon={TrendingUp}
            />
            <MetricCard
              label="Inserções Concedidas"
              value={`${mediaMetrics.grantedInsertions}`}
              sub={`${mediaMetrics.executedInsertions} executadas`}
              icon={Megaphone}
            />
            <MetricCard
              label="Visitas Confirmadas"
              value={`${mediaMetrics.redeemedCoupons}`}
              sub={`de ${mediaMetrics.issuedCoupons} cupons emitidos`}
              icon={CheckCircle2}
            />
            <MetricCard
              label="Conversão Visita"
              value={`${mediaMetrics.conversionRate}%`}
              sub={`${mediaMetrics.expiredCoupons} expirados sem uso`}
              icon={TrendingUp}
            />
          </div>

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
                          {e.executed_insertions} / {e.granted_insertions} inserções
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

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>
                O valor dos produtos ou serviços disponibilizados gera um <strong>direito de divulgação</strong> na Rede MPM.
              </p>
              <p>
                A referência comercial vigente é de <strong>2.000 inserções comerciais ≈ R$ 500,00</strong>, o que equivale a <strong>R$ 0,25 por unidade de exibição comercial equivalente</strong> (ou 4 unidades por R$ 1,00).
              </p>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2.5">
                <strong className="text-white block text-sm font-bold">Pesos Oficiais por Tipo de Tela:</strong>
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
                A quantidade efetiva de exibições depende da disponibilidade de inventário e dos tipos de telas onde sua campanha for veiculada. Este direito é consumido exclusivamente por Proof of Play validado e não gera saldo financeiro em dinheiro ou Crédito MPM.
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
