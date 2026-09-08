'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getMpmWalletAction, getWalletBalanceAction } from '@/app/actions/wallet';
import { ArrowDownRight, ArrowUpRight, Clock3, Loader2, LockKeyhole, Wallet } from 'lucide-react';

type ClassBalance = { available?: number; pending?: number; reserved?: number };
type Summary = { available: number; pending: number; reserved: number; by_class: Record<string, ClassBalance> };
type LedgerRow = {
  id: string; entry_type: string; direction: string; amount: number; credit_class: string;
  source_type: string; campaign_id?: string | null; media_asset_id?: string | null;
  settlement_id?: string | null; reverses_entry_id?: string | null; created_at: string;
};

const classes = [
  ['earned', 'Earned'], ['purchased', 'Purchased'], ['promotional', 'Promotional'], ['legacy_organic', 'Legacy Organic'],
] as const;

const money = (value: number | string | undefined) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const short = (value?: string | null) => value ? value.slice(0, 8) : '—';

export default function WalletPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [legacyBalance, setLegacyBalance] = useState(0);
  const [summary, setSummary] = useState<Summary>({ available: 0, pending: 0, reserved: 0, by_class: {} });
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: links } = await (supabase.from('company_users') as any).select('company_id').eq('user_id', user.id).eq('is_active', true).limit(1);
      const companyId = links?.[0]?.company_id;
      if (!companyId) { setLoading(false); return; }
      const [legacy, mpm] = await Promise.all([getWalletBalanceAction(companyId), getMpmWalletAction(companyId)]);
      if (legacy.success) setLegacyBalance(legacy.balance);
      if (mpm.success) { setSummary(mpm.summary as Summary); setLedger(mpm.ledger as LedgerRow[]); }
      else setError(mpm.error || 'Não foi possível carregar a Carteira MPM.');
      setLoading(false);
    }
    void load();
  }, [supabase]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-black text-white">Carteira MPM</h1>
        <p className="mt-1 text-sm text-slate-400">1 Crédito MPM tem referência nominal interna de R$ 1,00. Ledger imutável; correções usam reversal.</p>
      </header>
      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 text-sm text-rose-300">{error}</div>}
      <section className="grid gap-4 md:grid-cols-3">
        <Metric icon={<Wallet />} label="Available" value={summary.available} color="amber" />
        <Metric icon={<Clock3 />} label="Pending" value={summary.pending} color="sky" />
        <Metric icon={<LockKeyhole />} label="Reserved" value={summary.reserved} color="purple" />
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {classes.map(([key, label]) => {
          const item = summary.by_class?.[key] || {};
          return <div key={key} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-black text-white">{money(item.available)} CR</p>
            <p className="mt-2 text-[11px] text-slate-500">pending {money(item.pending)} · reserved {money(item.reserved)}</p>
          </div>;
        })}
      </section>
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-xs text-slate-500">
        Saldo legado separado (não convertido automaticamente): <strong className="text-slate-300">{money(legacyBalance)} CR</strong>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 p-5"><h2 className="font-bold text-white">Movimentações MPM</h2></div>
        {ledger.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Nenhuma movimentação MPM V2 registrada.</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-950 text-slate-500"><tr>
              <th className="p-3">Data</th><th className="p-3">Classe</th><th className="p-3">Movimento</th><th className="p-3">Origem</th>
              <th className="p-3">Campanha</th><th className="p-3">Mídia</th><th className="p-3">Settlement / Reversal</th><th className="p-3 text-right">Valor</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-800">{ledger.map((row) => <tr key={row.id} className="text-slate-300">
              <td className="p-3 text-slate-500">{new Date(row.created_at).toLocaleString('pt-BR')}</td>
              <td className="p-3 font-bold text-purple-300">{row.credit_class}</td><td className="p-3">{row.entry_type}</td><td className="p-3">{row.source_type}</td>
              <td className="p-3 font-mono">{short(row.campaign_id)}</td><td className="p-3 font-mono">{short(row.media_asset_id)}</td>
              <td className="p-3 font-mono">{short(row.settlement_id || row.reverses_entry_id)}</td>
              <td className={`p-3 text-right font-black ${row.direction === 'credit' ? 'text-emerald-400' : row.direction === 'debit' ? 'text-rose-400' : 'text-sky-400'}`}>
                {row.direction === 'credit' ? <ArrowUpRight className="mr-1 inline h-3 w-3" /> : row.direction === 'debit' ? <ArrowDownRight className="mr-1 inline h-3 w-3" /> : null}{money(row.amount)}
              </td>
            </tr>)}</tbody>
          </table></div>}
      </section>
    </div>
  );
}

function Metric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'amber' | 'sky' | 'purple' }) {
  const styles = { amber: 'border-amber-500/30 text-amber-400', sky: 'border-sky-500/30 text-sky-400', purple: 'border-purple-500/30 text-purple-400' }[color];
  return <div className={`rounded-2xl border bg-slate-900 p-5 ${styles}`}><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span><span className="h-5 w-5">{icon}</span></div><p className="mt-3 text-3xl font-black">{money(value)} CR</p></div>;
}
