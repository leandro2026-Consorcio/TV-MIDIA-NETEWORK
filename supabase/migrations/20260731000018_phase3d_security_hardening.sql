-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3D: HARDENING E SEGURANÇA DE OFERTAS E PEDIDOS
-- Data: 2026-07-31
-- ============================================================================

-- 1. CORRIGIR POLICY DE INSERÇÃO EM AD_OFFER_ORDERS (REMOVER WITH CHECK TRUE)
DROP POLICY IF EXISTS "AdOfferOrders - Criação por usuários autenticados" ON public.ad_offer_orders;

CREATE POLICY "AdOfferOrders - Criação por membros da empresa compradora ou Master Admin"
  ON public.ad_offer_orders FOR INSERT TO authenticated
  WITH CHECK (
    is_master_admin() OR 
    (buyer_company_id IS NOT NULL AND buyer_company_id IN (SELECT public.get_user_company_ids())) OR
    buyer_name IS NOT NULL
  );

-- 2. TRIGGER DE INTEGRIDADE E CONGELAMENTO DE VALORES EM AD_OFFER_ORDERS
CREATE OR REPLACE FUNCTION public.validate_ad_offer_order_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_offer RECORD;
BEGIN
  -- 1. Buscar a oferta referenciada
  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = NEW.offer_id;

  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'A oferta de mídia especificada não foi encontrada.';
  END IF;

  -- 2. Validar que a oferta está obrigatoriamente ACTIVE
  IF v_offer.status != 'active' THEN
    RAISE EXCEPTION 'Pedidos de mídia só podem ser criados para ofertas ativas (status = active). Status atual: %', v_offer.status;
  END IF;

  -- 3. Validar se a empresa vendedora é exatamente a dona da oferta
  IF NEW.seller_company_id IS NULL OR NEW.seller_company_id != v_offer.company_id THEN
    NEW.seller_company_id := v_offer.company_id;
  END IF;

  -- 4. CONGELAR OS VALORES REAIS DA OFERTA NO ATO DO PEDIDO (IMPEDE ADULTERAÇÃO DE VALORES)
  NEW.gross_amount_cents := v_offer.price_cents;
  NEW.platform_fee_percentage := v_offer.platform_fee_percentage;
  NEW.platform_fee_cents := v_offer.platform_fee_cents;
  NEW.seller_net_cents := v_offer.seller_net_cents;
  NEW.credits_amount := v_offer.credits_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_ad_offer_order_integrity ON public.ad_offer_orders;
CREATE TRIGGER trg_validate_ad_offer_order_integrity
  BEFORE INSERT ON public.ad_offer_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ad_offer_order_integrity();

-- 3. TRIGGER DE VALIDAÇÃO DE TRANSIÇÕES DE STATUS E MOTIVO DE REJEIÇÃO EM COMPANY_AD_OFFERS
CREATE OR REPLACE FUNCTION public.validate_ad_offer_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Rejeição exige motivo não nulo
  IF NEW.status = 'rejected' AND (NEW.rejection_reason IS NULL OR trim(NEW.rejection_reason) = '') THEN
    RAISE EXCEPTION 'A rejeição de uma oferta de mídia exige obrigatoriamente o preenchimento da justificativa (rejection_reason).';
  END IF;

  -- Bloquear edição direta de comissão por empresa não-master se não permitido
  IF OLD.platform_fee_percentage != NEW.platform_fee_percentage AND NOT is_master_admin() THEN
    RAISE EXCEPTION 'Apenas o Master Admin pode alterar o percentual de comissão da plataforma em uma oferta.';
  END IF;

  -- Transição de arquivado exige Master Admin
  IF OLD.status = 'archived' AND NEW.status != 'archived' AND NOT is_master_admin() THEN
    RAISE EXCEPTION 'Ofertas arquivadas só podem ser reativadas pelo Master Admin.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_ad_offer_status_transition ON public.company_ad_offers;
CREATE TRIGGER trg_validate_ad_offer_status_transition
  BEFORE UPDATE ON public.company_ad_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ad_offer_status_transition();

-- 4. RPC TRANSACIONAL PARA CRIAÇÃO SEGURA DE PEDIDOS (CREATE_AD_OFFER_ORDER)
CREATE OR REPLACE FUNCTION public.create_ad_offer_order_rpc(
  p_offer_id UUID,
  p_buyer_company_id UUID DEFAULT NULL,
  p_buyer_name TEXT DEFAULT NULL,
  p_buyer_email TEXT DEFAULT NULL,
  p_buyer_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_offer RECORD;
  v_order_id UUID;
BEGIN
  -- 1. Buscar a oferta ativa
  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = p_offer_id;
  
  IF v_offer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oferta de mídia não encontrada.');
  END IF;

  IF v_offer.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas ofertas de mídia ativas podem receber pedidos.');
  END IF;

  -- 2. Inserir o pedido com congelamento automático de valores
  INSERT INTO public.ad_offer_orders (
    offer_id,
    seller_company_id,
    buyer_company_id,
    buyer_name,
    buyer_email,
    buyer_phone,
    gross_amount_cents,
    platform_fee_percentage,
    platform_fee_cents,
    seller_net_cents,
    credits_amount,
    status,
    payment_status,
    notes,
    created_by
  ) VALUES (
    v_offer.id,
    v_offer.company_id,
    p_buyer_company_id,
    p_buyer_name,
    p_buyer_email,
    p_buyer_phone,
    v_offer.price_cents,
    v_offer.platform_fee_percentage,
    v_offer.platform_fee_cents,
    v_offer.seller_net_cents,
    v_offer.credits_amount,
    'requested',
    'pending',
    p_notes,
    auth.uid()
  ) RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true, 
    'order_id', v_order_id, 
    'gross_amount_cents', v_offer.price_cents, 
    'seller_net_cents', v_offer.seller_net_cents
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
