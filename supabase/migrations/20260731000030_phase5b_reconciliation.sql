-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5B: REVISÃO E CONCILIAÇÃO ASAAS
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE REVISÕES CONTÁBEIS E ALERTAS (ASAAS_RECONCILIATION_REVIEWS)
CREATE TABLE IF NOT EXISTS public.asaas_reconciliation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_payment_event_id UUID REFERENCES public.asaas_payment_events(id) ON DELETE SET NULL,
  ad_offer_order_id UUID REFERENCES public.ad_offer_orders(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'reviewed', 'ignored', 'resolved')),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconcil_event_id ON public.asaas_reconciliation_reviews(asaas_payment_event_id);
CREATE INDEX IF NOT EXISTS idx_reconcil_order_id ON public.asaas_reconciliation_reviews(ad_offer_order_id);

-- 2. HABILITAR RLS COM ACESSO EXCLUSIVO PARA MASTER ADMIN
ALTER TABLE public.asaas_reconciliation_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AsaasReconciliationReviews - Acesso Exclusivo Master Admin" ON public.asaas_reconciliation_reviews;
CREATE POLICY "AsaasReconciliationReviews - Acesso Exclusivo Master Admin"
  ON public.asaas_reconciliation_reviews FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());
