'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { getSellerPayoutTransfersAction } from '@/app/actions/seller-payout-transfers';
import { 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Loader2, 
  Building2, 
  Receipt, 
  ArrowUpRight, 
  XCircle 
} from 'lucide-react';
import Link from 'next/link';

export default function SellerPayoutHistoryPage() {
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<any[]>([]);

  const supabase = createClient();

  const loadData = async (companyId: string) => {
    try {
      setLoading(true);
      setError(null);

      const res = await getSellerPayoutTransfersAction(companyId);
      if (res.success) {
        setTransfers(res.transfers || []);
      } else {
        setError(res.error || 'Erro ao carregar histórico de transferências.');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  let totalDoneCents = 0;
  let totalProcessingCents = 0;
  let totalFailedCents = 0;

  transfers.forEach((t) => {
    if (t.transfer_status === 'done') totalDoneCents += t.amount_cents || 0;
    else if (t.transfer_status === 'processing' || t.transfer_status === 'created') totalProcessingCents += t.amount_cents || 0;
    else if (t.transfer_status === 'failed') totalFailedCents += t.amount_cents || 0;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-purple-400" /> Histórico de Repasses Recebidos
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Extrato de transferências pós-entrega liquidadas via Asaas com id do comprovante.
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

      {/* Grid de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Total Transferido com Sucesso</span>
          <strong className="text-2xl font-bold text-emerald-400 block font-mono">
            R$ {(totalDoneCents / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-emerald-500/80 font-mono">Creditado na Carteira Asaas</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Em Processamento / Lote</span>
          <strong className="text-2xl font-bold text-purple-400 block font-mono">
            R$ {(totalProcessingCents / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-purple-500/80 font-mono">Aguardando Liquidação Asaas</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 block font-sans">Falhas em Retentativa</span>
          <strong className="text-2xl font-bold text-rose-400 block font-mono">
            R$ {(totalFailedCents / 100).toFixed(2)}
          </strong>
          <span className="text-[10px] text-rose-500/80 font-mono">Saldo Mantido no Extrato</span>
        </div>
      </div>

      {/* Tabela de Transferências */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-purple-400" /> Registros de Transferências ({transfers.length})
        </h3>

        {transfers.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">
            Nenhuma transferência pós-entrega registrada para esta empresa até o momento.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-sans">Data / Hora</th>
                  <th className="py-3 px-4">Comprovante Asaas (ID)</th>
                  <th className="py-3 px-4 text-emerald-400">Valor Repassado (R$)</th>
                  <th className="py-3 px-4 font-sans">Status Transferência</th>
                  <th className="py-3 px-4 font-sans">Detalhes / Erro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 text-slate-300 font-sans">
                      {new Date(t.requested_at || t.created_at).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(t.requested_at || t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3 px-4 text-purple-300 font-mono font-bold">
                      {t.asaas_transfer_id || '—'}
                    </td>

                    <td className="py-3 px-4 font-bold text-emerald-400 font-mono text-sm">
                      R$ {(t.amount_cents / 100).toFixed(2)}
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.transfer_status === 'done'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : t.transfer_status === 'processing' || t.transfer_status === 'created'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {t.transfer_status}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-sans text-slate-400 text-[11px]">
                      {t.failure_reason ? (
                        <span className="text-rose-400 font-bold">{t.failure_reason}</span>
                      ) : (
                        'Transferência concluída com sucesso'
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
