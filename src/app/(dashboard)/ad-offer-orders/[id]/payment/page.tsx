'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  createAsaasPaymentForOrderAction, 
  getAsaasPaymentStatusAction, 
  syncAsaasPaymentStatusAction 
} from '@/app/actions/asaas-payments';
import { convertAdOfferOrderToCampaignAction } from '@/app/actions/marketplace';
import { 
  CreditCard, 
  QrCode, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  ExternalLink, 
  FileText, 
  Megaphone, 
  ArrowLeft,
  Building2,
  DollarSign
} from 'lucide-react';
import Link from 'next/link';

export default function OrderPaymentCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  const supabase = createClient();

  const loadOrderData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: orderErr } = await (supabase.from('ad_offer_orders') as any)
        .select('*, offer:company_ad_offers(*), seller:companies!ad_offer_orders_seller_company_id_fkey(*), buyer:companies!ad_offer_orders_buyer_company_id_fkey(*)')
        .eq('id', orderId)
        .single();

      if (orderErr || !data) {
        setError('Pedido de mídia não encontrado.');
        return;
      }

      setOrder(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrderData();
  }, [orderId]);

  // Gerar Cobrança Asaas
  const handleGeneratePayment = async (billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED') => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await createAsaasPaymentForOrderAction(orderId, billingType);
    if (!res.success) {
      setError(res.error || 'Erro ao gerar cobrança no Asaas.');
    } else {
      setSuccess('Cobrança gerada com sucesso via Asaas!');
      await loadOrderData();
    }
    setActionLoading(false);
  };

  // Sincronizar Manualmente o Status com Asaas
  const handleSyncStatus = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await syncAsaasPaymentStatusAction(orderId);
    if (!res.success) {
      setError(res.error || 'Erro ao consultar status no Asaas.');
    } else {
      if (res.isConfirmed) {
        setSuccess('Pagamento confirmado com sucesso via Asaas! O pedido já pode ser convertido em campanha comercial.');
      } else {
        setSuccess(`Status atualizado via Asaas: ${res.asaasStatus}`);
      }
      await loadOrderData();
    }
    setActionLoading(false);
  };

  // Converter Pedido Pago em Campanha Comercial
  const handleConvertToCampaign = async () => {
    setActionLoading(true);
    setError(null);

    const res = await convertAdOfferOrderToCampaignAction(orderId);
    if (!res.success) {
      setError(res.error || 'Erro ao converter pedido em campanha.');
    } else {
      setSuccess('Pedido convertido em campanha comercial com sucesso!');
      router.push(`/campaigns/${res.campaign_id}`);
    }
    setActionLoading(false);
  };

  const copyPixPayload = () => {
    if (order?.asaas_pix_copy_paste) {
      navigator.clipboard.writeText(order.asaas_pix_copy_paste);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  if (loading && !order) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const isPaid = order?.payment_status === 'paid_asaas' || order?.payment_status === 'paid_manual' || order?.status === 'paid_asaas' || order?.status === 'paid_manual' || order?.status === 'converted_to_campaign';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <Link
            href="/ad-offer-orders"
            className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Pedidos de Mídia
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-purple-400" /> Checkout e Pagamento do Pedido
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Realize a quitação do pedido via Pix, Boleto ou Cartão de Crédito com processamento seguro pelo Asaas.
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-bold font-mono uppercase border ${
            isPaid
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}
        >
          {order?.payment_status || order?.status}
        </span>
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

      {/* Resumo do Pedido */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-purple-400" /> Resumo Comercial do Pedido
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500 block font-sans">Plano de Mídia Contratado</span>
            <strong className="text-white text-sm block font-sans truncate">{order?.offer?.title || 'Plano de Mídia'}</strong>
            <span className="text-purple-400">{order?.credits_amount} Inserções Contratadas</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500 block font-sans">Empresa Exibidora</span>
            <strong className="text-white text-sm block font-sans truncate">{order?.seller?.trade_name}</strong>
            <span className="text-slate-400">{order?.seller?.city} - {order?.seller?.state}</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500 block font-sans">Valor Total Congelado</span>
            <strong className="text-emerald-400 text-base block">
              R$ {((order?.gross_amount_cents || 0) / 100).toFixed(2)}
            </strong>
            <span className="text-slate-500 text-[10px]">Identificador: {order?.id}</span>
          </div>
        </div>
      </div>

      {/* Painel de Cobrança Asaas */}
      {!isPaid && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-purple-400" /> Opções de Pagamento Asaas
              </h3>
              <p className="text-xs text-slate-400">Escolha como deseja realizar a quitação do pedido</p>
            </div>

            {order?.asaas_payment_id && (
              <button
                onClick={handleSyncStatus}
                disabled={actionLoading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} /> Verificar Pagamento
              </button>
            )}
          </div>

          {/* Opções de Geração se não houver cobrança */}
          {!order?.asaas_payment_id ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                Clique abaixo para gerar a cobrança oficial no Asaas. O link da fatura, o QR Code Pix e o boleto bancário serão disponibilizados instantaneamente.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleGeneratePayment('PIX')}
                  disabled={actionLoading}
                  className="bg-purple-500 hover:bg-purple-600 font-bold text-white px-5 py-2.5 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  Gerar Pagamento Pix
                </button>

                <button
                  onClick={() => handleGeneratePayment('UNDEFINED')}
                  disabled={actionLoading}
                  className="bg-slate-800 hover:bg-slate-700 font-bold text-slate-200 px-5 py-2.5 rounded-xl text-xs transition flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" /> Gerar Fatura Completa (Pix, Cartão, Boleto)
                </button>
              </div>
            </div>
          ) : (
            /* Exibição da Cobrança Gerada */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* QR Code Pix */}
              {order.asaas_pix_qr_code && (
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3 flex flex-col items-center text-center">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Pagamento Instantâneo Pix
                  </span>
                  <img
                    src={`data:image/png;base64,${order.asaas_pix_qr_code}`}
                    alt="Pix QR Code"
                    className="w-44 h-44 rounded-xl border border-slate-800 p-2 bg-white"
                  />
                  {order.asaas_pix_copy_paste && (
                    <button
                      onClick={copyPixPayload}
                      className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30 px-3 py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                    >
                      <Copy className="w-4 h-4" /> {copiedPix ? 'Chave Copiada!' : 'Copiar Chave Pix'}
                    </button>
                  )}
                </div>
              )}

              {/* Links de Fatura e Boleto */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm mb-1">Fatura & Boleto Asaas</h4>
                  <p className="text-xs text-slate-400">
                    Acesse o portal seguro do Asaas para efetuar o pagamento via Cartão de Crédito ou imprimir o Boleto Bancário.
                  </p>
                </div>

                <div className="space-y-2">
                  {order.asaas_invoice_url && (
                    <a
                      href={order.asaas_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                    >
                      <ExternalLink className="w-4 h-4" /> Abrir Fatura do Asaas
                    </a>
                  )}

                  {order.asaas_bank_slip_url && (
                    <a
                      href={order.asaas_bank_slip_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2"
                    >
                      <FileText className="w-4 h-4" /> Baixar Boleto Bancário
                    </a>
                  )}
                </div>

                <span className="text-[10px] text-slate-500 block font-mono">
                  ID Cobrança Asaas: {order.asaas_payment_id}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Liberação de Conversão em Campanha Comercial pós-Pagamento */}
      {isPaid && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center gap-3 text-emerald-400">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <h3 className="font-bold text-base">Pagamento Confirmado!</h3>
              <p className="text-xs text-slate-300">
                O pagamento deste pedido foi confirmado no Asaas. O pedido está liberado para ser convertido em uma campanha comercial real nas telas da exibidora.
              </p>
            </div>
          </div>

          {order?.status !== 'converted_to_campaign' && (
            <div className="pt-2">
              <button
                onClick={handleConvertToCampaign}
                disabled={actionLoading}
                className="bg-emerald-500 hover:bg-emerald-600 font-bold text-slate-950 px-6 py-3 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                Converter Pedido em Campanha Comercial
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
