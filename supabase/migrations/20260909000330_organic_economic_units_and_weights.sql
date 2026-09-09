-- ETAPA 3B MPM: Economia da Divulgação Orgânica, Pesos por Tipo de Tela e Entitlements
-- Referência comercial MPM: 2.000 inserções comerciais ≈ R$ 500 => R$ 0,25 / inserção equivalente (4.0 inserções / R$ 1,00)
-- Pesos de consumo por tipo de tela:
--   TV Comercial = 1,00
--   Monitor Windows Comercial = 0,10
--   TV/Monitor Residencial (Rede Orgânica) = 0,01
-- Zero Crédito MPM é gerado. Zero impacto em ledger de carteira/wallets, saques ou Asaas.

-- 1. EXTENSÃO DA TABELA DE CONFIGURAÇÃO
ALTER TABLE public.organic_benefit_configurations
  ADD COLUMN IF NOT EXISTS commercial_insertion_unit_cost NUMERIC(8,4) NOT NULL DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS commercial_tv_weight NUMERIC(6,4) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS windows_monitor_weight NUMERIC(6,4) NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS residential_screen_weight NUMERIC(6,4) NOT NULL DEFAULT 0.01;

ALTER TABLE public.organic_benefit_configurations
  ALTER COLUMN media_insertions_per_brl SET DEFAULT 4.0;

UPDATE public.organic_benefit_configurations
SET media_insertions_per_brl = 4.0,
    commercial_insertion_unit_cost = 0.25,
    commercial_tv_weight = 1.00,
    windows_monitor_weight = 0.10,
    residential_screen_weight = 0.01,
    max_granted_insertions = 50000;

