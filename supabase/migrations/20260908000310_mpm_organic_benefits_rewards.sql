-- ETAPA 3 MPM: Benefícios & Prêmios da Rede Orgânica + Direitos de Divulgação
-- Extensão aditiva: Preserva integridade de Core MPM, Wallets, Asaas e Rede Orgânica existente.
-- Zero Crédito MPM é gerado a partir de benefícios ou capacidade ociosa de telas.

INSERT INTO public.platform_settings(key, value, description) VALUES
  ('organic_benefits_v2', 'true'::jsonb, 'Módulo comercial de benefícios e prêmios da Rede Orgânica ativo.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

-- 1. EXTENSÃO: organic_campaign_rewards
-- Permite cadastro comercial desvinculado de campanha pré-existente e adiciona controles de aprovação e regras
ALTER TABLE public.organic_campaign_rewards ALTER COLUMN campaign_id DROP NOT NULL;
ALTER TABLE public.organic_campaign_rewards DROP CONSTRAINT IF EXISTS organic_campaign_rewards_campaign_id_key;

ALTER TABLE public.organic_campaign_rewards DROP CONSTRAINT IF EXISTS organic_campaign_rewards_status_check;
ALTER TABLE public.organic_campaign_rewards ADD CONSTRAINT organic_campaign_rewards_status_check
  CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'exhausted', 'expired', 'rejected', 'archived', 'cancelled'));

ALTER TABLE public.organic_campaign_rewards
  ADD COLUMN IF NOT EXISTS announced_unit_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS approved_unit_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS approved_promotional_value NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS max_per_user INTEGER NOT NULL DEFAULT 1 CHECK (max_per_user >= 1),
  ADD COLUMN IF NOT EXISTS allowed_weekdays INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  ADD COLUMN IF NOT EXISTS allowed_time_start TIME,
  ADD COLUMN IF NOT EXISTS allowed_time_end TIME,
  ADD COLUMN IF NOT EXISTS blocked_dates DATE[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_consumption NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS coupon_validity_days INTEGER NOT NULL DEFAULT 7 CHECK (coupon_validity_days >= 1),
  ADD COLUMN IF NOT EXISTS points_refund_policy TEXT NOT NULL DEFAULT 'refund_on_expire' CHECK (points_refund_policy IN ('refund_on_expire','no_refund')),
  ADD COLUMN IF NOT EXISTS stock_return_policy TEXT NOT NULL DEFAULT 'return_if_active' CHECK (stock_return_policy IN ('return_if_active','no_return')),
  ADD COLUMN IF NOT EXISTS unit_locations TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_suspicious_price BOOLEAN NOT NULL DEFAULT false;

-- 2. EXTENSÃO: organic_reward_redemptions
-- Armazena cupom legível nominal, token seguro opaco para QR e dados de baixa com operador
ALTER TABLE public.organic_reward_redemptions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS qr_token TEXT,
  ADD COLUMN IF NOT EXISTS participant_display_name TEXT,
  ADD COLUMN IF NOT EXISTS location_unit TEXT,
  ADD COLUMN IF NOT EXISTS validation_method TEXT CHECK (validation_method IN ('qr','code','manual')),
  ADD COLUMN IF NOT EXISTS validation_notes TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organic_reward_redemptions_coupon_code ON public.organic_reward_redemptions(coupon_code) WHERE coupon_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_organic_reward_redemptions_qr_token ON public.organic_reward_redemptions(qr_token) WHERE qr_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organic_redemptions_company ON public.organic_reward_redemptions(company_id, status, created_at DESC);

-- Atualiza company_id em redemptions antigas onde estiver nulo
UPDATE public.organic_reward_redemptions r
SET company_id = rew.company_id
FROM public.organic_campaign_rewards rew
WHERE r.reward_id = rew.id AND r.company_id IS NULL;

-- 3. TABELA DE CONFIGURAÇÃO: organic_benefit_configurations
CREATE TABLE IF NOT EXISTS public.organic_benefit_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL UNIQUE DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  points_per_brl NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  rounding_mode TEXT NOT NULL DEFAULT 'round' CHECK (rounding_mode IN ('ceil','round','floor')),
  media_insertions_per_brl NUMERIC(8,4) NOT NULL DEFAULT 0.5,
  max_granted_insertions INTEGER NOT NULL DEFAULT 5000,
  default_coupon_validity_days INTEGER NOT NULL DEFAULT 7,
  default_points_refund_policy TEXT NOT NULL DEFAULT 'refund_on_expire',
  default_stock_return_policy TEXT NOT NULL DEFAULT 'return_if_active',
  suspicious_price_threshold NUMERIC(12,2) NOT NULL DEFAULT 500.00,
  trusted_company_ids UUID[] NOT NULL DEFAULT '{}',
  require_manual_approval BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organic_benefit_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organic config public read" ON public.organic_benefit_configurations;
CREATE POLICY "Organic config public read" ON public.organic_benefit_configurations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Organic config master modify" ON public.organic_benefit_configurations;
CREATE POLICY "Organic config master modify" ON public.organic_benefit_configurations FOR ALL TO authenticated
  USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());

