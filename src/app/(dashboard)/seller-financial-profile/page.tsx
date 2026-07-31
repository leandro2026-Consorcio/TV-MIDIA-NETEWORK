'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { 
  getSellerFinancialProfileAction, 
  saveSellerFinancialProfileAction, 
  submitSellerFinancialProfileForReviewAction 
} from '@/app/actions/seller-financial-profiles';
import { 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Save, 
  Send, 
  ShieldCheck, 
  Clock, 
  XCircle, 
  AlertTriangle, 
  QrCode 
} from 'lucide-react';

export default function SellerFinancialProfilePage() {
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [profile, setProfile] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form States
  const [documentType, setDocumentType] = useState<'cnpj' | 'cpf'>('cnpj');
  const [documentNumber, setDocumentNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [responsibleEmail, setResponsibleEmail] = useState('');
  const [responsiblePhone, setResponsiblePhone] = useState('');

  const [bankCode, setBankCode] = useState('001');
  const [bankName, setBankName] = useState('Banco do Brasil');
  const [bankAgency, setBankAgency] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountDigit, setBankAccountDigit] = useState('');
  const [bankAccountType, setBankAccountType] = useState<'checking' | 'savings'>('checking');

  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'cnpj' | 'email' | 'phone' | 'random'>('cnpj');
  const [pixKey, setPixKey] = useState('');

  const supabase = createClient();

  const loadData = async (companyId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getSellerFinancialProfileAction(companyId);
      if (res.success && res.profile) {
        const p = res.profile;
        setProfile(p);
        setDocumentType(p.document_type || 'cnpj');
        setDocumentNumber(p.document_number || '');
        setLegalName(p.legal_name || '');
        setTradeName(p.trade_name || '');
        setResponsibleName(p.responsible_name || '');
        setResponsibleEmail(p.responsible_email || '');
        setResponsiblePhone(p.responsible_phone || '');

        setBankCode(p.bank_code || '001');
        setBankName(p.bank_name || 'Banco do Brasil');
        setBankAgency(p.bank_agency || '');
        setBankAccount(p.bank_account || '');
        setBankAccountDigit(p.bank_account_digit || '');
        setBankAccountType(p.bank_account_type || 'checking');

        setPixKeyType(p.pix_key_type || 'cnpj');
        setPixKey(p.pix_key || '');
      } else {
        setProfile(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: userComps } = await (supabase.from('companies') as any)
          .select('*, company_users!inner(user_id, role)')
          .eq('company_users.user_id', user.id)
          .eq('company_users.is_active', true);

        if (userComps && userComps.length > 0) {
          setUserCompanies(userComps as Company[]);
          const initialId = userComps[0].id;
          setSelectedCompanyId(initialId);
          await loadData(initialId);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const handleCompanyChange = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    await loadData(companyId);
  };

  const handleSaveDraft = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await saveSellerFinancialProfileAction(selectedCompanyId, {
      document_type: documentType,
      document_number: documentNumber,
      legal_name: legalName,
      trade_name: tradeName,
      responsible_name: responsibleName,
      responsible_email: responsibleEmail,
      responsible_phone: responsiblePhone,
      bank_code: bankCode,
      bank_name: bankName,
      bank_agency: bankAgency,
      bank_account: bankAccount,
      bank_account_digit: bankAccountDigit,
      bank_account_type: bankAccountType,
      pix_key_type: pixKeyType,
      pix_key: pixKey,
    });

    if (!res.success) {
      setError(res.error || 'Erro ao salvar perfil financeiro.');
    } else {
      setSuccess('Rascunho do perfil financeiro salvo com sucesso!');
      await loadData(selectedCompanyId);
    }
    setActionLoading(false);
  };

  const handleSubmitReview = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    // Salvar antes de submeter
    const saveRes = await saveSellerFinancialProfileAction(selectedCompanyId, {
      document_type: documentType,
      document_number: documentNumber,
      legal_name: legalName,
      trade_name: tradeName,
      responsible_name: responsibleName,
      responsible_email: responsibleEmail,
      responsible_phone: responsiblePhone,
      bank_code: bankCode,
      bank_name: bankName,
      bank_agency: bankAgency,
      bank_account: bankAccount,
      bank_account_digit: bankAccountDigit,
      bank_account_type: bankAccountType,
      pix_key_type: pixKeyType,
      pix_key: pixKey,
    });

    if (!saveRes.success) {
      setError(saveRes.error || 'Erro ao salvar dados antes de submeter.');
      setActionLoading(false);
      return;
    }

    const subRes = await submitSellerFinancialProfileForReviewAction(selectedCompanyId);
    if (!subRes.success) {
      setError(subRes.error || 'Erro ao enviar cadastro para revisão.');
    } else {
      setSuccess('Cadastro financeiro enviado com sucesso para análise do Master Admin!');
      await loadData(selectedCompanyId);
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const vStatus = profile?.verification_status || 'draft';
  const isApproved = vStatus === 'approved';
  const isPending = vStatus === 'pending_review';
  const isRejected = vStatus === 'rejected';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-purple-400" /> Cadastro Financeiro da Exibidora
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Preencha seus dados fiscais e bancários para homologação e habilitação de split futuro.
          </p>
        </div>

        {userCompanies.length > 1 && (
          <select
            value={selectedCompanyId}
            onChange={(e) => handleCompanyChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs font-medium focus:outline-none focus:border-purple-500"
          >
            {userCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.trade_name}
              </option>
            ))}
          </select>
        )}
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

      {/* Banner de Aptidão para Split Futuro */}
      <div
        className={`p-6 rounded-2xl border flex items-start gap-4 shadow-xl ${
          isApproved
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : isPending
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
            : isRejected
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            : 'bg-slate-900 border-slate-800 text-slate-300'
        }`}
      >
        <div className="mt-0.5">
          {isApproved ? (
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          ) : isPending ? (
            <Clock className="w-6 h-6 text-amber-400" />
          ) : isRejected ? (
            <XCircle className="w-6 h-6 text-rose-400" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-purple-400" />
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-white">
              Status da Homologação: <span className="uppercase font-mono">{vStatus.replace('_', ' ')}</span>
            </h3>
          </div>

          <p className="text-xs">
            {isApproved
              ? 'Sua empresa exibidora está APROVADA e homologada financeiramente. Quando a funcionalidade de split financeiro for ativada, os repasamentos serão efetuados automaticamente para os dados cadastrados.'
              : isPending
              ? 'Seu cadastro financeiro está sob análise do Master Admin. Qualquer alteração em dados sensíveis reiniciará a verificação.'
              : isRejected
              ? `Seu cadastro financeiro foi REJEITADO. Motivo informado: "${profile?.rejection_reason || 'Dados inconsistentes'}"`
              : 'Preencha os campos abaixo e submeta para revisão. Apenas cadastros aprovados ficam aptos para split financeiro.'}
          </p>
        </div>
      </div>

      {/* Formulário de Cadastro Financeiro */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 shadow-xl">
        {/* Bloco 1: Dados Fiscais e Jurídicos */}
        <div className="space-y-4">
          <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-400" /> 1. Dados Fiscais e Responsável Legal
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Documento</label>
              <select
                value={documentType}
                onChange={(e: any) => setDocumentType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                <option value="cnpj">Pessoa Jurídica (CNPJ)</option>
                <option value="cpf">Pessoa Física (CPF)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Número do Documento</label>
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Razão Social / Nome Completo</label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Empresa Exibidora LTDA"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Fantasia (Opcional)</label>
              <input
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="TV Indoor Mídia"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nome do Responsável Financeiro</label>
              <input
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Carlos Silva"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail do Responsável</label>
              <input
                type="email"
                value={responsibleEmail}
                onChange={(e) => setResponsibleEmail(e.target.value)}
                placeholder="financeiro@empresa.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Telefone / WhatsApp</label>
              <input
                type="text"
                value={responsiblePhone}
                onChange={(e) => setResponsiblePhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Bloco 2: Dados Bancários */}
        <div className="space-y-4 pt-2">
          <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-400" /> 2. Dados Bancários Obrigatórios
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Código do Banco</label>
              <input
                type="text"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                placeholder="001, 341, 237..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nome da Instituição</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Banco do Brasil, Itaú..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Agência (sem dígito)</label>
              <input
                type="text"
                value={bankAgency}
                onChange={(e) => setBankAgency(e.target.value)}
                placeholder="1234"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Conta</label>
              <select
                value={bankAccountType}
                onChange={(e: any) => setBankAccountType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                <option value="checking">Conta Corrente</option>
                <option value="savings">Conta Poupança</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Número da Conta</label>
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="56789"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Dígito da Conta</label>
              <input
                type="text"
                value={bankAccountDigit}
                onChange={(e) => setBankAccountDigit(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Bloco 3: Chave Pix */}
        <div className="space-y-4 pt-2">
          <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-purple-400" /> 3. Chave Pix Principal
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Chave Pix</label>
              <select
                value={pixKeyType}
                onChange={(e: any) => setPixKeyType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                <option value="cnpj">CNPJ</option>
                <option value="cpf">CPF</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone</option>
                <option value="random">Chave Aleatória</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Valor da Chave Pix</label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Chave Pix ou CNPJ"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={handleSaveDraft}
            disabled={actionLoading}
            className="bg-slate-800 hover:bg-slate-700 font-semibold text-slate-200 px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-2"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Rascunho
          </button>

          <button
            onClick={handleSubmitReview}
            disabled={actionLoading}
            className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-6 py-2.5 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar para Análise do Master Admin
          </button>
        </div>
      </div>
    </div>
  );
}
