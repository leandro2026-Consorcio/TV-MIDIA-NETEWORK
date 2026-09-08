'use client';

import { useState } from 'react';
import { Users, Sparkles, Tv, Gift, PlusCircle, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { inviteCreatorAction } from '@/app/actions/expansion';

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);

interface LeaderTeamClientProps {
  leader: any;
  relations: any[];
  commissions: any[];
  candidates: any[];
  slots: any[];
  subscriptions: any[];
}

export function LeaderTeamClient({
  leader,
  relations,
  commissions,
  candidates,
  slots,
  subscriptions,
}: LeaderTeamClientProps) {
  const [activeTab, setActiveTab] = useState<'creators' | 'producao' | 'empresas' | 'convites'>('creators');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const ids = (relations || []).map((r: any) => r.creator_affiliate_id);
  const activeSlots = (slots || []).filter((s: any) => s.status === 'active').length;
  const pendingSlots = (slots || []).filter((s: any) => s.status !== 'active' && s.status !== 'cancelled').length;
  const availableCommissions = (commissions || [])
    .filter((c: any) => c.status === 'available_pending_transfer')
    .reduce((n: number, c: any) => n + Number(c.amount_cents), 0);

  const handleInvite = async (formData: FormData) => {
    setBusy(true);
    setMsg(null);
    try {
      await inviteCreatorAction(formData);
      setMsg({ type: 'ok', text: 'Convite registrado com sucesso para o Creator!' });
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.message || 'Falha ao enviar convite.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">Líder MPM</p>
          <h1 className="mt-1 text-3xl font-black text-white">Minha Equipe</h1>
          <p className="mt-1 text-sm text-slate-400">
            Acompanhe produção, ativações de TVs e convites de novos parceiros.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('convites')}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-300"
        >
          <PlusCircle className="h-4 w-4" /> Convidar Creator
        </button>
      </header>

      {/* Metrics Row */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Creators ativos" value={ids.length} icon={Sparkles} />
        <Metric label="Empresas da equipe" value={subscriptions?.length || 0} icon={Users} />
        <Metric label="TVs ativas" value={activeSlots} icon={Tv} />
        <Metric label="Comissão disponível" value={money(availableCommissions)} icon={DollarSign} />
      </section>

      {/* Internal Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        <TabButton
          active={activeTab === 'creators'}
          onClick={() => setActiveTab('creators')}
          icon={Sparkles}
          label={`Creators (${ids.length})`}
        />
        <TabButton
          active={activeTab === 'producao'}
          onClick={() => setActiveTab('producao')}
          icon={Tv}
          label="Produção & Ativação"
        />
        <TabButton
          active={activeTab === 'empresas'}
          onClick={() => setActiveTab('empresas')}
          icon={Users}
          label={`Empresas & TVs (${subscriptions?.length || 0})`}
        />
        <TabButton
          active={activeTab === 'convites'}
          onClick={() => setActiveTab('convites')}
          icon={Gift}
          label="Convites"
        />
      </div>

      {msg && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            msg.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Tab 1: Creators */}
      {activeTab === 'creators' && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-black text-white">Creators Parceiros Vinculados</h2>
            <p className="mt-1 text-sm text-slate-400">
              Creators sob sua liderança com código de atribuição e produção acompanhada.
            </p>
            <div className="mt-5 space-y-3">
              {relations && relations.length > 0 ? (
                relations.map((r: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 font-black text-amber-400">
                        {idx + 1}
                      </div>
                      <div>
                        <strong className="block text-white">
                          {r.affiliate_profiles?.display_name || 'Creator Parceiro'}
                        </strong>
                        <span className="font-mono text-xs text-slate-400">
                          Código: {r.affiliate_profiles?.attribution_code || '—'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-400">
                        Ativo
                      </span>
                      {r.starts_at && (
                        <span className="text-slate-500">
                          Desde {new Date(r.starts_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-slate-500">
                  <p>Nenhum Creator vinculado no momento.</p>
                  <button
                    onClick={() => setActiveTab('convites')}
                    className="mt-3 text-sm font-bold text-amber-400 underline"
                  >
                    Convidar o primeiro Creator
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tab 2: Produção */}
      {activeTab === 'producao' && (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-black text-white">Status de Ativação</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">TVs em operação ativa</span>
                  <strong className="font-black text-emerald-400">{activeSlots}</strong>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">TVs aguardando pareamento / onboarding</span>
                  <strong className="font-black text-amber-400">{pendingSlots}</strong>
                </div>
              </div>
              {(subscriptions || []).filter((s: any) => s.status !== 'active').length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase text-slate-500">Empresas com ativação pendente</h3>
                  <div className="mt-2 space-y-2">
                    {(subscriptions || [])
                      .filter((s: any) => s.status !== 'active')
                      .map((s: any, i: number) => (
                        <div key={i} className="flex justify-between rounded-lg bg-slate-950 px-3 py-2 text-xs">
                          <span className="text-slate-300">{s.companies?.trade_name || 'Empresa'}</span>
                          <span className="text-amber-400">{s.status}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-black text-white">Comissões Recentes</h2>
            <div className="mt-4 space-y-2">
              {commissions && commissions.length > 0 ? (
                commissions.slice(0, 10).map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-slate-950 p-3 text-xs">
                    <div>
                      <span className="font-bold text-white capitalize">
                        {c.entry_kind.replace(/_/g, ' ')}
                      </span>
                      <p className="text-[10px] text-slate-500">
                        {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <strong className="font-mono text-emerald-400">{money(c.amount_cents)}</strong>
                      <p className="text-[10px] text-slate-400">{c.status}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">Nenhuma comissão registrada ainda.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tab 3: Empresas & TVs */}
      {activeTab === 'empresas' && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-black text-white">Empresas e Contratos da Equipe</h2>
            <p className="mt-1 text-sm text-slate-400">
              Visão agregada de TVs contratadas e ativadas pelos Creators da sua equipe.
            </p>
            <div className="mt-5 space-y-3">
              {subscriptions && subscriptions.length > 0 ? (
                subscriptions.map((sub: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div>
                      <strong className="text-white">{sub.companies?.trade_name || 'Empresa Parceira'}</strong>
                      <p className="text-xs text-slate-400">
                        {sub.requested_screens || 1} TV(s) contratada(s) · Status: {sub.status}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                        sub.status === 'active'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {sub.status === 'active' ? 'Em operação' : 'Pendente'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-slate-500">
                  Nenhuma empresa contratante encontrada nesta rede.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tab 4: Convites */}
      {activeTab === 'convites' && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-amber-400/10 p-3 text-amber-400">
                <Gift className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-black text-white">Convidar Novo Creator</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Vincule um Creator cadastrado à sua liderança. O banco garante validação estrita anti-ciclo.
                </p>
              </div>
            </div>

            <form action={handleInvite} className="mt-6 max-w-xl space-y-4">
              <input type="hidden" name="leader_affiliate_id" value={leader.id} />
              <label className="block text-sm font-bold text-slate-300">
                Selecione o Creator
                <select
                  name="creator_affiliate_id"
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="">Selecione um candidato</option>
                  {(candidates || [])
                    .filter((c: any) => !ids.includes(c.id))
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.display_name} · Código: {c.attribution_code}
                      </option>
                    ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-40"
              >
                {busy ? 'Enviando...' : 'Confirmar Vínculo de Creator'}
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
        active
          ? 'bg-amber-400 text-slate-950 shadow-md'
          : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-amber-400" />
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