-- 2. ATUALIZAÇÃO DA RPC DE CÁLCULO DE TERMOS ECONÔMICOS
CREATE OR REPLACE FUNCTION public.calculate_organic_benefit_terms(p_unit_value NUMERIC, p_quantity INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg RECORD;
  v_pts NUMERIC;
  v_promo_val NUMERIC;
  v_insertions INTEGER;
  v_unit_cost NUMERIC;
  v_mult NUMERIC;
BEGIN
  SELECT * INTO v_cfg FROM public.organic_benefit_configurations WHERE is_active = true ORDER BY version DESC LIMIT 1;
  IF v_cfg.id IS NULL THEN
    v_cfg.points_per_brl := 1.0;
    v_cfg.rounding_mode := 'round';
    v_cfg.commercial_insertion_unit_cost := 0.25;
    v_cfg.media_insertions_per_brl := 4.0;
    v_cfg.commercial_tv_weight := 1.00;
    v_cfg.windows_monitor_weight := 0.10;
    v_cfg.residential_screen_weight := 0.01;
    v_cfg.max_granted_insertions := 50000;
  END IF;

  -- 1. PONTOS DO PARTICIPANTE (resgate unitário pelo consumidor - quantidade NÃO multiplica)
  v_pts := p_unit_value * COALESCE(v_cfg.points_per_brl, 1.0);
  IF v_cfg.rounding_mode = 'ceil' THEN
    v_pts := CEIL(v_pts);
  ELSIF v_cfg.rounding_mode = 'floor' THEN
    v_pts := FLOOR(v_pts);
  ELSE
    v_pts := ROUND(v_pts);
  END IF;
  IF v_pts < 1 THEN v_pts := 1; END IF;

  -- 2. CONTRIBUIÇÃO PROMOCIONAL TOTAL DA EMPRESA (valor aprovado x quantidade aprovada)
  v_promo_val := ROUND(p_unit_value * GREATEST(1, p_quantity), 2);

  -- 3. DIREITO DE DIVULGAÇÃO EM UNIDADES COMERCIAIS EQUIVALENTES
  -- Referência canônica MPM: R$ 0,25 por inserção comercial equivalente (4.0 inserções por R$ 1,00)
  -- Exemplo: R$ 799,00 / 0,25 = 3.196 unidades equivalentes
  v_unit_cost := COALESCE(v_cfg.commercial_insertion_unit_cost, 0.25);
  v_mult := COALESCE(v_cfg.media_insertions_per_brl, 4.0);
  IF v_unit_cost > 0 THEN
    v_insertions := ROUND(v_promo_val / v_unit_cost)::INTEGER;
  ELSE
    v_insertions := ROUND(v_promo_val * v_mult)::INTEGER;
  END IF;

  v_insertions := LEAST(COALESCE(v_cfg.max_granted_insertions, 50000), GREATEST(1, v_insertions));

  RETURN jsonb_build_object(
    'suggested_points', v_pts,
    'promotional_value', v_promo_val,
    'granted_insertions', v_insertions,
    'commercial_insertion_unit_cost', v_unit_cost,
    'media_insertions_per_brl', v_mult,
    'commercial_tv_weight', COALESCE(v_cfg.commercial_tv_weight, 1.00),
    'windows_monitor_weight', COALESCE(v_cfg.windows_monitor_weight, 0.10),
    'residential_screen_weight', COALESCE(v_cfg.residential_screen_weight, 0.01),
    'points_per_brl', v_cfg.points_per_brl,
    'rounding_mode', v_cfg.rounding_mode
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_organic_benefit_terms(NUMERIC, INTEGER) TO authenticated, anon, service_role;

-- 3. ATUALIZAÇÃO DA RPC submit_or_update_organic_benefit
CREATE OR REPLACE FUNCTION public.submit_or_update_organic_benefit(
  p_id UUID,
  p_company_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_category TEXT,
  p_image_url TEXT,
  p_announced_unit_value NUMERIC,
  p_quantity INTEGER,
  p_max_per_user INTEGER,
  p_unit_locations TEXT[],
  p_allowed_weekdays INTEGER[],
  p_allowed_time_start TIME,
  p_allowed_time_end TIME,
  p_min_consumption NUMERIC,
  p_coupon_validity_days INTEGER,
  p_expires_at TIMESTAMPTZ,
  p_campaign_id UUID DEFAULT NULL,
  p_terms TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg RECORD;
  v_is_trusted BOOLEAN := false;
  v_is_suspicious BOOLEAN := false;
  v_status TEXT := 'pending_review';
  v_terms JSONB;
  v_pts NUMERIC;
  v_promo_val NUMERIC;
  v_insertions INTEGER;
  v_res_id UUID;
  v_existing RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  IF NOT (public.is_master_admin() OR p_company_id IN (SELECT public.get_user_admin_company_ids())) THEN
    RAISE EXCEPTION 'Acesso negado: permissão de administrador da empresa necessária.';
  END IF;

  IF length(trim(p_title)) < 2 THEN RAISE EXCEPTION 'Título do benefício é obrigatório.'; END IF;
  IF p_announced_unit_value <= 0 THEN RAISE EXCEPTION 'Valor anunciado deve ser positivo.'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade de estoque deve ser maior que zero.'; END IF;
  IF p_expires_at <= NOW() THEN RAISE EXCEPTION 'A data de validade da campanha deve ser no futuro.'; END IF;

  SELECT * INTO v_cfg FROM public.organic_benefit_configurations WHERE is_active = true ORDER BY version DESC LIMIT 1;
  IF v_cfg.id IS NULL THEN
    v_cfg.points_per_brl := 1.0;
    v_cfg.rounding_mode := 'round';
    v_cfg.commercial_insertion_unit_cost := 0.25;
    v_cfg.media_insertions_per_brl := 4.0;
    v_cfg.max_granted_insertions := 50000;
    v_cfg.suspicious_price_threshold := 500.00;
    v_cfg.trusted_company_ids := '{}';
    v_cfg.require_manual_approval := true;
  END IF;

  v_terms := public.calculate_organic_benefit_terms(p_announced_unit_value, p_quantity);
  v_pts := (v_terms->>'suggested_points')::NUMERIC;
  v_promo_val := (v_terms->>'promotional_value')::NUMERIC;
  v_insertions := (v_terms->>'granted_insertions')::INTEGER;

  IF p_announced_unit_value > COALESCE(v_cfg.suspicious_price_threshold, 500.00) THEN
    v_is_suspicious := true;
  END IF;

  IF p_company_id = ANY(COALESCE(v_cfg.trusted_company_ids, '{}')) THEN
    v_is_trusted := true;
  END IF;

  -- Auto-aprovação para empresas confiáveis ou Master Admin
  IF (v_is_trusted AND NOT v_is_suspicious AND NOT COALESCE(v_cfg.require_manual_approval, true)) OR public.is_master_admin() THEN
    v_status := 'active';
  ELSE
    v_status := 'pending_review';
  END IF;

  IF p_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.organic_campaign_rewards WHERE id = p_id FOR UPDATE;
    IF v_existing.id IS NULL THEN RAISE EXCEPTION 'Benefício não encontrado.'; END IF;
    IF NOT (public.is_master_admin() OR v_existing.company_id IN (SELECT public.get_user_admin_company_ids())) THEN
      RAISE EXCEPTION 'Acesso negado.';
    END IF;

    UPDATE public.organic_campaign_rewards SET
      title = trim(p_title),
      description = trim(p_description),
      category = p_category,
      image_url = p_image_url,
      announced_unit_value = p_announced_unit_value,
      approved_unit_value = CASE WHEN v_status = 'active' THEN p_announced_unit_value ELSE approved_unit_value END,
      approved_promotional_value = CASE WHEN v_status = 'active' THEN v_promo_val ELSE approved_promotional_value END,
      credits_required = v_pts,
      credit_budget = v_pts * p_quantity,
      quantity_total = p_quantity,
      quantity_available = GREATEST(0, p_quantity - quantity_reserved - quantity_redeemed),
      max_per_user = COALESCE(p_max_per_user, 1),
      unit_locations = COALESCE(p_unit_locations, '{}'),
      allowed_weekdays = COALESCE(p_allowed_weekdays, '{0,1,2,3,4,5,6}'),
      allowed_time_start = p_allowed_time_start,
      allowed_time_end = p_allowed_time_end,
      min_consumption = p_min_consumption,
      coupon_validity_days = COALESCE(p_coupon_validity_days, 7),
      expires_at = p_expires_at,
      status = v_status,
      is_suspicious_price = v_is_suspicious,
      terms = p_terms,
      campaign_id = COALESCE(p_campaign_id, campaign_id),
      updated_at = NOW()
    WHERE id = p_id
    RETURNING id INTO v_res_id;
  ELSE
    INSERT INTO public.organic_campaign_rewards (
      company_id, campaign_id, title, description, category, image_url,
      announced_unit_value, approved_unit_value, approved_promotional_value,
      credits_required, credit_budget, quantity_total, quantity_available,
      max_per_user, unit_locations, allowed_weekdays, allowed_time_start,
      allowed_time_end, min_consumption, coupon_validity_days, expires_at,
      status, is_suspicious_price, terms, created_by
    ) VALUES (
      p_company_id, p_campaign_id, trim(p_title), trim(p_description), p_category, p_image_url,
      p_announced_unit_value, CASE WHEN v_status = 'active' THEN p_announced_unit_value ELSE NULL END,
      CASE WHEN v_status = 'active' THEN v_promo_val ELSE NULL END,
      v_pts, v_pts * p_quantity, p_quantity, p_quantity,
      COALESCE(p_max_per_user, 1), COALESCE(p_unit_locations, '{}'), COALESCE(p_allowed_weekdays, '{0,1,2,3,4,5,6}'),
      p_allowed_time_start, p_allowed_time_end, p_min_consumption, COALESCE(p_coupon_validity_days, 7), p_expires_at,
      v_status, v_is_suspicious, p_terms, auth.uid()
    ) RETURNING id INTO v_res_id;
  END IF;

  -- Se auto-aprovado, gera entitlement de mídia com pesos de tela
  IF v_status = 'active' THEN
    INSERT INTO public.organic_benefit_media_entitlements (
      reward_id, company_id, approved_promotional_value, granted_insertions, status, starts_at, expires_at,
      metadata
    ) VALUES (
      v_res_id, p_company_id, v_promo_val, v_insertions, 'active', NOW(), p_expires_at,
      jsonb_build_object(
        'unit_cost', 0.25,
        'weights', jsonb_build_object('commercial_tv', 1.00, 'windows_monitor', 0.10, 'residential', 0.01)
      )
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_res_id,
    'status', v_status,
    'suggested_points', v_pts,
    'promotional_value', v_promo_val,
    'granted_insertions', v_insertions,
    'is_suspicious', v_is_suspicious
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_or_update_organic_benefit(UUID,UUID,TEXT,TEXT,TEXT,TEXT,NUMERIC,INTEGER,INTEGER,TEXT[],INTEGER[],TIME,TIME,NUMERIC,INTEGER,TIMESTAMPTZ,UUID,TEXT) TO authenticated, anon, service_role;

-- 4. FORÇA RELOAD DO SCHEMA CACHE NO POSTGREST
NOTIFY pgrst, 'reload schema';
