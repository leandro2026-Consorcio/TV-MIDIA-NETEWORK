-- ETAPA 4 MPM: Rede Orgânica V2 - Pontos, Progresso, Prêmios, Bônus (0-95%), Missões e Validação de Caixa
-- Adendo Obrigatório Incorporado:
-- 1. Segregação: Não converter 0,01 em 319.600 exibições residenciais. Referência residencial própria (R$ 0,05/exibição).
-- 2. 0,05 Ponto do Participante é recompensa independente da referência comercial.
-- 3. Caminho canônico de pontuação no ledger orgânico com idempotência estrita (proof_id) e timezone local da tela.
-- 4. Bônus total máximo server-side limitado a 95% (organic_reward_max_promotional_progress).
-- 5. Missão "follow_profile" default DESATIVADA (organic_follow_profile_mission_enabled = false).
-- 6. Progresso e bônus NÃO reservam estoque. Reserva exclusiva no resgate atômico.
-- 7. Prêmio esgotado não afeta Pontos da Rede acumulados.
-- 8. Privacidade por tamanho de grupo: bairros residenciais com menos de 3 telas são agregados.

-- 1. EXTENSÃO: organic_campaign_rewards
ALTER TABLE public.organic_campaign_rewards
  ADD COLUMN IF NOT EXISTS bonus_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_scope TEXT NOT NULL DEFAULT 'first_redemption_campaign',
  ADD COLUMN IF NOT EXISTS target_visits INTEGER,
  ADD COLUMN IF NOT EXISTS primary_goal TEXT NOT NULL DEFAULT 'visits',
  ADD COLUMN IF NOT EXISTS visits_confirmed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_reached_at TIMESTAMPTZ;

ALTER TABLE public.organic_campaign_rewards DROP CONSTRAINT IF EXISTS organic_campaign_rewards_bonus_check;
ALTER TABLE public.organic_campaign_rewards ADD CONSTRAINT organic_campaign_rewards_bonus_check
  CHECK (bonus_percentage >= 0 AND bonus_percentage <= 95.0);

ALTER TABLE public.organic_campaign_rewards DROP CONSTRAINT IF EXISTS organic_campaign_rewards_bonus_scope_check;
ALTER TABLE public.organic_campaign_rewards ADD CONSTRAINT organic_campaign_rewards_bonus_scope_check
  CHECK (bonus_scope IN ('first_redemption_campaign', 'first_redemption_company'));

ALTER TABLE public.organic_campaign_rewards DROP CONSTRAINT IF EXISTS organic_campaign_rewards_primary_goal_check;
ALTER TABLE public.organic_campaign_rewards ADD CONSTRAINT organic_campaign_rewards_primary_goal_check
  CHECK (primary_goal IN ('insertions', 'visits', 'exhaust_stock'));

-- 2. EXTENSÃO: organic_benefit_configurations (Com referências e grandezas segregadas)
ALTER TABLE public.organic_benefit_configurations
  ADD COLUMN IF NOT EXISTS organic_residential_delivery_reference NUMERIC(8,4) NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS organic_points_per_validated_display NUMERIC(8,4) NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS organic_reward_max_promotional_progress NUMERIC(5,2) NOT NULL DEFAULT 95.0,
  ADD COLUMN IF NOT EXISTS minimum_residential_privacy_group_size INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS organic_follow_profile_mission_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS organic_day_start TIME NOT NULL DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS organic_day_end TIME NOT NULL DEFAULT '23:59',
  ADD COLUMN IF NOT EXISTS organic_night_points_weight NUMERIC(8,4) NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS organic_referral_points NUMERIC(8,2) NOT NULL DEFAULT 30.0,
  ADD COLUMN IF NOT EXISTS max_promotional_bonus_percent NUMERIC(5,2) NOT NULL DEFAULT 95.0,
  ADD COLUMN IF NOT EXISTS expected_reward_visit_conversion_rate NUMERIC(5,2) NOT NULL DEFAULT 0.70;