INSERT INTO public.organic_benefit_configurations (
  version, is_active, points_per_brl, rounding_mode, media_insertions_per_brl,
  max_granted_insertions, suspicious_price_threshold, require_manual_approval
) VALUES (
  1, true, 1.0, 'round', 0.5, 5000, 500.00, true
) ON CONFLICT (version) DO NOTHING;

-- 4. TABELA DE DIREITO DE DIVULGAÇÃO: organic_benefit_media_entitlements
-- Guarda o entitlement de mídia da empresa originado pela contribuição aprovada.
-- NUNCA lança na carteira/wallets e NUNCA gera Crédito MPM.
CREATE TABLE IF NOT EXISTS public.organic_benefit_media_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES public.organic_campaign_rewards(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  approved_promotional_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  granted_insertions INTEGER NOT NULL DEFAULT 0,
  executed_insertions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'expired')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organic_entitlements_company ON public.organic_benefit_media_entitlements(company_id, status);
CREATE INDEX IF NOT EXISTS idx_organic_entitlements_reward ON public.organic_benefit_media_entitlements(reward_id);

ALTER TABLE public.organic_benefit_media_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organic entitlements company read" ON public.organic_benefit_media_entitlements;
CREATE POLICY "Organic entitlements company read" ON public.organic_benefit_media_entitlements FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_user_admin_company_ids()) OR public.is_master_admin());
DROP POLICY IF EXISTS "Organic entitlements master modify" ON public.organic_benefit_media_entitlements;
CREATE POLICY "Organic entitlements master modify" ON public.organic_benefit_media_entitlements FOR ALL TO authenticated
  USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());

-- 5. RLS HARDENING: organic_reward_redemptions
-- Permite que a empresa dona do benefício enxergue os cupons emitidos para seus prêmios
DROP POLICY IF EXISTS organic_redemptions_own ON public.organic_reward_redemptions;
DROP POLICY IF EXISTS organic_redemptions_read ON public.organic_reward_redemptions;
CREATE POLICY organic_redemptions_read ON public.organic_reward_redemptions FOR SELECT TO authenticated
  USING (
    participant_id IN (SELECT id FROM public.organic_participants WHERE user_id = auth.uid())
    OR company_id IN (SELECT public.get_user_admin_company_ids())
    OR reward_id IN (SELECT id FROM public.organic_campaign_rewards WHERE company_id IN (SELECT public.get_user_admin_company_ids()))
    OR public.is_master_admin()
  );

