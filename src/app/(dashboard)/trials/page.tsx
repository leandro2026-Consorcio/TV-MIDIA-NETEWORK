'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CompanyTrial, ReferralInvite } from '@/types';
import { 
  getCompanyTrialStatusAction, 
  createReferralInviteAction, 
  cancelReferralInviteAction, 
  getReferralInvitesAction,
  convertTrialAction 
} from '@/app/actions/trials';
import { 
  Gift, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Copy, 
  XCircle, 
  Loader2, 
  Sparkles, 
  UserCheck, 
  Send 
} from 'lucide-react';

export default function TrialsPage() {
  const [trial, setTrial] = useState<CompanyTrial | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [isConverted, setIsConverted] = useState<boolean>(false);
  const [invitesAvailable, setInvitesAvailable] = useState<number>(0);
  const [invitesUsed, setInvitesUsed] = useState<number>(0);
  const [invites, setInvites] = useState<ReferralInvite[]>([]);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isMaster, setIsMaster] = useState<boolean>(false);

  // Form State para Convite VIP
  const [invitedCompanyName, setInvitedCompanyName] = useState('');
  const [invitedContactName, setInvitedContactName] = useState('');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [invitedPhone, setInvitedPhone] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const supabase = createClient();

  const loadData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await (supabase.from('profiles') as any)
        .select('is_master_admin')
        .eq('id', user.id)
        .single();

      const master = !!profile?.is_master_admin;
      setIsMaster(master);

      // Obter primeira empresa vinculada ou selecionada
      const { data: userLinks } = await (supabase.from('company_users') as any)
        .select('company_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      const activeCompId = userLinks && userLinks.length > 0 ? userLinks[0].company_id : null;
      setCompanyId(activeCompId);

      if (activeCompId) {
        const trialRes = await getCompanyTrialStatusAction(activeCompId);
        if (trialRes.success) {
          setTrial(trialRes.trial);
          setDaysRemaining(trialRes.daysRemaining);
          setIsConverted(trialRes.isConverted);
          setInvitesAvailable(trialRes.invitesAvailable);
          setInvitesUsed(trialRes.invitesUsed);
        }

        const invRes = await getReferralInvitesAction(activeCompId);
        if (invRes.success) {
          setInvites(invRes.invites);
        }
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

  // Criar Convite VIP
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const res = await createReferralInviteAction(companyId, {
      invited_company_name: invitedCompanyName,
      invited_contact_name: invitedContactName || null,
      invited_email: invitedEmail || null,
      invited_phone: invitedPhone || null,
    });

    if (!res.success) {
      setError(res.error || 'Erro ao gerar convite VIP.');
      setSubmitting(false);
      return;
    }

    setSuccess(`Convite VIP gerado com sucesso! Código: ${res.invite.invite_code}`);
    setInvitedCompanyName('');
    setInvitedContactName('');
    setInvitedEmail('');
    setInvitedPhone('');
    setSubmitting(false);
    await loadData();
  };

  // Simular Conversão Comercial (Master Admin ou Teste)
  const handleConvertTrial = async () => {
    if (!companyId) return;
    setConverting(true);
    setError(null);

    const res = await convertTrialAction(companyId);

    if (!res.success) {
      setError(res.error || 'Erro ao converter trial.');
      setConverting(false);
      return;
    }

    setConverting(false);
    await loadData();
  };

  // Cancelar Convite VIP
  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Deseja cancelar este convite VIP?')) return;
    setError(null);
    const res = await cancelReferralInviteAction(inviteId);
    if (!res.success) setError(res.error || 'Erro ao cancelar convite.');
    await loadData();
  };

  const copyInviteLink = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const link = `${origin}/invite/${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Degustação & Convites VIP</h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerencie seus 60 dias grátis de trial e presenteie parceiros comerciais com convites VIP.
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

      {/* Grid: Status do Trial vs Liberação de Convites VIP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Trial Status */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex justify-between items-start">
            <div className="bg-sky-500/10 p-3 rounded-2xl text-sky-400 border border-sky-500/20">
              <Clock className="w-6 h-6" />
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isConverted
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  : trial?.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400'
              }`}
            >
              {isConverted ? 'PLANO CONVERTIDO' : trial?.status?.toUpperCase() || 'SEM TRIAL'}
            </span>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white">Degustação Gratuita (60 Dias)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isConverted
                ? 'Sua empresa converteu o plano comercial. Os 3 convites VIP estão liberados!'
                : 'Aproveite o período de testes grátis em todas as mídias e telas da plataforma.'}
            </p>
          </div>

          {!isConverted && trial?.status === 'active' && (
            <div className="space-y-2 border-t border-slate-800 pt-4">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Dias Restantes:</span>
                <strong className="text-emerald-400 text-base">{daysRemaining} Dias</strong>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-400 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, (daysRemaining / 60) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1 font-mono">
                <span>Início: {trial.trial_start_date}</span>
                <span>Término: {trial.trial_end_date}</span>
              </div>
            </div>
          )}

          {isMaster && !isConverted && (
            <div className="pt-2">
              <button
                type="button"
                disabled={converting}
                onClick={handleConvertTrial}
                className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/20"
              >
                {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                [Master Admin] Simular Conversão Comercial
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Saldo de Convites VIP */}
        <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 p-6 rounded-2xl space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div className="bg-purple-500/10 p-3 rounded-2xl text-purple-400 border border-purple-500/20">
                <Gift className="w-6 h-6" />
              </div>
              <span className="text-2xl font-extrabold text-purple-400 font-mono">
                {invitesAvailable} / 3
              </span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Convites VIP Disponíveis</h2>
              <p className="text-xs text-slate-400">
                Presenteie até <strong className="text-slate-200">3 empresas parceiras</strong> com 60 dias de degustação gratuita sem custos.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Convites Emitidos / Utilizados:</span>
              <strong className="text-purple-400 font-mono">{invitesUsed} de 3</strong>
            </div>
            <div className="flex justify-between">
              <span>Benefício para Convidado:</span>
              <strong className="text-emerald-400 font-mono">60 Dias Grátis</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Form de Emissão de Convites VIP */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="bg-purple-500 p-2 rounded-xl text-white">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Gerar Novo Convite VIP</h2>
            <p className="text-xs text-slate-400">Informe os dados da empresa parceira para gerar um código único</p>
          </div>
        </div>

        {!isConverted && !isMaster ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">
            Sua empresa ainda está em período de degustação. Converta seu plano comercial para desbloquear a emissão de convites VIP.
          </div>
        ) : invitesAvailable === 0 ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
            Limite de 3 convites VIP atingido. Cancele um convite pendente para liberar uma nova vaga.
          </div>
        ) : (
          <form onSubmit={handleCreateInvite} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Nome da Empresa Convidada *</label>
              <input
                type="text"
                required
                value={invitedCompanyName}
                onChange={(e) => setInvitedCompanyName(e.target.value)}
                placeholder="Ex: Padaria Bela Vista"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Nome do Contato (Opcional)</label>
              <input
                type="text"
                value={invitedContactName}
                onChange={(e) => setInvitedContactName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">E-mail do Contato (Opcional)</label>
              <input
                type="email"
                value={invitedEmail}
                onChange={(e) => setInvitedEmail(e.target.value)}
                placeholder="exemplo@empresa.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Telefone / WhatsApp (Opcional)</label>
              <input
                type="text"
                value={invitedPhone}
                onChange={(e) => setInvitedPhone(e.target.value)}
                placeholder="(11) 99999-8888"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />} Emitem Convite VIP-XXXXXX
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Tabela de Convites Emitidos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-6">
        <h2 className="font-bold text-white text-base border-b border-slate-800 pb-3">
          Convites VIP Emitidos ({invites.length})
        </h2>

        {invites.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Nenhum convite VIP emitido por esta empresa.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Empresa Convidada</th>
                  <th className="py-3 px-4">Código VIP</th>
                  <th className="py-3 px-4">Link de Aceite</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Validade</th>
                  <th className="py-3 px-4">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {invites.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold text-white">
                      {inv.invited_company_name}
                      {inv.invited_contact_name && (
                        <span className="block text-[10px] text-slate-400 font-normal">{inv.invited_contact_name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-purple-400">
                      {inv.invite_code}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <button
                        onClick={() => copyInviteLink(inv.invite_code)}
                        className="bg-slate-950 hover:bg-slate-800 border border-slate-800 px-2.5 py-1 rounded-lg text-sky-400 transition flex items-center gap-1.5 text-[11px]"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedCode === inv.invite_code ? 'Copiado!' : 'Copiar Link'}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'accepted' || inv.status === 'converted'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : inv.status === 'created' || inv.status === 'sent'
                            ? 'bg-sky-500/10 text-sky-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {inv.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(inv.expires_at || Date.now()).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4">
                      {inv.status !== 'accepted' && inv.status !== 'converted' && inv.status !== 'cancelled' && (
                        <button
                          onClick={() => handleCancelInvite(inv.id)}
                          className="text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg border border-slate-800 transition"
                          title="Cancelar Convite"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