UPDATE public.organic_benefit_configurations
SET organic_residential_delivery_reference = 0.05,
    organic_points_per_validated_display = 0.05,
    organic_reward_max_promotional_progress = 95.0,
    minimum_residential_privacy_group_size = 3,
    organic_follow_profile_mission_enabled = false,
    organic_day_start = '06:00',
    organic_day_end = '23:59',
    organic_night_points_weight = 0.0,
    organic_referral_points = 30.0,
    max_promotional_bonus_percent = 95.0,
    expected_reward_visit_conversion_rate = 0.70;

-- 3. ATUALIZAÇÃO DA RPC calculate_organic_benefit_terms COM REFERÊNCIA RESIDENCIAL PRÓPRIA
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
  v_commercial_insertions INTEGER;
  v_residential_insertions INTEGER;
  v_unit_cost NUMERIC;
  v_res_ref NUMERIC;
BEGIN
  SELECT * INTO v_cfg FROM public.organic_benefit_configurations WHERE is_active = true ORDER BY version DESC LIMIT 1;
  IF v_cfg.id IS NULL THEN
    v_cfg.points_per_brl := 1.0;
    v_cfg.rounding_mode := 'round';
    v_cfg.commercial_insertion_unit_cost := 0.25;
    v_cfg.organic_residential_delivery_reference := 0.05;
    v_cfg.max_granted_insertions := 50000;
  END IF;

  -- 1. PONTOS BASE DO PARTICIPANTE (Unitário - quantidade não multiplica a exigência individual)
  v_pts := p_unit_value * COALESCE(v_cfg.points_per_brl, 1.0);
  IF v_cfg.rounding_mode = 'ceil' THEN
    v_pts := CEIL(v_pts);
  ELSIF v_cfg.rounding_mode = 'floor' THEN
    v_pts := FLOOR(v_pts);
  ELSE
    v_pts := ROUND(v_pts);
  END IF;
  IF v_pts < 1 THEN v_pts := 1; END IF;

  -- 2. CONTRIBUIÇÃO PROMOCIONAL TOTAL (valor aprovado x quantidade)
  v_promo_val := ROUND(p_unit_value * GREATEST(1, p_quantity), 2);

  -- 3. UNIDADES COMERCIAIS EQUIVALENTES (Referência R$ 0,25)
  v_unit_cost := COALESCE(v_cfg.commercial_insertion_unit_cost, 0.25);
  v_commercial_insertions := ROUND(v_promo_val / GREATEST(0.01, v_unit_cost))::INTEGER;
  v_commercial_insertions := LEAST(COALESCE(v_cfg.max_granted_insertions, 50000), GREATEST(1, v_commercial_insertions));

  -- 4. REFERÊNCIA RESIDENCIAL PRÓPRIA (R$ 0,05 por exibição - NÃO dividir 3.196 por 0,01!)
  v_res_ref := COALESCE(v_cfg.organic_residential_delivery_reference, 0.05);
  v_residential_insertions := ROUND(v_promo_val / GREATEST(0.01, v_res_ref))::INTEGER;

  RETURN jsonb_build_object(
    'suggested_points', v_pts,
    'promotional_value', v_promo_val,
    'granted_insertions', v_commercial_insertions,
    'commercial_insertion_unit_cost', v_unit_cost,
    'organic_residential_delivery_reference', v_res_ref,
    'estimated_residential_insertions', v_residential_insertions,
    'commercial_tv_weight', 1.00,
    'windows_monitor_weight', 0.10,
    'residential_screen_weight', 0.01,
    'points_per_brl', v_cfg.points_per_brl,
    'rounding_mode', v_cfg.rounding_mode
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_organic_benefit_terms(NUMERIC, INTEGER) TO authenticated, anon, service_role;

-- 4. TABELA DE MISSÕES PROMOCIONAIS: organic_reward_missions
CREATE TABLE IF NOT EXISTS public.organic_reward_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES public.organic_campaign_rewards(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('story', 'feed_reel', 'share', 'survey', 'custom', 'follow_profile')),
  title TEXT NOT NULL,
  description TEXT,
  reward_bonus_percentage NUMERIC(5,2) NOT NULL CHECK (reward_bonus_percentage > 0 AND reward_bonus_percentage <= 95.0),
  max_per_participant INTEGER NOT NULL DEFAULT 1 CHECK (max_per_participant >= 1),
  requires_proof BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missions_reward ON public.organic_reward_missions(reward_id, is_active);
CREATE INDEX IF NOT EXISTS idx_missions_company ON public.organic_reward_missions(company_id);

ALTER TABLE public.organic_reward_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active missions" ON public.organic_reward_missions;
CREATE POLICY "Public read active missions" ON public.organic_reward_missions FOR SELECT TO authenticated
  USING (is_active = true OR company_id IN (SELECT public.get_user_admin_company_ids()) OR public.is_master_admin());

DROP POLICY IF EXISTS "Company admin manage missions" ON public.organic_reward_missions;
CREATE POLICY "Company admin manage missions" ON public.organic_reward_missions FOR ALL TO authenticated
  USING (company_id IN (SELECT public.get_user_admin_company_ids()) OR public.is_master_admin())
  WITH CHECK (company_id IN (SELECT public.get_user_admin_company_ids()) OR public.is_master_admin());

-- 5. TABELA DE COMPROVAÇÕES DE MISSÕES: organic_participant_mission_completions
CREATE TABLE IF NOT EXISTS public.organic_participant_mission_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.organic_reward_missions(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.organic_campaign_rewards(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.organic_participants(id) ON DELETE CASCADE,
  proof_type TEXT NOT NULL CHECK (proof_type IN ('link', 'image_url', 'text')),
  proof_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  bonus_percentage_applied NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mission_completions_status ON public.organic_participant_mission_completions(participant_id, reward_id, status);
CREATE INDEX IF NOT EXISTS idx_mission_completions_reward ON public.organic_participant_mission_completions(reward_id, status);

ALTER TABLE public.organic_participant_mission_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participant view own mission completions" ON public.organic_participant_mission_completions;
CREATE POLICY "Participant view own mission completions" ON public.organic_participant_mission_completions FOR SELECT TO authenticated
  USING (participant_id IN (SELECT id FROM public.organic_participants WHERE user_id = auth.uid()) OR public.is_master_admin() OR reward_id IN (SELECT id FROM public.organic_campaign_rewards WHERE company_id IN (SELECT public.get_user_admin_company_ids())));

DROP POLICY IF EXISTS "Participant submit mission proof" ON public.organic_participant_mission_completions;
CREATE POLICY "Participant submit mission proof" ON public.organic_participant_mission_completions FOR INSERT TO authenticated
  WITH CHECK (participant_id IN (SELECT id FROM public.organic_participants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Company review mission completions" ON public.organic_participant_mission_completions;
CREATE POLICY "Company review mission completions" ON public.organic_participant_mission_completions FOR UPDATE TO authenticated
  USING (reward_id IN (SELECT id FROM public.organic_campaign_rewards WHERE company_id IN (SELECT public.get_user_admin_company_ids())) OR public.is_master_admin());

-- 6. TABELA DE OBJETIVO MARCADO: organic_participant_pinned_rewards ("Meu Próximo Prêmio")
-- Observação crucial: Marcar como próximo prêmio NUNCA reserva estoque!
CREATE TABLE IF NOT EXISTS public.organic_participant_pinned_rewards (
  participant_id UUID PRIMARY KEY REFERENCES public.organic_participants(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.organic_campaign_rewards(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organic_participant_pinned_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participant manage own pinned reward" ON public.organic_participant_pinned_rewards;
CREATE POLICY "Participant manage own pinned reward" ON public.organic_participant_pinned_rewards FOR ALL TO authenticated
  USING (participant_id IN (SELECT id FROM public.organic_participants WHERE user_id = auth.uid()))
  WITH CHECK (participant_id IN (SELECT id FROM public.organic_participants WHERE user_id = auth.uid()));

-- 7. TABELAS DE ACESSO DO CAIXA: company_cashier_access e company_cashier_devices
CREATE TABLE IF NOT EXISTS public.company_cashier_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  establishment_code TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  qr_access_token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_cashier_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  device_fingerprint_hash TEXT NOT NULL,
  device_name TEXT,
  session_token_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashier_devices_token ON public.company_cashier_devices(session_token_hash) WHERE is_revoked = false;

ALTER TABLE public.company_cashier_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company manage cashier access" ON public.company_cashier_access;
CREATE POLICY "Company manage cashier access" ON public.company_cashier_access FOR ALL TO authenticated
  USING (company_id IN (SELECT public.get_user_admin_company_ids()) OR public.is_master_admin())
  WITH CHECK (company_id IN (SELECT public.get_user_admin_company_ids()) OR public.is_master_admin());

ALTER TABLE public.company_cashier_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company manage cashier devices" ON public.company_cashier_devices;
CREATE POLICY "Company manage cashier devices" ON public.company_cashier_devices FOR ALL TO authenticated
  USING (company_id IN (SELECT public.get_user_admin_company_ids()) OR public.is_master_admin())
  WITH CHECK (company_id IN (SELECT public.get_user_admin_company_ids()) OR public.is_master_admin());

-- 8. ATUALIZAÇÃO DA RPC reserve_organic_coupon (Com teto de 95% e reserva atômica de estoque)
CREATE OR REPLACE FUNCTION public.reserve_organic_coupon(p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
  v_reward RECORD;
  v_cfg RECORD;
  v_user_count INTEGER;
  v_coupon_code TEXT;
  v_qr_token TEXT;
  v_hash TEXT;
  v_suffix TEXT;
  v_expires_at TIMESTAMPTZ;
  v_redemption UUID;
  v_bytes BYTEA;
  v_chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_mission_bonus NUMERIC := 0;
  v_total_bonus NUMERIC := 0;
  v_net_credits NUMERIC := 0;
  v_base_bonus NUMERIC := 0;
  v_max_progress NUMERIC := 95.0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado.');
  END IF;

  SELECT * INTO v_participant FROM public.organic_participants WHERE user_id = auth.uid() FOR UPDATE;
  IF v_participant.id IS NULL OR v_participant.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Participante orgânico não encontrado ou inativo.');
  END IF;

  SELECT * INTO v_reward FROM public.organic_campaign_rewards WHERE id = p_reward_id FOR UPDATE;
  IF v_reward.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Benefício não encontrado.');
  END IF;

  IF v_reward.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Benefício não está ativo para resgates.');
  END IF;

  IF v_reward.expires_at <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este benefício já expirou.');
  END IF;

  -- Controle rigoroso de concorrência: se o estoque for 0, rejeita imediatamente
  IF v_reward.quantity_available <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este prêmio acabou de esgotar.');
  END IF;

  SELECT * INTO v_cfg FROM public.organic_benefit_configurations WHERE is_active = true ORDER BY version DESC LIMIT 1;
  v_max_progress := COALESCE(v_cfg.organic_reward_max_promotional_progress, 95.0);

  -- 1. Bônus promocional específico do prêmio (base + missões aprovadas, com teto server-side estrito)
  v_base_bonus := COALESCE(v_reward.bonus_percentage, 0);

  SELECT COALESCE(SUM(bonus_percentage_applied), 0) INTO v_mission_bonus
  FROM public.organic_participant_mission_completions
  WHERE reward_id = v_reward.id AND participant_id = v_participant.id AND status = 'approved';

  v_total_bonus := LEAST(v_max_progress, v_base_bonus + v_mission_bonus);

  -- 2. Requisito líquido de Pontos da Rede
  IF v_total_bonus > 0 THEN
    v_net_credits := GREATEST(1, ROUND(v_reward.credits_required * (1.0 - (v_total_bonus / 100.0))));
  ELSE
    v_net_credits := v_reward.credits_required;
  END IF;

  -- 3. Validação de saldo de Pontos da Rede do participante
  IF v_participant.available_balance < v_net_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pontos da Rede insuficientes para resgate. Você precisa de ' || v_net_credits::text || ' pontos.'
    );
  END IF;

  -- 4. Validação de limite por usuário
  SELECT COUNT(*) INTO v_user_count
  FROM public.organic_reward_redemptions
  WHERE reward_id = v_reward.id AND participant_id = v_participant.id AND status IN ('reserved', 'redeemed');
  IF v_user_count >= COALESCE(v_reward.max_per_user, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Limite de resgates atingido por participante para este prêmio.');
  END IF;

  -- 5. Geração de código legível e token opaco
  v_bytes := gen_random_bytes(6);
  v_coupon_code := '';
  FOR i IN 0..5 LOOP
    v_coupon_code := v_coupon_code || substr(v_chars, (get_byte(v_bytes, i) % length(v_chars)) + 1, 1);
  END LOOP;
  v_qr_token := encode(gen_random_bytes(20), 'hex');
  v_hash := encode(digest(v_coupon_code, 'sha256'), 'hex');
  v_suffix := right(v_coupon_code, 4);

  v_expires_at := LEAST(v_reward.expires_at, NOW() + (COALESCE(v_reward.coupon_validity_days, 7) || ' days')::INTERVAL);

  -- 6. Atualização atômica: debita APENAS os pontos líquidos necessários
  UPDATE public.organic_participants
  SET available_balance = available_balance - v_net_credits, updated_at = NOW()
  WHERE id = v_participant.id;

  -- Consumo e reserva atômica de estoque
  UPDATE public.organic_campaign_rewards
  SET quantity_available = quantity_available - 1,
      quantity_reserved = quantity_reserved + 1,
      updated_at = NOW()
  WHERE id = v_reward.id;

  -- 7. Inserção do cupom
  INSERT INTO public.organic_reward_redemptions (
    reward_id, company_id, participant_id, credits_reserved,
    redemption_code_hash, redemption_code_suffix, coupon_code, qr_token,
    participant_display_name, status, reserved_at, expires_at
  ) VALUES (
    v_reward.id, v_reward.company_id, v_participant.id, v_net_credits,
    v_hash, v_suffix, v_coupon_code, v_qr_token,
    v_participant.display_name, 'reserved', NOW(), v_expires_at
  ) RETURNING id INTO v_redemption;

  -- 8. Registro no Ledger orgânico (imutável)
  INSERT INTO public.organic_credit_ledger (
    participant_id, reward_id, type, amount, balance_bucket, description, metadata
  ) VALUES (
    v_participant.id, v_reward.id, 'reservation', -v_net_credits, 'available',
    'Resgate de cupom: ' || v_reward.title,
    jsonb_build_object(
      'redemption_id', v_redemption,
      'coupon_code', v_coupon_code,
      'base_credits', v_reward.credits_required,
      'bonus_percentage', v_total_bonus,
      'net_credits_debited', v_net_credits
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption,
    'coupon_code', v_coupon_code,
    'qr_token', v_qr_token,
    'expires_at', v_expires_at,
    'title', v_reward.title,
    'participant_name', v_participant.display_name,
    'net_credits_debited', v_net_credits,
    'bonus_applied_percent', v_total_bonus
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reserve_organic_coupon(UUID) TO authenticated;

-- 9. ATUALIZAÇÃO DA RPC validate_and_redeem_coupon (Suporte a Caixa e Visita Confirmada)
CREATE OR REPLACE FUNCTION public.validate_and_redeem_coupon(
  p_code_or_token TEXT,
  p_location_unit TEXT DEFAULT NULL,
  p_validation_method TEXT DEFAULT 'code',
  p_notes TEXT DEFAULT NULL,
  p_cashier_company_id UUID DEFAULT NULL
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
  v_goal_reached BOOLEAN := false;
BEGIN
  v_search := upper(trim(COALESCE(p_code_or_token, '')));
  IF length(v_search) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código ou token de cupom inválido.');
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

  -- Prevenção de dupla baixa
  IF v_redemption.status = 'redeemed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cupom já foi utilizado em ' || to_char(v_redemption.redeemed_at, 'DD/MM/YYYY HH24:MI') || '.'
    );
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

  -- Permissão: Caixa autorizado da Empresa OU Administrador Logado
  IF p_cashier_company_id IS NOT NULL THEN
    IF v_reward.company_id != p_cashier_company_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este cupom pertence a outro estabelecimento.');
    END IF;
  ELSE
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado.');
    END IF;
    IF NOT (public.is_master_admin() OR v_reward.company_id IN (SELECT public.get_user_admin_company_ids())) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este cupom pertence a outro estabelecimento.');
    END IF;
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
      RETURN jsonb_build_object('success', false, 'error', 'Este benefício não é válido nesta unidade.');
    END IF;
  END IF;

  -- Baixa no cupom (atômica e idempotente)
  UPDATE public.organic_reward_redemptions SET
    status = 'redeemed',
    redeemed_at = NOW(),
    validated_by = COALESCE(auth.uid(), v_redemption.validated_by),
    location_unit = COALESCE(p_location_unit, location_unit),
    validation_method = COALESCE(p_validation_method, 'code'),
    validation_notes = p_notes
  WHERE id = v_redemption.id AND status = 'reserved';

  -- Atualização do estoque e contador de Visita Confirmada
  UPDATE public.organic_campaign_rewards SET
    quantity_reserved = GREATEST(0, quantity_reserved - 1),
    quantity_redeemed = quantity_redeemed + 1,
    visits_confirmed = visits_confirmed + 1,
    updated_at = NOW()
  WHERE id = v_reward.id;

  -- Checagem de Meta 100% de Visitas
  IF v_reward.target_visits IS NOT NULL AND (v_reward.visits_confirmed + 1) >= v_reward.target_visits AND v_reward.goal_reached_at IS NULL THEN
    UPDATE public.organic_campaign_rewards SET goal_reached_at = NOW() WHERE id = v_reward.id;
    v_goal_reached := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Visita confirmada com sucesso.',
    'redemption_id', v_redemption.id,
    'coupon_code', v_redemption.coupon_code,
    'participant_name', v_redemption.participant_display_name,
    'reward_title', v_reward.title,
    'visits_confirmed', v_reward.visits_confirmed + 1,
    'target_visits', v_reward.target_visits,
    'goal_reached', v_goal_reached
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.validate_and_redeem_coupon(TEXT,TEXT,TEXT,TEXT,UUID) TO authenticated, anon, service_role;

-- 10. CAMINHO CANÔNICO DE PONTUAÇÃO (Com idempotência estrita via proof_id e timezone local)
CREATE OR REPLACE FUNCTION public.process_organic_screen_display_points(
  p_screen_id UUID,
  p_proof_id TEXT,
  p_played_at TIMESTAMPTZ DEFAULT NOW(),
  p_client_timezone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_screen RECORD;
  v_cfg RECORD;
  v_tz TEXT;
  v_local_time TIME;
  v_points NUMERIC := 0;
  v_eligible BOOLEAN := false;
  v_existing INTEGER := 0;
BEGIN
  -- Idempotência estrita: verificar se este Comprovante de Exibição já pontuou
  IF p_proof_id IS NOT NULL AND trim(p_proof_id) != '' THEN
    SELECT COUNT(*) INTO v_existing
    FROM public.organic_credit_ledger
    WHERE type = 'playback'
      AND (metadata->>'proof_id') = trim(p_proof_id);

    IF v_existing > 0 THEN
      RETURN jsonb_build_object(
        'success', true,
        'duplicate', true,
        'points_awarded', 0,
        'message', 'Comprovante já processado anteriormente.'
      );
    END IF;
  END IF;

  SELECT s.*, p.id AS part_id, p.status AS part_status, p.city AS part_city
  INTO v_screen
  FROM public.organic_screens s
  JOIN public.organic_participants p ON p.id = s.participant_id
  WHERE s.id = p_screen_id;

  IF v_screen.id IS NULL OR v_screen.part_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tela ou participante inativo.');
  END IF;

  SELECT * INTO v_cfg FROM public.organic_benefit_configurations WHERE is_active = true ORDER BY version DESC LIMIT 1;

  -- Timezone local da tela/participante (evita usar UTC do servidor)
  v_tz := COALESCE(p_client_timezone, 'America/Cuiaba');
  BEGIN
    v_local_time := (p_played_at AT TIME ZONE v_tz)::TIME;
  EXCEPTION WHEN OTHERS THEN
    v_local_time := (p_played_at AT TIME ZONE 'America/Cuiaba')::TIME;
  END;

  -- Faixa horária:
  -- 06:00 até 23:59: normal (default 0.05 Pontos da Rede)
  -- 00:00 até 05:59: peso zero por padrão (default 0.0 Pontos da Rede)
  IF v_local_time >= COALESCE(v_cfg.organic_day_start, '06:00'::time) AND v_local_time <= COALESCE(v_cfg.organic_day_end, '23:59:59'::time) THEN
    v_points := COALESCE(v_cfg.organic_points_per_validated_display, 0.05);
    v_eligible := true;
  ELSE
    v_points := COALESCE(v_cfg.organic_night_points_weight, 0.0);
    v_eligible := false;
  END IF;

  -- Lançamento imutável no ledger
  IF v_points > 0 THEN
    UPDATE public.organic_participants
    SET available_balance = available_balance + v_points,
        total_earned = total_earned + v_points,
        updated_at = NOW()
    WHERE id = v_screen.part_id;

    INSERT INTO public.organic_credit_ledger (
      participant_id, screen_id, type, amount, balance_bucket, description, metadata
    ) VALUES (
      v_screen.part_id, v_screen.id, 'playback', v_points, 'available',
      'Exibição Validada na tela ' || v_screen.name,
      jsonb_build_object(
        'proof_id', p_proof_id,
        'played_at', p_played_at,
        'local_time', v_local_time::text,
        'timezone', v_tz,
        'screen_type', v_screen.device_type,
        'points_awarded', v_points
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'points_awarded', v_points,
    'is_daytime_eligible', v_eligible,
    'local_time', v_local_time::text,
    'timezone', v_tz
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.process_organic_screen_display_points(UUID,TEXT,TIMESTAMPTZ,TEXT) TO authenticated, anon, service_role;

-- 11. RPC PARA BÔNUS DE INDICAÇÃO DE EMPRESA (+30 Pontos da Rede)
CREATE OR REPLACE FUNCTION public.credit_organic_referral_points(
  p_participant_id UUID,
  p_referred_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
  v_cfg RECORD;
  v_points NUMERIC := 30.0;
  v_existing INTEGER;
BEGIN
  SELECT * INTO v_participant FROM public.organic_participants WHERE id = p_participant_id FOR UPDATE;
  IF v_participant.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Participante não encontrado.');
  END IF;

  -- Prevenção de duplicidade: não pontuar duas vezes pela mesma empresa indicada
  SELECT COUNT(*) INTO v_existing
  FROM public.organic_credit_ledger
  WHERE participant_id = p_participant_id
    AND type = 'referral'
    AND (metadata->>'referred_company_id') = p_referred_company_id::text;

  IF v_existing > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indicação já pontuada anteriormente.');
  END IF;

  SELECT * INTO v_cfg FROM public.organic_benefit_configurations WHERE is_active = true ORDER BY version DESC LIMIT 1;
  v_points := COALESCE(v_cfg.organic_referral_points, 30.0);

  UPDATE public.organic_participants
  SET available_balance = available_balance + v_points,
      total_earned = total_earned + v_points,
      updated_at = NOW()
  WHERE id = v_participant.id;

  INSERT INTO public.organic_credit_ledger (
    participant_id, type, amount, balance_bucket, description, metadata
  ) VALUES (
    v_participant.id, 'referral', v_points, 'available',
    'Bônus por indicação de empresa cliente',
    jsonb_build_object('referred_company_id', p_referred_company_id, 'points', v_points)
  );

  RETURN jsonb_build_object(
    'success', true,
    'points_awarded', v_points,
    'new_balance', v_participant.available_balance + v_points
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.credit_organic_referral_points(UUID,UUID) TO authenticated, service_role;

-- 12. RPC: ONDE MINHA PUBLICIDADE ESTÁ PASSANDO (Privacidade por tamanho de grupo >= 3)
CREATE OR REPLACE FUNCTION public.get_ad_distribution_report(
  p_company_id UUID,
  p_campaign_id UUID DEFAULT NULL,
  p_reward_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commercial JSONB;
  v_residential JSONB;
  v_summary JSONB;
  v_total_validated BIGINT := 0;
  v_commercial_tv_count INTEGER := 0;
  v_windows_monitor_count INTEGER := 0;
  v_residential_screen_count INTEGER := 0;
  v_cfg RECORD;
  v_min_privacy_size INTEGER := 3;
BEGIN
  SELECT * INTO v_cfg FROM public.organic_benefit_configurations WHERE is_active = true ORDER BY version DESC LIMIT 1;
  v_min_privacy_size := COALESCE(v_cfg.minimum_residential_privacy_group_size, 3);

  -- Telas comerciais
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'establishment_name', COALESCE(c.trade_name, 'Estabelecimento Comercial'),
      'city', COALESCE(c.city, 'Sinop'),
      'neighborhood', COALESCE(c.neighborhood, 'Centro'),
      'address', COALESCE(c.address, 'Endereço Comercial'),
      'screen_type', s.device_type,
      'screen_name', s.name,
      'validated_displays', COUNT(l.id),
      'last_display_at', MAX(l.created_at)
    )
  ), '[]'::jsonb)
  INTO v_commercial
  FROM public.playback_logs l
  JOIN public.screens s ON s.id = l.screen_id
  JOIN public.companies c ON c.id = s.company_id
  WHERE (p_campaign_id IS NULL OR l.campaign_id = p_campaign_id)
    AND (s.venue_type != 'residential' OR s.venue_type IS NULL)
  GROUP BY c.trade_name, c.city, c.neighborhood, c.address, s.device_type, s.name;

  -- Telas residenciais: PRIVACIDADE RIGOROSA (Bairros com menos de 3 telas são mascarados como 'Região Residencial Agrupada')
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'city', sub.city,
      'neighborhood', CASE WHEN sub.screen_count >= v_min_privacy_size THEN sub.neighborhood ELSE 'Região Residencial Agrupada' END,
      'screen_count', sub.screen_count,
      'validated_displays', sub.val_displays,
      'last_display_at', sub.last_disp
    )
  ), '[]'::jsonb)
  INTO v_residential
  FROM (
    SELECT
      COALESCE(p.city, 'Sinop/MT') as city,
      COALESCE(p.state, 'Residencial') as neighborhood,
      COUNT(DISTINCT s.id) as screen_count,
      COUNT(l.id) as val_displays,
      MAX(l.created_at) as last_disp
    FROM public.organic_screens s
    JOIN public.organic_participants p ON p.id = s.participant_id
    LEFT JOIN public.playback_logs l ON l.screen_id = s.id AND (p_campaign_id IS NULL OR l.campaign_id = p_campaign_id)
    GROUP BY p.city, p.state
  ) sub;

  SELECT COUNT(*) INTO v_commercial_tv_count FROM public.screens WHERE venue_type = 'commercial';
  SELECT COUNT(*) INTO v_windows_monitor_count FROM public.screens WHERE device_type = 'windows_monitor' AND venue_type = 'commercial';
  SELECT COUNT(*) INTO v_residential_screen_count FROM public.organic_screens;

  v_summary := jsonb_build_object(
    'commercial_screens', jsonb_array_length(v_commercial),
    'commercial_tvs', v_commercial_tv_count,
    'windows_monitors', v_windows_monitor_count,
    'residential_screens', v_residential_screen_count,
    'minimum_privacy_group_size', v_min_privacy_size,
    'total_validated_displays', v_total_validated
  );

  RETURN jsonb_build_object(
    'summary', v_summary,
    'commercial_points', v_commercial,
    'residential_aggregated', v_residential
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_ad_distribution_report(UUID,UUID,UUID) TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