-- 6. RPC: Cálculo determinístico de termos de benefícios
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
BEGIN
  SELECT * INTO v_cfg FROM public.organic_benefit_configurations WHERE is_active = true ORDER BY version DESC LIMIT 1;
  IF v_cfg.id IS NULL THEN
    v_cfg.points_per_brl := 1.0;
    v_cfg.rounding_mode := 'round';
    v_cfg.media_insertions_per_brl := 0.5;
    v_cfg.max_granted_insertions := 5000;
  END IF;

  v_pts := p_unit_value * v_cfg.points_per_brl;
  IF v_cfg.rounding_mode = 'ceil' THEN
    v_pts := CEIL(v_pts);
  ELSIF v_cfg.rounding_mode = 'floor' THEN
    v_pts := FLOOR(v_pts);
  ELSE
    v_pts := ROUND(v_pts);
  END IF;
  IF v_pts < 1 THEN v_pts := 1; END IF;

  v_promo_val := ROUND(p_unit_value * GREATEST(1, p_quantity), 2);
  v_insertions := LEAST(v_cfg.max_granted_insertions, GREATEST(1, ROUND(v_promo_val * v_cfg.media_insertions_per_brl)::INTEGER));

  RETURN jsonb_build_object(
    'suggested_points', v_pts,
    'promotional_value', v_promo_val,
    'granted_insertions', v_insertions,
    'points_per_brl', v_cfg.points_per_brl,
    'rounding_mode', v_cfg.rounding_mode,
    'media_insertions_per_brl', v_cfg.media_insertions_per_brl
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_organic_benefit_terms(NUMERIC, INTEGER) TO authenticated;

-- 7. RPC: Cadastro/Edição de benefício pela Empresa com proteção de preço
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
    v_cfg.media_insertions_per_brl := 0.5;
    v_cfg.max_granted_insertions := 5000;
    v_cfg.suspicious_price_threshold := 500.00;
    v_cfg.trusted_company_ids := '{}';
    v_cfg.require_manual_approval := true;
  END IF;

  v_terms := public.calculate_organic_benefit_terms(p_announced_unit_value, p_quantity);
  v_pts := (v_terms->>'suggested_points')::NUMERIC;
  v_promo_val := (v_terms->>'promotional_value')::NUMERIC;
  v_insertions := (v_terms->>'granted_insertions')::INTEGER;

  IF p_announced_unit_value > v_cfg.suspicious_price_threshold THEN
    v_is_suspicious := true;
  END IF;

  IF p_company_id = ANY(v_cfg.trusted_company_ids) THEN
    v_is_trusted := true;
  END IF;

  -- Se for confiável e não for preço suspeito e configuração não exigir aprovação manual, auto-aprova
  IF (v_is_trusted AND NOT v_is_suspicious AND NOT v_cfg.require_manual_approval) OR public.is_master_admin() THEN
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

  -- Se auto-aprovado, gera entitlement de mídia
  IF v_status = 'active' THEN
    INSERT INTO public.organic_benefit_media_entitlements (
      reward_id, company_id, approved_promotional_value, granted_insertions, status, starts_at, expires_at
    ) VALUES (
      v_res_id, p_company_id, v_promo_val, v_insertions, 'active', NOW(), p_expires_at
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_res_id,
    'status', v_status,
    'suggested_points', v_pts,
    'promotional_value', v_promo_val,
    'is_suspicious', v_is_suspicious
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_or_update_organic_benefit(UUID,UUID,TEXT,TEXT,TEXT,TEXT,NUMERIC,INTEGER,INTEGER,TEXT[],INTEGER[],TIME,TIME,NUMERIC,INTEGER,TIMESTAMPTZ,UUID,TEXT) TO authenticated;

-- 8. RPC: Aprovação e ajuste de valor pelo Master Admin
CREATE OR REPLACE FUNCTION public.approve_organic_benefit(
  p_reward_id UUID,
  p_approved_unit_value NUMERIC,
  p_status TEXT,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward RECORD;
  v_terms JSONB;
  v_pts NUMERIC;
  v_promo_val NUMERIC;
  v_insertions INTEGER;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Apenas administradores Master podem aprovar ou ajustar benefícios.';
  END IF;

  IF p_status NOT IN ('active', 'rejected', 'paused') THEN
    RAISE EXCEPTION 'Status inválido para aprovação.';
  END IF;

  SELECT * INTO v_reward FROM public.organic_campaign_rewards WHERE id = p_reward_id FOR UPDATE;
  IF v_reward.id IS NULL THEN RAISE EXCEPTION 'Benefício não encontrado.'; END IF;

  v_terms := public.calculate_organic_benefit_terms(p_approved_unit_value, v_reward.quantity_total);
  v_pts := (v_terms->>'suggested_points')::NUMERIC;
  v_promo_val := (v_terms->>'promotional_value')::NUMERIC;
  v_insertions := (v_terms->>'granted_insertions')::INTEGER;

  UPDATE public.organic_campaign_rewards SET
    approved_unit_value = p_approved_unit_value,
    approved_promotional_value = v_promo_val,
    credits_required = v_pts,
    credit_budget = v_pts * v_reward.quantity_total,
    status = p_status,
    approved_by = auth.uid(),
    approved_at = NOW(),
    review_notes = p_review_notes,
    updated_at = NOW()
  WHERE id = p_reward_id;

  IF p_status = 'active' THEN
    -- Cria ou atualiza entitlement de mídia (Sem tocar em carteira/wallets e sem criar Crédito MPM)
    INSERT INTO public.organic_benefit_media_entitlements (
      reward_id, company_id, approved_promotional_value, granted_insertions, status, starts_at, expires_at
    ) VALUES (
      p_reward_id, v_reward.company_id, v_promo_val, v_insertions, 'active', NOW(), v_reward.expires_at
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'reward_id', p_reward_id,
    'status', p_status,
    'approved_unit_value', p_approved_unit_value,
    'approved_promotional_value', v_promo_val,
    'credits_required', v_pts,
    'granted_insertions', v_insertions
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_organic_benefit(UUID,NUMERIC,TEXT,TEXT) TO authenticated;

-- 9. RPC: Resgate atômico com locking, limite por usuário e cupom nominal
CREATE OR REPLACE FUNCTION public.reserve_organic_coupon(p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
  v_reward RECORD;
  v_redemption UUID;
  v_user_count INTEGER := 0;
  v_coupon_code TEXT;
  v_qr_token TEXT;
  v_hash TEXT;
  v_suffix TEXT;
  v_expires_at TIMESTAMPTZ;
  v_chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes BYTEA;
  i INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;

  -- 1. Lock do participante
  SELECT * INTO v_participant FROM public.organic_participants
  WHERE user_id = auth.uid() AND status = 'active'
  FOR UPDATE;
  IF v_participant.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Participante orgânico não cadastrado ou inativo.');
  END IF;

  -- 2. Lock do benefício
  SELECT * INTO v_reward FROM public.organic_campaign_rewards
  WHERE id = p_reward_id
  FOR UPDATE;
  IF v_reward.id IS NULL OR v_reward.status != 'active' OR v_reward.expires_at <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Benefício indisponível ou expirado.');
  END IF;

  -- 3. Validação de estoque concorrente
  IF v_reward.quantity_available <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estoque esgotado para este benefício.');
  END IF;

  -- 4. Validação de saldo de microcréditos
  IF v_participant.available_balance < v_reward.credits_required THEN
    RETURN jsonb_build_object('success', false, 'error', 'Microcréditos insuficientes para resgate.');
  END IF;

  -- 5. Validação de limite por usuário
  SELECT COUNT(*) INTO v_user_count
  FROM public.organic_reward_redemptions
  WHERE reward_id = v_reward.id AND participant_id = v_participant.id AND status IN ('reserved', 'redeemed');
  IF v_user_count >= COALESCE(v_reward.max_per_user, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Limite de resgates atingido por usuário para este benefício.');
  END IF;

  -- 6. Geração de código humano e token opaco único
  v_bytes := gen_random_bytes(6);
  v_coupon_code := '';
  FOR i IN 0..5 LOOP
    v_coupon_code := v_coupon_code || substr(v_chars, (get_byte(v_bytes, i) % length(v_chars)) + 1, 1);
  END LOOP;
  v_qr_token := encode(gen_random_bytes(20), 'hex');
  v_hash := encode(digest(v_coupon_code, 'sha256'), 'hex');
  v_suffix := right(v_coupon_code, 4);

  -- Validade do cupom: menor entre validade da campanha e coupon_validity_days após emissão
  v_expires_at := LEAST(v_reward.expires_at, NOW() + (COALESCE(v_reward.coupon_validity_days, 7) || ' days')::INTERVAL);

  -- 7. Atualização atômica de saldos e estoque
  UPDATE public.organic_participants
  SET available_balance = available_balance - v_reward.credits_required, updated_at = NOW()
  WHERE id = v_participant.id;

  UPDATE public.organic_campaign_rewards
  SET quantity_available = quantity_available - 1,
      quantity_reserved = quantity_reserved + 1,
      updated_at = NOW()
  WHERE id = v_reward.id;

  -- 8. Inserção da reserva / cupom nominal
  INSERT INTO public.organic_reward_redemptions (
    reward_id, company_id, participant_id, credits_reserved,
    redemption_code_hash, redemption_code_suffix, coupon_code, qr_token,
    participant_display_name, status, reserved_at, expires_at
  ) VALUES (
    v_reward.id, v_reward.company_id, v_participant.id, v_reward.credits_required,
    v_hash, v_suffix, v_coupon_code, v_qr_token,
    v_participant.display_name, 'reserved', NOW(), v_expires_at
  ) RETURNING id INTO v_redemption;

  -- 9. Registro no Ledger de microcréditos orgânicos
  INSERT INTO public.organic_credit_ledger (
    participant_id, reward_id, type, amount, balance_bucket, description, metadata
  ) VALUES (
    v_participant.id, v_reward.id, 'reservation', -v_reward.credits_required, 'available',
    'Reserva de cupom de benefício', jsonb_build_object('redemption_id', v_redemption, 'coupon_code', v_coupon_code)
  );

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption,
    'coupon_code', v_coupon_code,
    'qr_token', v_qr_token,
    'expires_at', v_expires_at,
    'title', v_reward.title,
    'participant_name', v_participant.display_name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reserve_organic_coupon(UUID) TO authenticated;

-- 10. RPC: Baixa e validação de cupom pelo estabelecimento (idempotente, anti-dupla-baixa)
CREATE OR REPLACE FUNCTION public.validate_and_redeem_coupon(
  p_code_or_token TEXT,
  p_location_unit TEXT DEFAULT NULL,
  p_validation_method TEXT DEFAULT 'code',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption RECORD;
  v_reward RECORD;
  v_dow INTEGER;
  v_now_time TIME;
  v_search TEXT;
  v_hash TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  v_search := upper(trim(COALESCE(p_code_or_token, '')));
  IF length(v_search) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código ou token inválido.');
  END IF;

  v_hash := encode(digest(v_search, 'sha256'), 'hex');

  -- Lock da redenção
  SELECT r.* INTO v_redemption
  FROM public.organic_reward_redemptions r
  WHERE (
    r.coupon_code = v_search
    OR r.qr_token = trim(p_code_or_token)
    OR r.redemption_code_hash = v_hash
  )
  FOR UPDATE;

  IF v_redemption.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cupom não encontrado.');
  END IF;

  -- Validação de estado e dupla baixa
  IF v_redemption.status = 'redeemed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cupom já foi utilizado em ' || to_char(v_redemption.redeemed_at, 'DD/MM/YYYY HH24:MI') || '.');
  END IF;
  IF v_redemption.status = 'expired' OR v_redemption.expires_at <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cupom expirado.');
  END IF;
  IF v_redemption.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cupom cancelado.');
  END IF;

  -- Lock do benefício
  SELECT * INTO v_reward FROM public.organic_campaign_rewards WHERE id = v_redemption.reward_id FOR UPDATE;
  IF v_reward.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Benefício associado não encontrado.');
  END IF;

  -- Verificação de autorização: Apenas administradores da empresa dona do benefício ou Master
  IF NOT (public.is_master_admin() OR v_reward.company_id IN (SELECT public.get_user_admin_company_ids())) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado: este cupom pertence a outro estabelecimento.');
  END IF;

  -- Validação de dias da semana
  v_dow := extract(dow from now())::INTEGER;
  IF NOT (v_dow = ANY(v_reward.allowed_weekdays)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cupom não é válido para utilização no dia de hoje.');
  END IF;

  -- Validação de horário
  v_now_time := now()::time;
  IF v_reward.allowed_time_start IS NOT NULL AND v_reward.allowed_time_end IS NOT NULL THEN
    IF v_now_time < v_reward.allowed_time_start OR v_now_time > v_reward.allowed_time_end THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Horário de utilização não permitido: válido entre ' || v_reward.allowed_time_start::text || ' e ' || v_reward.allowed_time_end::text || '.'
      );
    END IF;
  END IF;

  -- Validação de unidade se configurado
  IF array_length(v_reward.unit_locations, 1) > 0 AND p_location_unit IS NOT NULL AND trim(p_location_unit) != '' THEN
    IF NOT (trim(p_location_unit) = ANY(v_reward.unit_locations)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unidade não participante desta campanha.');
    END IF;
  END IF;

  -- Baixa no cupom (atômica e idempotente)
  UPDATE public.organic_reward_redemptions SET
    status = 'redeemed',
    redeemed_at = NOW(),
    validated_by = auth.uid(),
    location_unit = COALESCE(p_location_unit, location_unit),
    validation_method = COALESCE(p_validation_method, 'code'),
    validation_notes = p_notes
  WHERE id = v_redemption.id AND status = 'reserved';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Falha na baixa concorrente: cupom já processado.');
  END IF;

  -- Atualiza estoque do benefício
  UPDATE public.organic_campaign_rewards SET
    quantity_reserved = GREATEST(0, quantity_reserved - 1),
    quantity_redeemed = quantity_redeemed + 1,
    updated_at = NOW()
  WHERE id = v_reward.id;

  -- Registra no ledger de microcréditos
  INSERT INTO public.organic_credit_ledger (
    participant_id, reward_id, type, amount, balance_bucket, description, metadata
  ) VALUES (
    v_redemption.participant_id, v_reward.id, 'redemption', -v_redemption.credits_reserved, 'reserved',
    'Baixa e utilização de benefício', jsonb_build_object('redemption_id', v_redemption.id, 'coupon_code', v_redemption.coupon_code)
  );

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption.id,
    'coupon_code', v_redemption.coupon_code,
    'participant_name', v_redemption.participant_display_name,
    'title', v_reward.title,
    'redeemed_at', NOW()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.validate_and_redeem_coupon(TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- 11. RPC: Cancelamento de cupom com estorno condicional de pontos e estoque
CREATE OR REPLACE FUNCTION public.cancel_organic_coupon(p_redemption_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption RECORD;
  v_reward RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;

  SELECT * INTO v_redemption FROM public.organic_reward_redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF v_redemption.id IS NULL OR v_redemption.status != 'reserved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas cupons reservados e aguardando uso podem ser cancelados.');
  END IF;

  SELECT * INTO v_reward FROM public.organic_campaign_rewards WHERE id = v_redemption.reward_id FOR UPDATE;
  IF NOT (public.is_master_admin() OR v_reward.company_id IN (SELECT public.get_user_admin_company_ids())) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado.');
  END IF;

  UPDATE public.organic_reward_redemptions SET
    status = 'cancelled',
    cancelled_by = auth.uid(),
    cancelled_at = NOW(),
    cancellation_reason = p_reason
  WHERE id = v_redemption.id;

  -- Estorno de pontos se a política permitir (default 'refund_on_expire')
  IF COALESCE(v_reward.points_refund_policy, 'refund_on_expire') = 'refund_on_expire' THEN
    UPDATE public.organic_participants SET
      available_balance = available_balance + v_redemption.credits_reserved,
      updated_at = NOW()
    WHERE id = v_redemption.participant_id;

    INSERT INTO public.organic_credit_ledger (
      participant_id, reward_id, type, amount, balance_bucket, description, metadata
    ) VALUES (
      v_redemption.participant_id, v_reward.id, 'refund', v_redemption.credits_reserved, 'available',
      'Estorno de pontos por cupom cancelado', jsonb_build_object('redemption_id', v_redemption.id, 'reason', p_reason)
    );
  END IF;

  -- Retorno de estoque SOMENTE se campanha estiver ativa e válida
  IF COALESCE(v_reward.stock_return_policy, 'return_if_active') = 'return_if_active'
     AND v_reward.status = 'active'
     AND v_reward.expires_at > NOW() THEN
    UPDATE public.organic_campaign_rewards SET
      quantity_reserved = GREATEST(0, quantity_reserved - 1),
      quantity_available = quantity_available + 1,
      updated_at = NOW()
    WHERE id = v_reward.id;
  ELSE
    UPDATE public.organic_campaign_rewards SET
      quantity_reserved = GREATEST(0, quantity_reserved - 1),
      updated_at = NOW()
    WHERE id = v_reward.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'redemption_id', p_redemption_id, 'status', 'cancelled');
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_organic_coupon(UUID,TEXT) TO authenticated;

-- 12. ATUALIZAÇÃO DO CRON: expire_organic_redemptions
-- Campanha vencida NÃO retorna estoque disponível. Pontos devolvidos via ledger.
CREATE OR REPLACE FUNCTION public.expire_organic_redemptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_reward RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT r.id, r.participant_id, r.reward_id, r.credits_reserved, r.coupon_code
    FROM public.organic_reward_redemptions r
    WHERE r.status = 'reserved' AND r.expires_at <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO v_reward FROM public.organic_campaign_rewards WHERE id = v_row.reward_id FOR UPDATE;

    UPDATE public.organic_reward_redemptions
      SET status = 'expired'
      WHERE id = v_row.id AND status = 'reserved';

    IF FOUND THEN
      -- 1. Devolução de pontos conforme política (default: refund_on_expire)
      IF COALESCE(v_reward.points_refund_policy, 'refund_on_expire') = 'refund_on_expire' THEN
        UPDATE public.organic_participants
          SET available_balance = available_balance + v_row.credits_reserved, updated_at = NOW()
          WHERE id = v_row.participant_id;

        INSERT INTO public.organic_credit_ledger(participant_id, reward_id, type, amount, balance_bucket, description, metadata)
        VALUES(v_row.participant_id, v_row.reward_id, 'refund', v_row.credits_reserved, 'available',
               'Estorno automático de cupom expirado', jsonb_build_object('redemption_id', v_row.id, 'coupon_code', v_row.coupon_code));
      END IF;

      -- 2. Retorno ao estoque: SOMENTE SE política permitir E recompensa estiver ativa E campanha não estiver vencida
      IF COALESCE(v_reward.stock_return_policy, 'return_if_active') = 'return_if_active'
         AND v_reward.status = 'active'
         AND v_reward.expires_at > NOW() THEN
        UPDATE public.organic_campaign_rewards
          SET quantity_reserved = GREATEST(0, quantity_reserved - 1),
              quantity_available = quantity_available + 1,
              updated_at = NOW()
          WHERE id = v_row.reward_id;
      ELSE
        -- Campanha vencida NÃO retorna estoque disponível
        UPDATE public.organic_campaign_rewards
          SET quantity_reserved = GREATEST(0, quantity_reserved - 1),
              updated_at = NOW()
          WHERE id = v_row.reward_id;
      END IF;

      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_organic_redemptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_organic_redemptions() TO service_role;

-- -- 13. SEED DE ARTIGOS NO HELP CENTER (11 artigos solicitados)
INSERT INTO public.help_articles (slug, audience, title, objective, expected_result, steps, display_order) VALUES
  ('como-cadastrar-beneficio', 'company', 'Como cadastrar um benefício', 'Cadastrar produto ou serviço na Rede Orgânica para atrair novos clientes.', 'Benefício registrado com estoque e cálculo automático de pontos.', to_jsonb(ARRAY['Acesse o menu Benefícios & Prêmios', 'Clique na aba Cadastrar Benefício', 'Informe título, descrição, valor anunciado e quantidade de estoque', 'Defina os dias e horários permitidos para uso', 'Clique em Salvar para enviar para aprovação']), 50),
  ('como-funciona-pontuacao', 'company', 'Como funciona a pontuação', 'Entender como os pontos dos participantes são calculados.', 'Preço anunciado é convertido em pontos pela regra configurada pelo Master.', to_jsonb(ARRAY['O valor unitário aprovado é multiplicado pelo fator de conversão da rede', 'Por padrão, cada R$ 1,00 equivale a 1 ponto orgânico', 'O participante acumula esses pontos mantendo telas ativas']), 51),
  ('como-ganho-divulgacao-oferecendo-premio', 'company', 'Como ganho divulgação oferecendo um prêmio', 'Compreender o cálculo de contribuição promocional e direitos de divulgação.', 'Valor total do estoque gera quota de inserções na rede parceira sem envolver dinheiro ou Crédito MPM.', to_jsonb(ARRAY['O sistema calcula: Valor Unitário Aprovado × Quantidade Total', 'Esse montante vira Direito de Divulgação Orgânica', 'Sua empresa ganha inserções proporcionais em telas parceiras']), 52),
  ('como-validar-cupom', 'company', 'Como validar um cupom', 'Dar baixa segura e nominal no cupom apresentado pelo cliente no estabelecimento.', 'Baixa confirmada, visita registrada e bloqueio de reutilização.', to_jsonb(ARRAY['Abra a aba Cupons & Resgates no painel da empresa', 'Escaneie o QR Code do cliente ou digite o código de 6 caracteres', 'Verifique o nome do cliente e as regras de horário', 'Clique no botão Validar e Dar Baixa']), 53),
  ('como-funciona-estoque', 'company', 'Como funciona o estoque', 'Acompanhar estoque disponível, reservado e resgatado.', 'Controle visual e em tempo real sem overbooking.', to_jsonb(ARRAY['Estoque Disponível: unidades que ainda podem ser resgatadas', 'Estoque Reservado: cupons emitidos aguardando visita do cliente', 'Estoque Utilizado: visitas já confirmadas e baixadas']), 54),
  ('como-acompanhar-visitas', 'company', 'Como acompanhar visitas', 'Medir conversão real de cupons em visitas presenciais.', 'Dashboard de Divulgação Gerada atualizado com métricas reais de conversão.', to_jsonb(ARRAY['Acesse a aba Divulgação Gerada', 'Analise o total de cupons emitidos versus cupons utilizados', 'Acompanhe a taxa de conversão resgate → visita']), 55),
  ('como-resgatar-premio', 'organic', 'Como resgatar um prêmio', 'Trocar microcréditos acumulados por brindes e benefícios de estabelecimentos locais.', 'Cupom emitido com código e QR Code exclusivo.', to_jsonb(ARRAY['Acesse Prêmios Orgânicos no seu menu', 'Escolha o benefício desejado de acordo com seu saldo disponível', 'Verifique os dias e horários de utilização', 'Clique em Resgatar e confirme']), 60),
  ('onde-encontro-meu-cupom', 'organic', 'Onde encontro meu cupom', 'Localizar os cupons já emitidos para apresentar na loja.', 'Visualização imediata do cupom com código legível e QR Code.', to_jsonb(ARRAY['Acesse a seção Meus Cupons na página de Prêmios Orgânicos', 'Localize o cupom com status Aguardando Utilização', 'Apresente a tela do celular com o QR Code para o atendente']), 61),
  ('quando-meus-pontos-voltam', 'organic', 'Quando meus pontos voltam', 'Saber como funciona o estorno em caso de expiração sem uso.', 'Microcréditos devolvidos integralmente para o saldo disponível via ledger.', to_jsonb(ARRAY['Se você não utilizar o cupom antes da data limite, ele expirará', 'A rotina automática realiza o estorno dos pontos para seu saldo', 'Você poderá usá-los novamente para resgatar outro benefício']), 62),
  ('meu-cupom-expirou', 'organic', 'Meu cupom expirou', 'Entender o que ocorre quando a validade de 7 dias termina.', 'Cupom marcado como expirado e pontos estornados de acordo com a política.', to_jsonb(ARRAY['Cada cupom possui um prazo determinado após a emissão', 'Após a data e horário limite, o cupom não pode mais ser aceito no estabelecimento', 'Verifique seu saldo para confirmar o estorno dos pontos']), 63),
  ('onde-posso-usar-o-beneficio', 'organic', 'Onde posso usar o benefício', 'Identificar os endereços e unidades participantes.', 'Lista clara de unidades e cidades no detalhe do cupom.', to_jsonb(ARRAY['Abra os detalhes do seu cupom', 'Consulte a seção Unidades Participantes', 'Observe as regras de dias da semana (ex.: terça a quinta) e horários']), 64)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  objective = EXCLUDED.objective,
  expected_result = EXCLUDED.expected_result,
  steps = EXCLUDED.steps,
  display_order = EXCLUDED.display_order;
