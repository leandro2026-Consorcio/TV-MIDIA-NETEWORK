'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  acceptCompanyUserInviteAction,
  createInvitedUserAction,
  getPublicCompanyInviteAction,
} from '@/app/actions/company-users';

type InviteInfo = { email: string; role: 'admin' | 'marketing'; companyName: string; expiresAt: string };

export default function CompanyInvitePage() {
  const params = useParams();
  const token = String(params.token || '');
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    void (async () => {
      const [result, session] = await Promise.all([getPublicCompanyInviteAction(token), supabase.auth.getUser()]);
      if (!result.success) setError(result.error);
      else setInvite(result);
      setLoggedIn(Boolean(session.data.user));
      setLoading(false);
    })();
  }, [supabase, token]);

  const accept = async () => {
    setBusy(true); setError(null);
    const result = await acceptCompanyUserInviteAction(token);
    if (!result.success) setError(result.error);
    else { setAccepted(true); window.sessionStorage.setItem('mpm.activeCompanyId', result.companyId); }
    setBusy(false);
  };

  const createAndAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invite) return;
    setBusy(true); setError(null);
    const created = await createInvitedUserAction(token, fullName, password);
    if (!created.success) { setError(created.error); setBusy(false); return; }
    const signIn = await supabase.auth.signInWithPassword({ email: invite.email, password });
    if (signIn.error) { setError('Conta criada. Entre com sua senha para concluir o vínculo.'); setBusy(false); return; }
    setLoggedIn(true);
    const acceptedResult = await acceptCompanyUserInviteAction(token);
    if (!acceptedResult.success) setError(acceptedResult.error);
    else { setAccepted(true); window.sessionStorage.setItem('mpm.activeCompanyId', acceptedResult.companyId); }
    setBusy(false);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white"><section className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
    <div className="flex items-center gap-3"><div className="rounded-2xl bg-sky-500/15 p-3 text-sky-400"><ShieldCheck className="h-7 w-7" /></div><div><p className="text-xs font-bold uppercase tracking-wider text-sky-400">Mídia por Mídia</p><h1 className="text-2xl font-black">Convite de acesso</h1></div></div>
    {error && <div className="mt-5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}
    {accepted ? <div className="mt-6 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" /><h2 className="mt-3 text-xl font-bold">Acesso ativado</h2><p className="mt-1 text-sm text-slate-400">Você já pode trabalhar em {invite?.companyName}.</p><button onClick={() => { router.push('/dashboard'); router.refresh(); }} className="mt-5 rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold">Abrir painel</button></div> : invite && <>
      <div className="mt-6 rounded-2xl bg-slate-950 p-4 text-sm"><p className="text-slate-400">Empresa</p><p className="font-bold">{invite.companyName}</p><p className="mt-3 text-slate-400">E-mail convidado</p><p className="font-semibold">{invite.email}</p><p className="mt-3 text-slate-400">Perfil</p><p className="font-bold text-purple-300">{invite.role.toUpperCase()}</p></div>
      {loggedIn ? <button disabled={busy} onClick={() => void accept()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-bold disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} ACEITAR CONVITE</button> : <form onSubmit={createAndAccept} className="mt-5 space-y-4"><p className="text-sm text-slate-400">Crie sua conta pessoal. Nenhuma senha padrão será gerada ou enviada.</p><input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" /><input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Crie uma senha pessoal" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" /><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-bold disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} CRIAR CONTA E ACEITAR</button><p className="text-center text-xs text-slate-500">Já possui conta? <Link className="text-sky-400 hover:underline" href={`/login?next=${encodeURIComponent(`/company-invite/${token}`)}`}>Entrar</Link></p></form>}
    </>}
  </section></main>;
}
