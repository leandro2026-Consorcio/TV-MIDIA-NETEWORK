'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AdOfferOrder, Company } from '@/types';
import { getAdOfferOrdersAction, markAdOfferOrderPaidManualAction } from '@/app/actions/ad-offers';
import { ShoppingCart, CheckCircle2, AlertCircle, Loader2, DollarSign, Clock, ShieldCheck } from 'lucide-react';

export default function AdOfferOrdersPage() {
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [isMaster, setIsMaster] = useState(false);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  const loadOrders = async (companyId?: string) => {
    try {
      setLoading(true);
      const res = await getAdOfferOrdersAction(companyId);
      if (res.success) {
        setOrders(res.orders || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function initData() {
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

        const { data: userComps } = await (supabase.from('companies') as any)
          .select('*, company_users!inner(user_id)')
          .eq('company_users.user_id', user.id)
          .eq('company_users.is_active', true);

        if (userComps && userComps.length > 0) {
          setUserCompanies(userComps as Company[]);
          const initialId = userComps[0].id;
          setSelectedCompanyId(initialId);
          await loadOrders(master ? undefined : initialId);
        } else if (master) {
          await loadOrders();
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [supabase]);

  const handleMarkPaidManual = async (orderId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await markAdOfferOrderPaidManualAction(orderId, 'Pagamento confirmado manualmente pelo Master Admin.');
    if (!res.success) {
      setError(res.error || 'Erro ao marcar pagamento manual.');
    } else {
      setSuccess('Pedido marcado como Pago Manualmente!');
      await loadOrders(isMaster ? undefined : selectedCompanyId);
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

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Pedidos de Planos de Mídia</h1>
          <p className="text-slate-400 text-sm mt-1">
            Registro comercial de solicitações de compra e controle de valores congelados.
          </p>
        </div>

        {!isMaster && userCompanies.length > 1 && (
          <select
            value={selectedCompanyId}
            onChange={(e) => {
              setSelectedCompanyId(e.target.value);
              loadOrders(e.target.value);
            }}
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

      {/* Tabela de Pedidos de Mídia */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h2 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-purple-400" /> Relatório de Pedidos ({orders.length})
        </h2>

        {orders.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">Nenhum pedido de mídia registrado até o momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Plano / Vendedor</th>
                  <th className="py-3 px-4">Comprador</th>
                  <th className="py-3 px-4 font-mono">Valor Bruto</th>
                  <th className="py-3 px-4 font-mono">Taxa Plataforma</th>
                  <th className="py-3 px-4 font-mono">Líquido Empresa</th>
                  <th className="py-3 px-4 font-mono">Créditos</th>
                  <th className="py-3 px-4">Status</th>
                  {isMaster && <th className="py-3 px-4 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 font-sans">
                      <strong className="block text-white">{ord.offer?.title || 'Plano de Mídia'}</strong>
                      <span className="text-[10px] text-purple-400">Vendedor: {ord.seller?.trade_name || 'Empresa Exibidora'}</span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-300">
                      {ord.buyer?.trade_name || ord.buyer_name || 'Comprador Direto'}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">R$ {(ord.gross_amount_cents / 100).toFixed(2)}</td>
                    <td className="py-3 px-4 text-rose-400 font-bold">R$ {(ord.platform_fee_cents / 100).toFixed(2)}</td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">R$ {(ord.seller_net_cents / 100).toFixed(2)}</td>
                    <td className="py-3 px-4 text-amber-400 font-bold">{ord.credits_amount} CR</td>
                    <td className="py-3 px-4 font-sans">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase w-fit ${
                            ord.status === 'converted_to_campaign'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : ord.payment_status === 'paid_manual'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {ord.status === 'converted_to_campaign' ? 'Convertido em Campanha' : ord.payment_status.replace('_', ' ')}
                        </span>

                        {ord.campaign_id ? (
                          <Link
                            href={`/campaigns/${ord.campaign_id}`}
                            className="text-[11px] font-bold text-purple-400 hover:underline flex items-center gap-1"
                          >
                            Abrir Campanha &rarr;
                          </Link>
                        ) : (
                          <Link
                            href={`/ad-offer-orders/${ord.id}/payment`}
                            className="text-[11px] font-bold text-sky-400 hover:underline flex items-center gap-1"
                          >
                            Checkout / Pagar Asaas &rarr;
                          </Link>
                        )}
                      </div>
                    </td>
                    {isMaster && (
                      <td className="py-3 px-4 text-right font-sans">
                        {ord.payment_status !== 'paid_manual' && (
                          <button
                            onClick={() => handleMarkPaidManual(ord.id)}
                            disabled={actionLoading}
                            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition text-[11px] shadow-md shadow-emerald-500/20 shrink-0"
                          >
                            Marcar Pago Manual
                          </button>
                        )}
                      </td>
                    )}
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
