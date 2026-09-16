'use client';

import { useEffect, useState } from 'react';
import { Copy, Loader2, Plus, ShieldCheck, Trash2, UserCog, X } from 'lucide-react';
import { useDashboardCompany } from '@/contexts/dashboard-company-context';
import {
  changeCompanyUserRoleAction,
  inviteCompanyUserAction,
  listCompanyAccessAction,
  removeCompanyUserAction,
  type CompanyAccessRole,
} from '@/app/actions/company-users';

type Member = {
  membership_id: string; user_id: string; full_name: string | null; email: string;
  role: string; is_active: boolean; created_at: string; accepted_at: string | null;
  last_access_at: string | null;
};
type Invite = { id: string; email: string; role: string; status: string; invited_at: string; expires_at: string; accepted_at: string | null };

export default function CompanyUsersPage() {
  const { activeCompany, activeRole, isMasterAdmin } = useDashboardCompany();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CompanyAccessRole>('marketing');
  const [inviteUrl, setInviteUrl] = useState('');
  const [deliveryWarning, setDeliveryWarning] = useState<string | null>(null);

  const canManage = isMasterAdmin || activeRole === 'admin';
  const load = async () => {
    if (!activeCompany || !canManage) { setLoading(false); return; }
    setLoading(true); setError(null);
    const result = await listCompanyAccessAction(activeCompany.id);
    if (!result.success) setError(result.error);
    else { setMembers(result.members as Member[]); setInvites(result.invites as Invite[]); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [activeCompany?.id, canManage]);

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeCompany) return;
    setBusy(true); setError(null); setInviteUrl(''); setDeliveryWarning(null);
    const result = await inviteCompanyUserAction(activeCompany.id, email, role);
    if (!result.success) setError(result.error);
    else { setInviteUrl(result.inviteUrl); setDeliveryWarning(result.deliveryWarning); setEmail(''); await load(); }
    setBusy(false);
  };

  const changeRole = async (userId: string, nextRole: CompanyAccessRole) => {
    if (!activeCompany) return;
    setBusy(true); setError(null);
    const result = await changeCompanyUserRoleAction(activeCompany.id, userId, nextRole);
    if (!result.success) setError(result.error); else await load();
    setBusy(false);
  };

  const remove = async (userId: string) => {
    if (!activeCompany || !window.confirm('Remover o acesso deste usuário à empresa? A conta MPM não será excluída.')) return;
    setBusy(true); setError(null);
    const result = await removeCompanyUserAction(activeCompany.id, userId);
    if (!result.success) setError(result.error); else await load();
    setBusy(false);
  };

  if (!activeCompany) return <p className="text-sm text-slate-400">Selecione uma empresa.</p>;
  if (!canManage) return <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-300">Apenas ADMIN da empresa ou MASTER pode administrar usuários.</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-wider text-sky-400">Configurações</p><h1 className="text-2xl font-black text-white">Usuários e Acessos</h1><p className="text-sm text-slate-400">{activeCompany.trade_name}</p></div>
        <button onClick={() => { setShowInvite(true); setInviteUrl(''); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white hover:bg-sky-600"><Plus className="h-4 w-4" /> ADICIONAR USUÁRIO</button>
      </div>

      {error && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-sky-400" /></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-950 text-xs uppercase text-slate-500"><tr><th className="p-4">Nome</th><th className="p-4">E-mail</th><th className="p-4">Perfil</th><th className="p-4">Status</th><th className="p-4">Último acesso</th><th className="p-4">Ações</th></tr></thead><tbody className="divide-y divide-slate-800">
            {members.map((member) => <tr key={member.membership_id} className={!member.is_active ? 'opacity-50' : ''}><td className="p-4 font-semibold text-white">{member.full_name || 'Sem nome'}</td><td className="p-4 text-slate-300">{member.email}</td><td className="p-4"><select disabled={busy || !member.is_active} value={member.role === 'admin' ? 'admin' : 'marketing'} onChange={(e) => void changeRole(member.user_id, e.target.value as CompanyAccessRole)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200"><option value="admin">ADMIN</option><option value="marketing">MARKETING</option></select></td><td className="p-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${member.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>{member.is_active ? 'ATIVO' : 'REMOVIDO'}</span></td><td className="p-4 text-xs text-slate-400">{member.last_access_at ? new Date(member.last_access_at).toLocaleString('pt-BR') : 'Não disponível'}</td><td className="p-4"><button disabled={busy || !member.is_active} onClick={() => void remove(member.user_id)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10" title="Remover acesso"><Trash2 className="h-4 w-4" /></button></td></tr>)}
          </tbody></table></div>
        )}
      </div>

      {invites.some((invite) => invite.status === 'pending') && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-3 flex items-center gap-2 font-bold text-white"><UserCog className="h-5 w-5 text-purple-400" /> Convites pendentes</h2><div className="space-y-2">{invites.filter((invite) => invite.status === 'pending').map((invite) => <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950 p-3 text-xs"><span className="text-slate-300">{invite.email}</span><span className="font-bold text-purple-300">{invite.role.toUpperCase()}</span><span className="text-slate-500">Expira em {new Date(invite.expires_at).toLocaleString('pt-BR')}</span></div>)}</div></section>}

      {showInvite && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur"><div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-white">Adicionar usuário</h2><p className="text-xs text-slate-400">O convite expira em 7 dias e só pode ser usado pelo e-mail informado.</p></div><button onClick={() => setShowInvite(false)} className="p-2 text-slate-400"><X className="h-5 w-5" /></button></div>
        <form onSubmit={submitInvite} className="mt-5 space-y-4"><div><label className="mb-1 block text-xs font-bold text-slate-300">E-mail</label><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white" /></div><div><label className="mb-1 block text-xs font-bold text-slate-300">Perfil</label><select value={role} onChange={(e) => setRole(e.target.value as CompanyAccessRole)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"><option value="admin">ADMIN</option><option value="marketing">MARKETING</option></select></div><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} ENVIAR CONVITE</button></form>
        {inviteUrl && <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4"><p className="text-sm font-bold text-emerald-300">Convite criado com segurança.</p>{deliveryWarning && <p className="mt-2 text-xs text-amber-300">{deliveryWarning}</p>}<p className="mt-1 break-all text-xs text-slate-300">{inviteUrl}</p><button onClick={() => void navigator.clipboard.writeText(inviteUrl)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white"><Copy className="h-4 w-4" /> Copiar link</button></div>}
      </div></div>}
    </div>
  );
}
