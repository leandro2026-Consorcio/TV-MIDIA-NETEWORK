-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4A: HARDENING DE SOLICITAÇÕES E MARKETPLACE
-- Data: 2026-07-31
-- ============================================================================

-- 1. REESCREVER RPC CREATE_MARKETPLACE_MEDIA_REQUEST COM COMPARAÇÕES UUID PURAS E VALIDAÇÃO COMPLETA
CREATE OR REPLACE FUNCTION public.create_marketplace_media_request(
  p_offer_id UUID,
  p_buyer_company_id UUID,
  p_request_message TEXT DEFAULT NULL,
  p_requested_start_date DATE DEFAULT NULL,
  p_requested_end_date DATE DEFAULT NULL,
  p_requested_media_asset_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_offer RECORD;
  v_prefs RECORD;
  v_media RECORD;
  v_order_id UUID;
  v_user_id UUID;
  v_has_blocked_segment BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  -- 1. Buscar a oferta de mídia
  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = p_offer_id;

  IF v_offer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oferta de mídia não encontrada.');
  END IF;

  -- Validar se a oferta está ACTIVE
  IF v_offer.status != 'active' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_REQUEST_BLOCKED_INACTIVE_OFFER', jsonb_build_object('offer_id', p_offer_id, 'status', v_offer.status));

    RETURN jsonb_build_object('success', false, 'error', 'Apenas ofertas de mídia com status ATIVO podem receber solicitações.');
  END IF;

  -- 2. BLOQUEAR AUTO-COMPRA (buyer_company_id != seller_company_id)
  IF p_buyer_company_id = v_offer.company_id THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_AUTO_PURCHASE_BLOCKED', jsonb_build_object('offer_id', p_offer_id));

    RETURN jsonb_build_object('success', false, 'error', 'Você não pode solicitar veiculação em uma oferta da própria empresa.');
  END IF;

  -- 3. VALIDAR DATAS SOLICITADAS
  IF p_requested_start_date IS NOT NULL AND p_requested_end_date IS NOT NULL THEN
    IF p_requested_end_date < p_requested_start_date THEN
      RETURN jsonb_build_object('success', false, 'error', 'A data final solicitada não pode ser anterior à data inicial.');
    END IF;
  END IF;

  IF v_offer.valid_from IS NOT NULL AND p_requested_start_date IS NOT NULL THEN
    IF p_requested_start_date < v_offer.valid_from::date THEN
      RETURN jsonb_build_object('success', false, 'error', 'A data inicial solicitada é anterior ao início de validade da oferta.');
    END IF;
  END IF;

  IF v_offer.valid_until IS NOT NULL AND p_requested_end_date IS NOT NULL THEN
    IF p_requested_end_date > v_offer.valid_until::date THEN
      RETURN jsonb_build_object('success', false, 'error', 'A data final solicitada excede o limite de validade da oferta.');
    END IF;
  END IF;

  -- 4. VALIDAR PREFERÊNCIAS E BLOQUEIOS DA EMPRESA EXIBIDORA (COMPARAÇÃO UUID PURA)
  SELECT * INTO v_prefs FROM public.company_network_preferences WHERE company_id = v_offer.company_id;

  IF v_prefs.company_id IS NOT NULL THEN
    -- A. Exibidora não aceita anúncios da rede
    IF v_prefs.accepts_network_ads = FALSE THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_SELLER_NO_NETWORK_ADS', jsonb_build_object('seller_company_id', v_offer.company_id));

      RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não está aceitando anúncios da rede no momento.');
    END IF;

    -- B. Empresa compradora bloqueada individualmente (UUID = ANY(UUID[]))
    IF v_prefs.blocked_companies IS NOT NULL AND p_buyer_company_id = ANY(v_prefs.blocked_companies) THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_COMPANY_BLOCKED', jsonb_build_object('seller_company_id', v_offer.company_id, 'buyer_company_id', p_buyer_company_id));

      RETURN jsonb_build_object('success', false, 'error', 'A solicitação foi recusada devido a restrições de concorrência configuradas pela empresa exibidora.');
    END IF;

    -- C. Segmentos da empresa compradora bloqueados (Interseção direta em SQL)
    IF v_prefs.blocked_segments IS NOT NULL AND array_length(v_prefs.blocked_segments, 1) > 0 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.company_segments 
        WHERE company_id = p_buyer_company_id 
          AND segment_id = ANY(v_prefs.blocked_segments)
      ) INTO v_has_blocked_segment;

      IF v_has_blocked_segment THEN
        INSERT INTO public.audit_logs (user_id, company_id, action, details)
        VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_SEGMENT_BLOCKED', jsonb_build_object('seller_company_id', v_offer.company_id, 'buyer_company_id', p_buyer_company_id));

        RETURN jsonb_build_object('success', false, 'error', 'A solicitação foi recusada pois o segmento da sua empresa é considerado concorrente direto pela exibidora.');
      END IF;
    END IF;
  END IF;

  -- 5. VALIDAR MÍDIA SOLICITADA DENTRO DA RPC (DEVE PERTENCER À COMPRADORA E ESTAR APPROVED)
  IF p_requested_media_asset_id IS NOT NULL THEN
    SELECT * INTO v_media FROM public.media_assets WHERE id = p_requested_media_asset_id;

    IF v_media.id IS NULL OR v_media.company_id != p_buyer_company_id OR v_media.status != 'approved' THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_INVALID_MEDIA_BLOCKED', jsonb_build_object('requested_media_id', p_requested_media_asset_id));

      RETURN jsonb_build_object('success', false, 'error', 'A mídia selecionada deve pertencer à sua empresa e estar obrigatoriamente APROVADA.');
    END IF;
  END IF;

  -- 6. CRIAR PEDIDO COM CONGELAMENTO AUTOMÁTICO DOS VALORES
  INSERT INTO public.ad_offer_orders (
    offer_id,
    seller_company_id,
    buyer_company_id,
    gross_amount_cents,
    platform_fee_percentage,
    platform_fee_cents,
    seller_net_cents,
    credits_amount,
    status,
    payment_status,
    approval_status,
    request_message,
    requested_start_date,
    requested_end_date,
    requested_media_asset_id,
    notes,
    created_by
  ) VALUES (
    v_offer.id,
    v_offer.company_id,
    p_buyer_company_id,
    v_offer.price_cents,
    v_offer.platform_fee_percentage,
    v_offer.platform_fee_cents,
    v_offer.seller_net_cents,
    v_offer.credits_amount,
    'requested',
    'pending',
    'pending_approval',
    p_request_message,
    p_requested_start_date,
    p_requested_end_date,
    p_requested_media_asset_id,
    p_notes,
    v_user_id
  ) RETURNING id INTO v_order_id;

  -- 7. REGISTRAR AUDIT LOG DE SUCESSO
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_REQUEST_CREATED', jsonb_build_object('order_id', v_order_id, 'offer_id', p_offer_id, 'seller_company_id', v_offer.company_id));

  RETURN jsonb_build_object(
    'success', true, 
    'order_id', v_order_id, 
    'approval_status', 'pending_approval',
    'gross_amount_cents', v_offer.price_cents,
    'seller_net_cents', v_offer.seller_net_cents
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. REESCREVER RPC DE APROVAÇÃO (VALIDAR STATUS PENDENTE)
CREATE OR REPLACE FUNCTION public.approve_marketplace_media_request(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de mídia não encontrada.');
  END IF;

  -- Impedir re-aprovação de pedidos já encerrados
  IF v_order.approval_status != 'pending_approval' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status pendente (pending_approval) podem ser aprovadas.');
  END IF;

  -- Verificar se o usuário é Admin da empresa exibidora/vendedora ou Master (Comprador NÃO aprova própria solicitação)
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Admins da empresa exibidora ou Master Admin podem aprovar solicitações.');
    END IF;
  END IF;

  UPDATE public.ad_offer_orders
  SET 
    approval_status = 'approved',
    status = 'approved',
    approved_by = v_user_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, v_order.seller_company_id, 'MARKETPLACE_REQUEST_APPROVED', jsonb_build_object('order_id', p_order_id));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. REESCREVER RPC DE REJEIÇÃO (VALIDAR STATUS PENDENTE E MOTIVO)
CREATE OR REPLACE FUNCTION public.reject_marketplace_media_request(
  p_order_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A rejeição de uma solicitação exige obrigatoriamente um motivo.');
  END IF;

  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de mídia não encontrada.');
  END IF;

  IF v_order.approval_status != 'pending_approval' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status pendente (pending_approval) podem ser rejeitadas.');
  END IF;

  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Admins da empresa exibidora ou Master Admin podem rejeitar solicitações.');
    END IF;
  END IF;

  UPDATE public.ad_offer_orders
  SET 
    approval_status = 'rejected',
    status = 'rejected',
    rejected_by = v_user_id,
    rejected_at = NOW(),
    rejection_reason = p_rejection_reason,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, v_order.seller_company_id, 'MARKETPLACE_REQUEST_REJECTED', jsonb_build_object('order_id', p_order_id, 'reason', p_rejection_reason));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. REESCREVER RPC DE CANCELAMENTO (VALIDAR STATUS PENDENTE)
CREATE OR REPLACE FUNCTION public.cancel_marketplace_media_request(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_buyer_member BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de mídia não encontrada.');
  END IF;

  IF v_order.approval_status != 'pending_approval' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status pendente (pending_approval) podem ser canceladas.');
  END IF;

  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.buyer_company_id AND user_id = v_user_id AND is_active = TRUE
    ) INTO v_is_buyer_member;

    IF NOT v_is_buyer_member THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas membros da empresa compradora ou Master Admin podem cancelar solicitações pendentes.');
    END IF;
  END IF;

  UPDATE public.ad_offer_orders
  SET 
    approval_status = 'cancelled',
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, v_order.buyer_company_id, 'MARKETPLACE_REQUEST_CANCELLED', jsonb_build_object('order_id', p_order_id));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
