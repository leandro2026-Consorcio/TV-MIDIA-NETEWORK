-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3D: VITRINE DE PLANOS DE MÍDIA POR EMPRESA
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE CONFIGURAÇÕES DE RECEITA DA PLATAFORMA (PLATFORM_REVENUE_SETTINGS)
CREATE TABLE IF NOT EXISTS public.platform_revenue_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_platform_fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  minimum_price_cents INTEGER NOT NULL DEFAULT 5000, -- R$ 50,00
  allow_company_custom_fee BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir Configuração Padrão se não existir
INSERT INTO public.platform_revenue_settings (default_platform_fee_percentage, minimum_price_cents, allow_company_custom_fee, is_active)
VALUES (15.00, 5000, FALSE, TRUE)
ON CONFLICT DO NOTHING;

-- 2. TABELA DE CARDS DE OFERTAS DE MÍDIA DAS EMPRESAS (COMPANY_AD_OFFERS)
CREATE TABLE IF NOT EXISTS public.company_ad_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  credits_amount NUMERIC(12,2) NOT NULL CHECK (credits_amount > 0),
  duration_seconds INTEGER DEFAULT 10,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 5000),
  platform_fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  platform_fee_cents INTEGER GENERATED ALWAYS AS (ROUND(price_cents * platform_fee_percentage / 100)::integer) STORED,
  seller_net_cents INTEGER GENERATED ALWAYS AS ((price_cents - ROUND(price_cents * platform_fee_percentage / 100))::integer) STORED,
  requires_approval BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'rejected', 'archived')),
  rejection_reason TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_offers_company ON public.company_ad_offers(company_id);
CREATE INDEX IF NOT EXISTS idx_ad_offers_status ON public.company_ad_offers(status);

-- 3. TABELA DE PEDIDOS DE PLANOS DE MÍDIA (AD_OFFER_ORDERS)
CREATE TABLE IF NOT EXISTS public.ad_offer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.company_ad_offers(id) ON DELETE RESTRICT,
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  buyer_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  gross_amount_cents INTEGER NOT NULL,
  platform_fee_percentage NUMERIC(5,2) NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  seller_net_cents INTEGER NOT NULL,
  credits_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('draft', 'requested', 'approved', 'rejected', 'cancelled', 'paid_manual', 'converted_to_campaign')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('not_required', 'pending', 'paid_manual', 'failed', 'refunded')),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_orders_seller ON public.ad_offer_orders(seller_company_id);
CREATE INDEX IF NOT EXISTS idx_ad_orders_buyer ON public.ad_offer_orders(buyer_company_id);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.platform_revenue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_ad_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_offer_orders ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS - PLATFORM_REVENUE_SETTINGS
DROP POLICY IF EXISTS "PlatformRevenueSettings - Leitura por todos os autenticados" ON public.platform_revenue_settings;
CREATE POLICY "PlatformRevenueSettings - Leitura por todos os autenticados"
  ON public.platform_revenue_settings FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "PlatformRevenueSettings - Gerenciamento por Master Admin" ON public.platform_revenue_settings;
CREATE POLICY "PlatformRevenueSettings - Gerenciamento por Master Admin"
  ON public.platform_revenue_settings FOR ALL TO authenticated USING (is_master_admin());

-- POLÍTICAS RLS - COMPANY_AD_OFFERS
DROP POLICY IF EXISTS "CompanyAdOffers - Leitura por membros, ativas públicas ou Master Admin" ON public.company_ad_offers;
CREATE POLICY "CompanyAdOffers - Leitura por membros, ativas públicas ou Master Admin"
  ON public.company_ad_offers FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids()) OR
    (status = 'active' AND is_public = TRUE)
  );

DROP POLICY IF EXISTS "CompanyAdOffers - Gerenciamento por Admins da Empresa ou Master Admin" ON public.company_ad_offers;
CREATE POLICY "CompanyAdOffers - Gerenciamento por Admins da Empresa ou Master Admin"
  ON public.company_ad_offers FOR ALL TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_admin_company_ids())
  );

-- POLÍTICAS RLS - AD_OFFER_ORDERS
DROP POLICY IF EXISTS "AdOfferOrders - Leitura por vendedor, comprador ou Master Admin" ON public.ad_offer_orders;
CREATE POLICY "AdOfferOrders - Leitura por vendedor, comprador ou Master Admin"
  ON public.ad_offer_orders FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    seller_company_id IN (SELECT public.get_user_company_ids()) OR
    (buyer_company_id IS NOT NULL AND buyer_company_id IN (SELECT public.get_user_company_ids()))
  );

DROP POLICY IF EXISTS "AdOfferOrders - Criação por usuários autenticados" ON public.ad_offer_orders;
CREATE POLICY "AdOfferOrders - Criação por usuários autenticados"
  ON public.ad_offer_orders FOR INSERT TO authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "AdOfferOrders - Atualização por vendedor ou Master Admin" ON public.ad_offer_orders;
CREATE POLICY "AdOfferOrders - Atualização por vendedor ou Master Admin"
  ON public.ad_offer_orders FOR UPDATE TO authenticated
  USING (
    is_master_admin() OR 
    seller_company_id IN (SELECT public.get_user_admin_company_ids())
  );
