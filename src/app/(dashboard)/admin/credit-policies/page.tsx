'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CreditPolicyRule, RuleType, Company } from '@/types';
import { 
  getCreditPolicyRulesAction, 
  createCreditPolicyRuleAction, 
  updateCreditPolicyRuleAction, 
  applyTrialCreditPolicyAction, 
  applyMonthlyNetworkQuotaAction 
} from '@/app/actions/network';
import { Sliders, Plus, CheckCircle2, AlertCircle, Loader2, Sparkles, ShieldAlert, Award } from 'lucide-react';

export default function CreditPoliciesPage() {
  const [rules, setRules] = useState<CreditPolicyRule[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedRuleType, setSelectedRuleType] = useState<RuleType>('trial_standard');

  // Form State
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState<RuleType>('trial_standard');
  const [receivedCreditType, setReceivedCreditType] = useState('trial_credit');
  const [receivedCredits, setReceivedCredits] = useState<string>('50');
  const [cededCreditType, setCededCreditType] = useState('network_inventory_credit');
  const [cededCredits, setCededCredits] = useState<string>('300');
  const [validityDays, setValidityDays] = useState<string>('60');
  const [maxGradePercent, setMaxGradePercent] = useState<string>('10');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getCreditPolicyRulesAction();
      if (res.success) {
        setRules(res.rules as CreditPolicyRule[]);
      }

      const { data: compList } = await (supabase.from('companies') as any)
        .select('*')
        .order('trade_name');

      if (compList && compList.length > 0) {
        setCompanies(compList as Company[]);
        setSelectedCompanyId(compList[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supabase]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const res = await createCreditPolicyRuleAction({
      name,
      rule_type: ruleType,
      received_credit_type: receivedCreditType,
      received_credits: parseFloat(receivedCredits),
      ceded_credit_type: cededCreditType,
      ceded_credits: parseFloat(cededCredits),
      validity_days: validityDays ? parseInt(validityDays, 10) : null,
      max_external_grade_percentage: parseFloat(maxGradePercent),
      requires_manual_approval: true,
    });

    if (!res.success) {
      setError(res.error || 'Erro ao criar regra de política.');
      setSubmitting(false);
      return;
    }

    setSuccess('Regra comercial de crédito criada com sucesso!');
    setName('');
    setSubmitting(false);
    await loadData();
  };

  const handleApplyPolicyToCompany = async () => {
    if (!selectedCompanyId) return;
    setApplying(true);
    setError(null);
    setSuccess(null);

    let res;
    if (selectedRuleType === 'paid_plan_monthly') {
      res = await applyMonthlyNetworkQuotaAction(selectedCompanyId);
    } else {
      res = await applyTrialCreditPolicyAction(selectedCompanyId, selectedRuleType);
    }

    if (!res.success) {
      setError(res.error || 'Erro ao aplicar política.');
      setApplying(false);
      return;
    }

    setSuccess('Política comercial e inventário cedido aplicados com sucesso à empresa!');
    setApplying(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Políticas Comerciais da Rede</h1>
          <p className="text-slate-400 text-sm mt-1">
            Configuração de créditos recebidos para consumo e inventário cedido à rede (Master Admin).
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Caixa de Aplicação Manual de Política */}
      <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="bg-amber-500 p-2 rounded-xl text-slate-950">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Aplicar Política Comercial a uma Empresa</h2>
            <p className="text-xs text-slate-400">Concede saldo de consumo na carteira e registra a cota de inventário cedido à rede</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Empresa Alvo</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name} ({c.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Programa / Regra Comercial</label>
            <select
              value={selectedRuleType}
              onChange={(e) => setSelectedRuleType(e.target.value as RuleType)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="trial_standard">Trial Comum (Recebe 50 CR / Cede 300 CR)</option>
              <option value="trial_immediate_conversion">Conversão Imediata (Recebe 100 CR / Cede 300 CR)</option>
              <option value="vip_invite">Convite VIP (Recebe 50 CR / Cede 300 CR)</option>
              <option value="paid_plan_monthly">Cliente Pagante Mensal (Cede 50 CR Cota Mensal)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={applying || !selectedCompanyId}
              onClick={handleApplyPolicyToCompany}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold py-2 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Aplicar Regra
            </button>
          </div>
        </div>
      </div>

      {/* Formulário de Criação de Regras */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="bg-sky-500 p-2 rounded-xl text-white">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Cadastrar Nova Regra de Política</h2>
            <p className="text-xs text-slate-400">Defina créditos recebidos para anúncio e créditos de inventário cedido</p>
          </div>
        </div>

        <form onSubmit={handleCreateRule} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Nome da Regra *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Trial Especial de Inauguração"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Tipo de Regra Comercial *</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as RuleType)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="trial_standard">trial_standard (Trial Comum)</option>
              <option value="trial_immediate_conversion">trial_immediate_conversion (Fechou no Ato)</option>
              <option value="vip_invite">vip_invite (Convite VIP)</option>
              <option value="paid_plan_monthly">paid_plan_monthly (Cliente Pagante Mensal)</option>
              <option value="manual_bonus">manual_bonus (Bônus Comercial)</option>
              <option value="exchange_agreement">exchange_agreement (Acordo de Permuta)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Créditos Recebidos para Anúncio (Consumo)</label>
            <input
              type="number"
              min="0"
              value={receivedCredits}
              onChange={(e) => setReceivedCredits(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Inventário Cedido à Rede (Telas da Empresa)</label>
            <input
              type="number"
              min="0"
              value={cededCredits}
              onChange={(e) => setCededCredits(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Validade em Dias</label>
            <input
              type="number"
              min="1"
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Limite Máximo de Grade Externa (%)</label>
            <input
              type="number"
              min="1"
              max="50"
              value={maxGradePercent}
              onChange={(e) => setMaxGradePercent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Salvar Política
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Regras Cadastradas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h2 className="font-bold text-white text-base border-b border-slate-800 pb-3">Regras de Política Ativas ({rules.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase font-mono">
                    {rule.rule_type}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1">{rule.name}</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-900">
                <div>
                  <span className="text-slate-500 block text-[10px]">CRÉDITOS RECEBIDOS</span>
                  <strong className="text-emerald-400">{rule.received_credits} CR</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">INVENTÁRIO CEDIDO</span>
                  <strong className="text-purple-400">{rule.ceded_credits} CR</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
