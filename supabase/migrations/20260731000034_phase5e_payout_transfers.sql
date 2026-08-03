-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5E: TRANSFERÊNCIA CONTROLADA PÓS-ENTREGA
-- Data: 2026-07-31
-- ============================================================================

-- 1. ALTERAÇÃO NA TABELA SELLER_FINANCIAL_LEDGER
ALTER TABLE public.seller_financial_ledger
  ADD COLUMN IF NOT EXISTS amount_transferred_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_transfer_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transfer_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (transfer_status IN ('not_requested', 'partially_transferred', 'transferred', 'transfer_failed'));

-- 2. TABELA DE LOTES DE REPASSE (SELLER_PAYOUT_BATCHES)
CREATE TABLE IF NOT EXISTS public.seller_payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'processing', 'completed', 'partially_failed', 'failed', 'cancelled')),
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  executed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON public.seller_payout_batches(status);

-- 3. TABELA DE ITENS DO LOTE (SELLER_PAYOUT_BATCH_ITEMS)
CREATE TABLE IF NOT EXISTS public.seller_payout_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.seller_payout_batches(id) ON DELETE CASCADE,
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ad_offer_order_id UUID NOT NULL REFERENCES public.ad_offer_orders(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  seller_financial_ledger_id UUID REFERENCES public.seller_financial_ledger(id) ON DELETE SET NULL,
  seller_payout_eligibility_id UUID REFERENCES public.seller_payout_eligibility(id) ON DELETE SET NULL,
  asaas_payment_id TEXT,
  asaas_wallet_id TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'processing', 'transferred', 'failed', 'cancelled', 'blocked')),
  asaas_transfer_id TEXT,
  transfer_response JSONB,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_batch_items_batch ON public.seller_payout_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_seller ON public.seller_payout_batch_items(seller_company_id);

-- 4. TABELA DE HISTÓRICO DE TRANSFERÊNCIAS (SELLER_PAYOUT_TRANSFERS)
CREATE TABLE IF NOT EXISTS public.seller_payout_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  batch_item_id UUID REFERENCES public.seller_payout_batch_items(id) ON DELETE SET NULL,
  seller_financial_ledger_id UUID REFERENCES public.seller_financial_ledger(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  asaas_wallet_id TEXT NOT NULL,
  asaas_transfer_id TEXT,
  transfer_status TEXT NOT NULL DEFAULT 'created' CHECK (transfer_status IN ('created', 'processing', 'done', 'failed', 'cancelled', 'reversed')),
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  raw_request JSONB,
  raw_response JSONB,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_transfers_seller ON public.seller_payout_transfers(seller_company_id);
CREATE INDEX IF NOT EXISTS idx_payout_transfers_idempotency ON public.seller_payout_transfers(idempotency_key);

-- 5. HABILITAR RLS E SEGURANÇA MULTIEMPRESA
ALTER TABLE public.seller_payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payout_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payout_transfers ENABLE ROW LEVEL SECURITY;

-- Politicas seller_payout_batches
DROP POLICY IF EXISTS "PayoutBatches - Master Admin Full Access" ON public.seller_payout_batches;
CREATE POLICY "PayoutBatches - Master Admin Full Access"
  ON public.seller_payout_batches FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

DROP POLICY IF EXISTS "PayoutBatches - Company Member Read" ON public.seller_payout_batches;
CREATE POLICY "PayoutBatches - Company Member Read"
  ON public.seller_payout_batches FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.seller_payout_batch_items
    WHERE batch_id = seller_payout_batches.id AND seller_company_id IN (SELECT get_user_company_ids())
  ));

-- Politicas seller_payout_batch_items
DROP POLICY IF EXISTS "PayoutBatchItems - Master Admin Full Access" ON public.seller_payout_batch_items;
CREATE POLICY "PayoutBatchItems - Master Admin Full Access"
  ON public.seller_payout_batch_items FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

DROP POLICY IF EXISTS "PayoutBatchItems - Seller Company Read" ON public.seller_payout_batch_items;
CREATE POLICY "PayoutBatchItems - Seller Company Read"
  ON public.seller_payout_batch_items FOR SELECT TO authenticated
  USING (seller_company_id IN (SELECT get_user_company_ids()));

-- Politicas seller_payout_transfers
DROP POLICY IF EXISTS "PayoutTransfers - Master Admin Full Access" ON public.seller_payout_transfers;
CREATE POLICY "PayoutTransfers - Master Admin Full Access"
  ON public.seller_payout_transfers FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

DROP POLICY IF EXISTS "PayoutTransfers - Seller Company Read" ON public.seller_payout_transfers;
CREATE POLICY "PayoutTransfers - Seller Company Read"
  ON public.seller_payout_transfers FOR SELECT TO authenticated
  USING (seller_company_id IN (SELECT get_user_company_ids()));
