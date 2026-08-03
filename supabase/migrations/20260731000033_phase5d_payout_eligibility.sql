-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5D: SIMULAÇÃO E ELEGIBILIDADE DE PAYOUT
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE ELEGIBILIDADE DE PAYOUT POR PEDIDO (SELLER_PAYOUT_ELIGIBILITY)
CREATE TABLE IF NOT EXISTS public.seller_payout_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  buyer_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ad_offer_order_id UUID NOT NULL UNIQUE REFERENCES public.ad_offer_orders(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  seller_financial_ledger_id UUID REFERENCES public.seller_financial_ledger(id) ON DELETE SET NULL,
  asaas_payment_id TEXT,
  gross_amount_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  seller_net_cents INTEGER NOT NULL DEFAULT 0,
  eligible_amount_cents INTEGER NOT NULL DEFAULT 0,
  ineligible_amount_cents INTEGER NOT NULL DEFAULT 0,
  eligibility_status TEXT NOT NULL DEFAULT 'not_eligible' CHECK (eligibility_status IN ('not_eligible', 'pending_delivery', 'pending_financial_profile', 'pending_asaas_wallet', 'eligible', 'blocked', 'cancelled')),
  eligibility_reason TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'in_progress',
  financial_status TEXT NOT NULL DEFAULT 'pending_delivery',
  seller_verification_status TEXT DEFAULT 'draft',
  asaas_status TEXT DEFAULT 'not_created',
  asaas_wallet_id TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_elig_seller_id ON public.seller_payout_eligibility(seller_company_id);
CREATE INDEX IF NOT EXISTS idx_payout_elig_status ON public.seller_payout_eligibility(eligibility_status);

-- 2. TABELA DE SIMULAÇÕES DE LOTE (SELLER_PAYOUT_SIMULATIONS)
CREATE TABLE IF NOT EXISTS public.seller_payout_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_gross_cents INTEGER NOT NULL DEFAULT 0,
  total_platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_seller_net_cents INTEGER NOT NULL DEFAULT 0,
  total_eligible_cents INTEGER NOT NULL DEFAULT 0,
  total_blocked_cents INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_sim_seller_id ON public.seller_payout_simulations(seller_company_id);

-- 3. HABILITAR RLS E SEGURANÇA MULTIEMPRESA
ALTER TABLE public.seller_payout_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payout_simulations ENABLE ROW LEVEL SECURITY;

-- Politicas seller_payout_eligibility
DROP POLICY IF EXISTS "PayoutEligibility - Master Admin Full Access" ON public.seller_payout_eligibility;
CREATE POLICY "PayoutEligibility - Master Admin Full Access"
  ON public.seller_payout_eligibility FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

DROP POLICY IF EXISTS "PayoutEligibility - Seller Company Read" ON public.seller_payout_eligibility;
CREATE POLICY "PayoutEligibility - Seller Company Read"
  ON public.seller_payout_eligibility FOR SELECT TO authenticated
  USING (seller_company_id IN (SELECT get_user_company_ids()));

-- Politicas seller_payout_simulations
DROP POLICY IF EXISTS "PayoutSimulations - Master Admin Full Access" ON public.seller_payout_simulations;
CREATE POLICY "PayoutSimulations - Master Admin Full Access"
  ON public.seller_payout_simulations FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

DROP POLICY IF EXISTS "PayoutSimulations - Seller Company Read" ON public.seller_payout_simulations;
CREATE POLICY "PayoutSimulations - Seller Company Read"
  ON public.seller_payout_simulations FOR SELECT TO authenticated
  USING (seller_company_id IN (SELECT get_user_company_ids()));
