-- ============================================================================
-- FASE 6C: ONBOARDING PUBLICO, TRIAL DE 60 DIAS E CONVITES VIP
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('public_trial_signup_enabled', 'true'::jsonb, 'Habilita o cadastro empresarial publico com trial.'),
  ('public_trial_days', '60'::jsonb, 'Quantidade de dias concedidos no trial publico.'),
  ('trial_invites_count', '3'::jsonb, 'Quantidade de convites VIP iniciais por empresa.'),
  ('auto_approve_trial_internal_media', 'true'::jsonb, 'Aprova automaticamente midia interna propria durante o trial.'),
  ('public_signup_disabled_message', '"Novos cadastros estao temporariamente indisponiveis. Fale com nosso atendimento."'::jsonb, 'Mensagem exibida quando o cadastro publico estiver desativado.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PlatformSettings - Public read" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Public read"
  ON public.platform_settings FOR SELECT TO anon, authenticated
  USING (key IN (
    'public_trial_signup_enabled',
    'public_trial_days',
    'trial_invites_count',
    'auto_approve_trial_internal_media',
    'public_signup_disabled_message'
  ));

DROP POLICY IF EXISTS "PlatformSettings - Master manage" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Master manage"
  ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

ALTER TABLE public.company_trials
  ADD COLUMN IF NOT EXISTS trial_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS free_days INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.referral_invites
  ADD COLUMN IF NOT EXISTS invited_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trial_days_granted INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS trial_internal_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.protect_public_onboarding_marker()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF OLD.public_onboarding_completed_at IS NOT NULL
     AND NEW.public_onboarding_completed_at IS DISTINCT FROM OLD.public_onboarding_completed_at
     AND auth.role() <> 'service_role'
     AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'O marcador de onboarding público não pode ser removido.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_public_onboarding_marker ON public.profiles;
CREATE TRIGGER trg_protect_public_onboarding_marker
  BEFORE UPDATE OF public_onboarding_completed_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_public_onboarding_marker();

CREATE OR REPLACE FUNCTION public.enforce_trial_media_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_trial RECORD;
  v_auto_approve BOOLEAN := FALSE;
BEGIN
  IF auth.role() = 'service_role' OR public.is_master_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.trial_internal_only AND NOT NEW.trial_internal_only THEN
      RAISE EXCEPTION 'A restrição de uso interno da mídia só pode ser removida pelo Master Admin.';
    END IF;
  END IF;

  SELECT status, trial_end_date INTO v_trial
  FROM public.company_trials
  WHERE company_id = NEW.company_id AND status IN ('active', 'expired', 'cancelled')
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_trial.status = 'active' AND v_trial.trial_end_date >= CURRENT_DATE AND NOT COALESCE(NEW.is_external, FALSE) THEN
    SELECT COALESCE((value #>> '{}')::BOOLEAN, FALSE) INTO v_auto_approve
    FROM public.platform_settings WHERE key = 'auto_approve_trial_internal_media';
    NEW.status := CASE WHEN v_auto_approve THEN 'approved' ELSE 'pending_review' END;
    NEW.trial_internal_only := v_auto_approve;
  ELSE
    NEW.status := 'pending_review';
    NEW.trial_internal_only := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_trial_media_approval ON public.media_assets;
CREATE TRIGGER trg_enforce_trial_media_approval
  BEFORE INSERT OR UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trial_media_approval();

ALTER TABLE public.referral_invites ALTER COLUMN invited_company_name DROP NOT NULL;
ALTER TABLE public.referral_invites DROP CONSTRAINT IF EXISTS referral_invites_status_check;
ALTER TABLE public.referral_invites
  ADD CONSTRAINT referral_invites_status_check
  CHECK (status IN ('available', 'created', 'sent', 'accepted', 'expired', 'converted', 'cancelled'));

-- Substitui a regra antiga, que exigia plano convertido e impedia os convites
-- iniciais do trial. O limite e conferido no banco, inclusive contra concorrencia.
CREATE OR REPLACE FUNCTION public.check_referral_invite_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite_count INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT COALESCE((value #>> '{}')::INTEGER, 3)
    INTO v_limit
  FROM public.platform_settings
  WHERE key = 'trial_invites_count';

  v_limit := GREATEST(1, LEAST(COALESCE(v_limit, 3), 10));

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.inviter_company_id::TEXT, 0));

  SELECT COUNT(*) INTO v_invite_count
  FROM public.referral_invites
  WHERE inviter_company_id = NEW.inviter_company_id
    AND status <> 'cancelled';

  IF v_invite_count >= v_limit THEN
    RAISE EXCEPTION 'Limite de % convites VIP atingido para esta empresa.', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_referral_invite_limit ON public.referral_invites;
CREATE TRIGGER trg_check_referral_invite_limit
  BEFORE INSERT ON public.referral_invites
  FOR EACH ROW EXECUTE FUNCTION public.check_referral_invite_limit();

-- Mídia autoaprovada no trial pode rodar em playlists e campanhas internas,
-- mas não pode ser promovida para pedidos comerciais, marketplace ou rede.
CREATE OR REPLACE FUNCTION public.enforce_trial_internal_media_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_internal_only BOOLEAN;
  v_campaign_type TEXT;
BEGIN
  IF TG_TABLE_NAME = 'ad_offer_orders' AND NEW.requested_media_asset_id IS NOT NULL THEN
    SELECT trial_internal_only INTO v_internal_only
    FROM public.media_assets WHERE id = NEW.requested_media_asset_id;
    IF COALESCE(v_internal_only, FALSE) THEN
      RAISE EXCEPTION 'Mídia autoaprovada para uso interno não pode ser usada no marketplace.';
    END IF;
  ELSIF TG_TABLE_NAME = 'campaign_media' THEN
    SELECT m.trial_internal_only, c.campaign_type
      INTO v_internal_only, v_campaign_type
    FROM public.media_assets m
    CROSS JOIN public.campaigns c
    WHERE m.id = NEW.media_asset_id AND c.id = NEW.campaign_id;
    IF COALESCE(v_internal_only, FALSE) AND COALESCE(v_campaign_type, '') <> 'internal' THEN
      RAISE EXCEPTION 'Mídia autoaprovada no trial é exclusiva para campanhas internas.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_trial_media_marketplace ON public.ad_offer_orders;
CREATE TRIGGER trg_block_trial_media_marketplace
  BEFORE INSERT OR UPDATE OF requested_media_asset_id ON public.ad_offer_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trial_internal_media_scope();

DROP TRIGGER IF EXISTS trg_block_trial_media_commercial_campaign ON public.campaign_media;
CREATE TRIGGER trg_block_trial_media_commercial_campaign
  BEFORE INSERT OR UPDATE OF media_asset_id, campaign_id ON public.campaign_media
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trial_internal_media_scope();

CREATE OR REPLACE FUNCTION public.complete_public_company_onboarding(
  p_user_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_trade_name TEXT,
  p_corporate_name TEXT,
  p_cnpj TEXT,
  p_city TEXT,
  p_state TEXT,
  p_segment_id UUID,
  p_invite_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_days INTEGER;
  v_invite_limit INTEGER;
  v_company_id UUID;
  v_trial_id UUID;
  v_invite public.referral_invites%ROWTYPE;
  v_code TEXT;
  v_i INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Operacao permitida somente ao servico de onboarding.';
  END IF;

  SELECT COALESCE((value #>> '{}')::BOOLEAN, FALSE) INTO v_enabled
  FROM public.platform_settings WHERE key = 'public_trial_signup_enabled';

  IF NOT COALESCE(v_enabled, FALSE) THEN
    RAISE EXCEPTION 'PUBLIC_SIGNUP_DISABLED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuario de autenticacao nao encontrado.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND public_onboarding_completed_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.company_users WHERE user_id = p_user_id
  ) THEN
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (p_user_id, 'PUBLIC_ONBOARDING_SECOND_COMPANY_BLOCKED', jsonb_build_object('origin', 'phase6c'));
    RAISE EXCEPTION 'USER_ALREADY_HAS_COMPANY';
  END IF;

  IF p_invite_code IS NOT NULL AND btrim(p_invite_code) <> '' THEN
    SELECT * INTO v_invite
    FROM public.referral_invites
    WHERE invite_code = upper(btrim(p_invite_code))
    FOR UPDATE;

    IF NOT FOUND OR v_invite.status NOT IN ('available', 'created', 'sent') THEN
      RAISE EXCEPTION 'INVALID_INVITE';
    END IF;
    IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= NOW() THEN
      UPDATE public.referral_invites SET status = 'expired', updated_at = NOW() WHERE id = v_invite.id;
      RAISE EXCEPTION 'EXPIRED_INVITE';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.segments WHERE id = p_segment_id) THEN
    RAISE EXCEPTION 'Segmento invalido.';
  END IF;

  SELECT GREATEST(1, LEAST(COALESCE((value #>> '{}')::INTEGER, 60), 365)) INTO v_days
  FROM public.platform_settings WHERE key = 'public_trial_days';
  SELECT GREATEST(1, LEAST(COALESCE((value #>> '{}')::INTEGER, 3), 10)) INTO v_invite_limit
  FROM public.platform_settings WHERE key = 'trial_invites_count';
  v_days := COALESCE(v_days, 60);
  v_invite_limit := COALESCE(v_invite_limit, 3);

  UPDATE public.profiles
  SET full_name = btrim(p_full_name), phone = btrim(p_phone),
      public_onboarding_completed_at = COALESCE(public_onboarding_completed_at, NOW()),
      updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.companies (trade_name, corporate_name, cnpj, city, state)
  VALUES (
    btrim(p_trade_name), NULLIF(btrim(p_corporate_name), ''), NULLIF(regexp_replace(COALESCE(p_cnpj, ''), '\\D', '', 'g'), ''),
    btrim(p_city), upper(btrim(p_state))
  ) RETURNING id INTO v_company_id;

  INSERT INTO public.company_users (company_id, user_id, role, is_active)
  VALUES (v_company_id, p_user_id, 'admin', TRUE);

  INSERT INTO public.company_segments (company_id, segment_id, is_primary)
  VALUES (v_company_id, p_segment_id, TRUE);

  INSERT INTO public.company_trials (
    company_id, trial_start_date, trial_end_date, trial_days, free_days,
    status, trial_type, created_by, metadata
  ) VALUES (
    v_company_id, CURRENT_DATE, CURRENT_DATE + v_days, v_days, v_days,
    'active', CASE WHEN v_invite.id IS NULL THEN 'public_signup' ELSE 'vip_invite' END,
    p_user_id, jsonb_build_object('origin', 'phase6c', 'invite_id', v_invite.id)
  ) RETURNING id INTO v_trial_id;

  FOR v_i IN 1..v_invite_limit LOOP
    LOOP
      v_code := 'VIP-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 10));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_invites WHERE invite_code = v_code);
    END LOOP;

    INSERT INTO public.referral_invites (
      inviter_company_id, invite_code, trial_days, trial_days_granted,
      status, expires_at, created_by, metadata
    ) VALUES (
      v_company_id, v_code, v_days, v_days,
      'available', NOW() + INTERVAL '90 days', p_user_id,
      jsonb_build_object('origin', 'public_onboarding', 'slot', v_i)
    );
  END LOOP;

  IF v_invite.id IS NOT NULL THEN
    UPDATE public.referral_invites
    SET status = 'accepted', invited_company_id = v_company_id,
        invited_company_name = btrim(p_trade_name), accepted_at = NOW(), updated_at = NOW(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('accepted_user_id', p_user_id)
    WHERE id = v_invite.id;
  END IF;

  INSERT INTO public.audit_logs (user_id, company_id, action, details) VALUES
    (p_user_id, v_company_id, 'PUBLIC_COMPANY_CREATED', jsonb_build_object('origin', 'phase6c')),
    (p_user_id, v_company_id, 'PUBLIC_ADMIN_LINK_CREATED', jsonb_build_object('role', 'admin')),
    (p_user_id, v_company_id, 'PUBLIC_TRIAL_CREATED', jsonb_build_object('trial_id', v_trial_id, 'days', v_days, 'type', CASE WHEN v_invite.id IS NULL THEN 'public_signup' ELSE 'vip_invite' END)),
    (p_user_id, v_company_id, 'INITIAL_VIP_INVITES_CREATED', jsonb_build_object('count', v_invite_limit));

  IF v_invite.id IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (p_user_id, v_company_id, 'REFERRAL_INVITE_ACCEPTED', jsonb_build_object('invite_id', v_invite.id, 'inviter_company_id', v_invite.inviter_company_id));
  END IF;

  RETURN jsonb_build_object(
    'company_id', v_company_id,
    'trial_id', v_trial_id,
    'trial_days', v_days,
    'invites_created', v_invite_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_public_company_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_public_company_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;

-- O fluxo publico nao usa mais INSERT direto: toda criacao passa pela funcao
-- transacional acima. O Master continua com acesso administrativo.
DROP POLICY IF EXISTS "Companies - Usuários autenticados criam empresas" ON public.companies;

DROP POLICY IF EXISTS "Companies - Master Admin cria empresas" ON public.companies;
CREATE POLICY "Companies - Master Admin cria empresas"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.is_master_admin());

-- Empresas apenas consultam o proprio trial. Dias, status e tipo so podem ser
-- alterados pelo Master ou pelo servico transacional.
DROP POLICY IF EXISTS "CompanyTrials - Gerenciamento por Admins da Empresa ou Master Admin" ON public.company_trials;
DROP POLICY IF EXISTS "CompanyTrials - Master manage" ON public.company_trials;
CREATE POLICY "CompanyTrials - Master manage"
  ON public.company_trials FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

-- Os tres slots sao criados pelo onboarding. A empresa pode le-los e
-- compartilhar seus links, mas nao fabricar codigos nem elevar os dias.
DROP POLICY IF EXISTS "ReferralInvites - Gerenciamento por Admins da Empresa ou Master Admin" ON public.referral_invites;
DROP POLICY IF EXISTS "ReferralInvites - Master manage" ON public.referral_invites;
CREATE POLICY "ReferralInvites - Master manage"
  ON public.referral_invites FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

REVOKE ALL ON FUNCTION public.enforce_trial_internal_media_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_public_onboarding_marker() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_trial_media_approval() FROM PUBLIC, anon, authenticated;
