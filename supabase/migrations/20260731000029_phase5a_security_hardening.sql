-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5A: HARDENING ASAAS E ÍNDICE ÚNICO
-- Data: 2026-07-31
-- ============================================================================

-- 1. ADICIONAR ÍNDICE ÚNICO PARCIAL EM AD_OFFER_ORDERS (ASAAS_PAYMENT_ID)
-- Impede que dois pedidos distintos fiquem associados à mesma cobrança no Asaas
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_asaas_payment_id_unique 
ON public.ad_offer_orders(asaas_payment_id) 
WHERE asaas_payment_id IS NOT NULL;
