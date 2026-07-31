'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getReferralInviteByCodeAction, acceptReferralInviteAction } from '@/app/actions/trials';
import { Gift, CheckCircle2, AlertCircle, Loader2, Sparkles, Tv, ArrowRight } from 'lucide-react';

export default function PublicInviteAcceptPage() {
  const params = useParams();
  const inviteCode = params.code as string;

  const [invite, setInvite] = useState<any>(null);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvite() {
      if (!inviteCode) return;
      try {
        setLoading(true);
        const res = await getReferralInviteByCodeAction(inviteCode);
        if (!res.success || !res.invite) {
          setError(res.error || 'Convite VIP inválido ou expirado.');
        } else {
          setInvite(res.invite);
          setCompanyName(res.invite.invited_company_name || '');
          setContactName(res.invite.invited_contact_name || '');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadInvite();
  }, [inviteCode]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await acceptReferralInviteAction(inviteCode, {
      company_name: companyName,
      contact_name: contactName || null,
      email: email || null,
      phone: phone || null,
    });

    if (!res.success) {
      setError(res.error || 'Erro ao aceitar convite VIP.');
      setSubmitting(false);
      return;
    }

    setAccepted(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4 select-none">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="bg-gradient-to-r from-purple-500 to-sky-500 p-3 rounded-2xl inline-flex text-white shadow-xl shadow-purple-500/20 mb-2">
            <Tv className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Rede Indoor Local</h1>
          <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">
            Plataforma SaaS de Mídia Indoor
          </p>
        </div>

        {error ? (
          <div className="bg-slate-900 border border-rose-500/30 p-8 rounded-3xl text-center space-y-4 shadow-2xl">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Convite Indisponível</h2>
            <p className="text-rose-400 text-xs leading-relaxed">{error}</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition"
            >
              Ir para Login
            </Link>
          </div>
        ) : accepted ? (
          <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-3xl text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-emerald-500/10 p-4 rounded-full text-emerald-400 inline-block border border-emerald-500/20">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">Convite VIP Aceito!</h2>
              <p className="text-emerald-400 font-semibold text-sm mt-2">
                Sua empresa ganhou 60 dias de degustação gratuita em todas as mídias e telas da plataforma.
              </p>
            </div>
            <p className="text-slate-400 text-xs">
              Efetue o cadastro da sua conta administrativa para iniciar a configuração dos seus anúncios.
            </p>
            <Link
              href="/register"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              Criar Conta e Iniciar Teste Grátis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/30 p-8 rounded-3xl space-y-6 shadow-2xl">
            {/* VIP Card Offer Header */}
            <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl text-center space-y-2">
              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-extrabold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> CONVITE VIP ESPECIAL
              </span>
              <h2 className="text-xl font-bold text-white">Você ganhou 60 Dias Grátis!</h2>
              <p className="text-xs text-slate-300">
                Oferecido com exclusividade por <strong className="text-purple-300">{invite.inviter_trade_name}</strong>
              </p>
            </div>

            <form onSubmit={handleAccept} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Nome da Sua Empresa *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Nome do Contato Principal</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">E-mail Comercial</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@suaempresa.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-8888"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-extrabold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 mt-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />} Resgatar
                60 Dias Grátis
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
