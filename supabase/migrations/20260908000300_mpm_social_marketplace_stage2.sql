-- ETAPA 2 MPM: Social Real + Marketplaces + Vitrine Pública + Pricing Dinâmico
-- Aditiva: Preserva integridade de Etapa 1, Core de Inventário, Asaas e Rede Orgânica.

INSERT INTO public.platform_settings(key, value, description) VALUES
  ('social_v2', 'false'::jsonb, 'Integração social ativa somente após homologação e contas reais conectadas.'),
  ('social_auto_publish_master_enabled', 'false'::jsonb, 'Chave master global para autorizar publicações sociais automáticas.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

DROP POLICY IF EXISTS "PlatformSettings - Public read" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Public read" ON public.platform_settings FOR SELECT TO anon, authenticated USING (key IN (
  'public_trial_signup_enabled','public_trial_days','trial_invites_count','auto_approve_trial_internal_media','public_signup_disabled_message',
  'plan_price_monthly_cents','plan_price_annual_cents','media_inventory_v2','inventory_capacity_v2','inventory_allocations_v2',
  'inventory_preferred_limit','inventory_growth_enabled','inventory_v2','wallet_mpm_v2','settlement_v2','matching_v2','partner_programs_v2',
  'social_v2','creator_v2','events_v2','payout_v2','dynamic_pricing_v2','inventory_growth_monthly_limit','mpm_default_unit_price',
  'expansion_program_v1','expansion_public_base_url','social_auto_publish_master_enabled'
));

-- 1. EXTENSÃO: social_channels
ALTER TABLE public.social_channels
  ADD COLUMN IF NOT EXISTS publication_mode TEXT NOT NULL DEFAULT 'approval' CHECK (publication_mode IN ('manual','approval','automatic')),
  ADD COLUMN IF NOT EXISTS feed_publish_capable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reel_publish_capable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS story_publish_capable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insights_capable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metrics_capable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_publications_per_day INTEGER NOT NULL DEFAULT 1 CHECK (max_publications_per_day >= 0),
  ADD COLUMN IF NOT EXISTS min_price_credits NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (min_price_credits >= 0),
  ADD COLUMN IF NOT EXISTS min_lead_time_hours INTEGER NOT NULL DEFAULT 24 CHECK (min_lead_time_hours >= 0),
  ADD COLUMN IF NOT EXISTS min_retention_days INTEGER NOT NULL DEFAULT 30 CHECK (min_retention_days >= 0),
  ADD COLUMN IF NOT EXISTS allowed_hours JSONB NOT NULL DEFAULT '{"start":"08:00","end":"22:00"}'::jsonb,
  ADD COLUMN IF NOT EXISTS show_on_marketplace BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_metrics_publicly BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS diagnostic_status TEXT NOT NULL DEFAULT 'pending' CHECK (diagnostic_status IN ('pending','connected','partial_permission','expired_token','ineligible_account','external_error','ready_for_campaigns','revoked')),
  ADD COLUMN IF NOT EXISTS diagnostic_message TEXT,
  ADD COLUMN IF NOT EXISTS last_diagnosed_at TIMESTAMPTZ;

-- 2. EXTENSÃO: creator_profiles
ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_followers_publicly BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_scores_publicly BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_pricing_publicly BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_direct_campaigns BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'dynamic' CHECK (pricing_mode IN ('dynamic','manual','minimum')),
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_profiles_slug ON public.creator_profiles(slug) WHERE slug IS NOT NULL;

-- 3. EXTENSÃO: companies (Privacidade e Vitrine)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS show_logo_publicly BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_name_publicly BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_location_publicly BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_screen_count_publicly BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_marketplace BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_automatic_campaigns BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_on_map BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS map_privacy_level TEXT NOT NULL DEFAULT 'public' CHECK (map_privacy_level IN ('public','region_only','hidden'));

-- 4. EXTENSÃO: screens (Privacidade e Marketplace de TVs)
ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS is_public_screen BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_on_map BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS venue_type TEXT NOT NULL DEFAULT 'commercial' CHECK (venue_type IN ('commercial','office','retail','gym','clinic','residential','event','other')),
  ADD COLUMN IF NOT EXISTS venue_category TEXT,
  ADD COLUMN IF NOT EXISTS indicative_price_credits NUMERIC(18,4) NOT NULL DEFAULT 0.25 CHECK (indicative_price_credits >= 0),
  ADD COLUMN IF NOT EXISTS public_address_masked TEXT;

-- Proteção de privacidade: telas residenciais nunca são públicas por padrão
UPDATE public.screens SET is_public_screen = false, show_on_map = false, venue_type = 'residential'
WHERE device_type = 'residential' OR venue_type = 'residential';

-- 5. EXTENSÃO: social_publications
ALTER TABLE public.social_publications
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'feed' CHECK (format IN ('feed','reel','story','carousel')),
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  ADD COLUMN IF NOT EXISTS retention_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES public.creator_profiles(id);

-- 6. TABELA: creator_pricing_rules (Dynamic Pricing Engine configurável)
CREATE TABLE IF NOT EXISTS public.creator_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL UNIQUE CHECK (version > 0),
  base_story_credits NUMERIC(18,4) NOT NULL DEFAULT 50.00 CHECK (base_story_credits >= 0),
  base_feed_credits NUMERIC(18,4) NOT NULL DEFAULT 100.00 CHECK (base_feed_credits >= 0),
  base_reel_credits NUMERIC(18,4) NOT NULL DEFAULT 150.00 CHECK (base_reel_credits >= 0),
  base_package_credits NUMERIC(18,4) NOT NULL DEFAULT 250.00 CHECK (base_package_credits >= 0),
  follower_factor_per_10k NUMERIC(9,4) NOT NULL DEFAULT 15.00 CHECK (follower_factor_per_10k >= 0),
  engagement_weight NUMERIC(7,4) NOT NULL DEFAULT 0.25 CHECK (engagement_weight >= 0),
  local_relevance_weight NUMERIC(7,4) NOT NULL DEFAULT 0.35 CHECK (local_relevance_weight >= 0),
  creator_score_weight NUMERIC(7,4) NOT NULL DEFAULT 0.20 CHECK (creator_score_weight >= 0),
  media_value_weight NUMERIC(7,4) NOT NULL DEFAULT 0.20 CHECK (media_value_weight >= 0),
  min_price_credits NUMERIC(18,4) NOT NULL DEFAULT 20.00 CHECK (min_price_credits >= 0),
  max_price_credits NUMERIC(18,4) NOT NULL DEFAULT 10000.00 CHECK (max_price_credits >= min_price_credits),
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

INSERT INTO public.creator_pricing_rules (
  version, base_story_credits, base_feed_credits, base_reel_credits, base_package_credits,
  follower_factor_per_10k, engagement_weight, local_relevance_weight, creator_score_weight,
  media_value_weight, min_price_credits, max_price_credits, is_active
) VALUES (
  1, 50.00, 100.00, 150.00, 250.00, 15.00, 0.25, 0.35, 0.20, 0.20, 20.00, 5000.00, true
) ON CONFLICT (version) DO NOTHING;

ALTER TABLE public.creator_pricing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creator pricing rules read" ON public.creator_pricing_rules;
CREATE POLICY "Creator pricing rules read" ON public.creator_pricing_rules FOR SELECT TO authenticated USING (is_active OR public.is_master_admin());

-- 7. FUNÇÃO: calculate_creator_dynamic_price
CREATE OR REPLACE FUNCTION public.calculate_creator_dynamic_price(
  p_creator_id UUID,
  p_format TEXT DEFAULT 'feed'
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_creator public.creator_profiles%ROWTYPE;
  v_rule public.creator_pricing_rules%ROWTYPE;
  v_snapshot public.creator_metric_snapshots%ROWTYPE;
  v_base NUMERIC(18,4);
  v_followers BIGINT := 0;
  v_engagement NUMERIC(12,6) := 0;
  v_local_rel NUMERIC(7,2) := 0;
  v_creator_score NUMERIC(7,2) := 0;
  v_media_score NUMERIC(7,2) := 0;
  v_calculated NUMERIC(18,4);
  v_final_price NUMERIC(18,4);
BEGIN
  SELECT * INTO v_creator FROM public.creator_profiles WHERE id = p_creator_id;
  IF v_creator.id IS NULL THEN
    RAISE EXCEPTION 'Creator não encontrado.';
  END IF;

  SELECT * INTO v_rule FROM public.creator_pricing_rules
  WHERE is_active AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())
  ORDER BY version DESC LIMIT 1;

  IF v_rule.id IS NULL THEN
    RAISE EXCEPTION 'Regra de precificação de creator não encontrada.';
  END IF;

  SELECT * INTO v_snapshot FROM public.creator_metric_snapshots
  WHERE creator_id = p_creator_id
  ORDER BY captured_at DESC LIMIT 1;

  v_followers := COALESCE(v_snapshot.followers, 0);
  v_engagement := COALESCE(v_snapshot.engagement_rate, 2.5);
  v_local_rel := COALESCE(v_snapshot.local_relevance, 50.0);
  v_creator_score := COALESCE(v_creator.creator_score, 50.0);
  v_media_score := COALESCE(v_creator.media_value_score, 50.0);

  v_base := CASE lower(trim(p_format))
    WHEN 'story' THEN v_rule.base_story_credits
    WHEN 'reel' THEN v_rule.base_reel_credits
    WHEN 'package' THEN v_rule.base_package_credits
    ELSE v_rule.base_feed_credits
  END;

  -- Fórmula estável: Base + Fator de seguidores + Multiplicador ponderado de qualidade/localidade
  v_calculated := v_base
    + ((v_followers / 10000.0) * v_rule.follower_factor_per_10k)
    * (1.0 + (v_engagement / 100.0) * v_rule.engagement_weight
           + (v_local_rel / 100.0) * v_rule.local_relevance_weight
           + (v_creator_score / 100.0) * v_rule.creator_score_weight
           + (v_media_score / 100.0) * v_rule.media_value_weight);

  v_final_price := GREATEST(v_rule.min_price_credits, LEAST(v_rule.max_price_credits, round(v_calculated, 2)));

  RETURN jsonb_build_object(
    'creator_id', v_creator.id,
    'format', p_format,
    'rule_version', v_rule.version,
    'suggested_price_credits', v_final_price,
    'base_price_credits', v_base,
    'factors', jsonb_build_object(
      'followers', v_followers,
      'engagement_rate', v_engagement,
      'local_relevance', v_local_rel,
      'creator_score', v_creator_score,
      'media_value_score', v_media_score
    )
  );
END $$;
GRANT EXECUTE ON FUNCTION public.calculate_creator_dynamic_price(UUID, TEXT) TO authenticated, service_role;

-- 8. FUNÇÃO: set_creator_rate_card (Configuração de preço pelo Creator com congelamento posterior)
CREATE OR REPLACE FUNCTION public.set_creator_rate_card(
  p_creator_id UUID,
  p_social_channel_id UUID,
  p_format TEXT,
  p_price_credits NUMERIC,
  p_turnaround_hours INTEGER DEFAULT 72,
  p_is_active BOOLEAN DEFAULT true
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_creator public.creator_profiles%ROWTYPE;
  v_card_id UUID;
BEGIN
  SELECT * INTO v_creator FROM public.creator_profiles WHERE id = p_creator_id FOR UPDATE;
  IF v_creator.id IS NULL OR NOT public.mpm_can_manage_holder('creator', v_creator.id) THEN
    RAISE EXCEPTION 'Acesso negado ou perfil de creator não encontrado.';
  END IF;

  IF p_price_credits < 0 THEN
    RAISE EXCEPTION 'Preço não pode ser negativo.';
  END IF;

  SELECT id INTO v_card_id FROM public.creator_rate_cards
  WHERE creator_id = p_creator_id AND format = p_format
    AND (p_social_channel_id IS NULL OR social_channel_id = p_social_channel_id)
  LIMIT 1;

  IF v_card_id IS NOT NULL THEN
    UPDATE public.creator_rate_cards
    SET price_credits = p_price_credits,
        turnaround_hours = COALESCE(p_turnaround_hours, 72),
        is_active = p_is_active,
        metadata = jsonb_build_object('updated_at', now(), 'configured_by', auth.uid())
    WHERE id = v_card_id;
  ELSE
    INSERT INTO public.creator_rate_cards (
      creator_id, social_channel_id, format, price_credits, turnaround_hours, is_active, metadata
    ) VALUES (
      p_creator_id, p_social_channel_id, p_format, p_price_credits, COALESCE(p_turnaround_hours, 72), p_is_active,
      jsonb_build_object('created_at', now(), 'configured_by', auth.uid())
    ) RETURNING id INTO v_card_id;
  END IF;

  RETURN v_card_id;
END $$;
GRANT EXECUTE ON FUNCTION public.set_creator_rate_card(UUID, UUID, TEXT, NUMERIC, INTEGER, BOOLEAN) TO authenticated, service_role;

-- 9. FUNÇÃO: quote_creator_media (Cotação com preço congelado)
CREATE OR REPLACE FUNCTION public.quote_creator_media(
  p_buyer_company_id UUID,
  p_creator_id UUID,
  p_format TEXT,
  p_quantity BIGINT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_creator public.creator_profiles%ROWTYPE;
  v_card public.creator_rate_cards%ROWTYPE;
  v_dyn JSONB;
  v_inv public.media_inventory%ROWTYPE;
  v_rule public.media_price_rules%ROWTYPE;
  v_quote_id UUID;
  v_unit_price NUMERIC(18,6);
  v_gross NUMERIC(18,4);
BEGIN
  IF NOT public.mpm_can_manage_company(p_buyer_company_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa compradora.';
  END IF;

  IF p_quantity <= 0 OR p_ends_at < p_starts_at OR NULLIF(trim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Parâmetros de cotação inválidos.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('creator-quote:' || p_idempotency_key, 0));

  SELECT id INTO v_quote_id FROM public.media_price_quotes WHERE idempotency_key = p_idempotency_key;
  IF v_quote_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'deduplicated', true, 'quote_id', v_quote_id);
  END IF;

  SELECT * INTO v_creator FROM public.creator_profiles WHERE id = p_creator_id AND status = 'active';
  IF v_creator.id IS NULL THEN
    RAISE EXCEPTION 'Creator indisponível ou inativo.';
  END IF;

  -- Localiza inventário de canal do creator
  SELECT * INTO v_inv FROM public.media_inventory
  WHERE owner_type = 'creator' AND owner_id = v_creator.id AND status = 'active' AND commercial_enabled
  ORDER BY created_at DESC LIMIT 1;

  -- Se o creator ainda não tiver inventário sincronizado no media_inventory, cria entrada aditiva
  IF v_inv.id IS NULL THEN
    INSERT INTO public.media_inventory (
      owner_type, owner_id, source_type, source_id, channel_family, inventory_type,
      status, proof_method, commercial_enabled, city, state, metadata
    ) VALUES (
      'creator', v_creator.id, 'creator_channel', v_creator.id, 'creator', 'creator_profile',
      'active', 'proof_of_publication', true, v_creator.city, v_creator.state,
      jsonb_build_object('display_name', v_creator.display_name, 'tier', v_creator.tier)
    ) RETURNING * INTO v_inv;
  END IF;

  -- Determina preço: Rate card manual/ativo OU Precificação dinâmica
  SELECT * INTO v_card FROM public.creator_rate_cards
  WHERE creator_id = v_creator.id AND format = p_format AND is_active
  ORDER BY created_at DESC LIMIT 1;

  IF v_card.id IS NOT NULL AND v_creator.pricing_mode IN ('manual', 'minimum') THEN
    v_unit_price := v_card.price_credits;
  ELSE
    v_dyn := public.calculate_creator_dynamic_price(v_creator.id, p_format);
    v_unit_price := (v_dyn->>'suggested_price_credits')::numeric;
    IF v_card.id IS NOT NULL AND v_creator.pricing_mode = 'minimum' AND v_unit_price < v_card.price_credits THEN
      v_unit_price := v_card.price_credits;
    END IF;
  END IF;

  v_gross := round(v_unit_price * p_quantity, 4);

  SELECT * INTO v_rule FROM public.media_price_rules
  WHERE channel_family = 'creator' AND is_active
  ORDER BY priority DESC, version DESC LIMIT 1;

  IF v_rule.id IS NULL THEN
    INSERT INTO public.media_price_rules (
      code, version, channel_family, unit_price_credits, priority, effective_from, metadata
    ) VALUES (
      'creator-default', 1, 'creator', v_unit_price, 1, now(), '{"auto":true}'::jsonb
    ) RETURNING * INTO v_rule;
  END IF;

  INSERT INTO public.media_price_quotes (
    buyer_company_id, inventory_id, price_rule_id, insertion_quantity,
    unit_price_credits, gross_credits, pricing_context, starts_at, ends_at,
    expires_at, idempotency_key
  ) VALUES (
    p_buyer_company_id, v_inv.id, v_rule.id, p_quantity,
    v_unit_price, v_gross,
    jsonb_build_object(
      'creator_id', v_creator.id,
      'creator_name', v_creator.display_name,
      'format', p_format,
      'pricing_mode', v_creator.pricing_mode,
      'rate_card_id', v_card.id,
      'frozen_at', now()
    ),
    p_starts_at, p_ends_at, now() + interval '48 hours', p_idempotency_key
  ) RETURNING id INTO v_quote_id;

  RETURN jsonb_build_object(
    'success', true,
    'quote_id', v_quote_id,
    'unit_price_credits', v_unit_price,
    'gross_credits', v_gross,
    'creator_id', v_creator.id,
    'format', p_format
  );
END $$;
GRANT EXECUTE ON FUNCTION public.quote_creator_media(UUID, UUID, TEXT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

-- 10. FUNÇÃO: submit_social_proof_of_publication (Conexão do Proof com o Settlement)
CREATE OR REPLACE FUNCTION public.submit_social_proof_of_publication(
  p_publication_id UUID,
  p_contract_id UUID,
  p_provider_publication_id TEXT,
  p_evidence JSONB,
  p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_pub public.social_publications%ROWTYPE;
  v_contract public.media_commercial_contracts%ROWTYPE;
  v_settle_res JSONB;
BEGIN
  SELECT * INTO v_pub FROM public.social_publications WHERE id = p_publication_id FOR UPDATE;
  IF v_pub.id IS NULL THEN
    RAISE EXCEPTION 'Publicação social não encontrada.';
  END IF;

  SELECT * INTO v_contract FROM public.media_commercial_contracts WHERE id = p_contract_id;
  IF v_contract.id IS NULL OR v_contract.status <> 'active' THEN
    RAISE EXCEPTION 'Contrato comercial ativo não encontrado.';
  END IF;

  UPDATE public.social_publications
  SET status = 'published',
      provider_publication_id = COALESCE(p_provider_publication_id, v_pub.provider_publication_id),
      published_at = COALESCE(v_pub.published_at, now()),
      proof = COALESCE(p_evidence, '{}'::jsonb)
  WHERE id = v_pub.id;

  v_settle_res := public.record_validated_delivery_proof(
    p_contract_id,
    'social_publication',
    v_pub.id,
    1,
    now(),
    p_evidence,
    p_idempotency_key
  );

  RETURN jsonb_build_object(
    'success', true,
    'publication_id', v_pub.id,
    'settlement', v_settle_res
  );
END $$;
GRANT EXECUTE ON FUNCTION public.submit_social_proof_of_publication(UUID, UUID, TEXT, JSONB, TEXT) TO service_role;

-- 11. FUNÇÃO: get_public_showcase_data (Vitrine dinâmica e segura alimentada pelo banco)
CREATE OR REPLACE FUNCTION public.get_public_showcase_data()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_companies_count BIGINT := 0;
  v_screens_count BIGINT := 0;
  v_cities TEXT[];
  v_companies JSONB;
  v_creators JSONB;
  v_rewards JSONB;
  v_locations JSONB;
BEGIN
  -- Contagens seguras: empresas públicas e telas públicas não residenciais
  SELECT count(*) INTO v_companies_count
  FROM public.companies
  WHERE show_in_marketplace = true;

  SELECT count(*) INTO v_screens_count
  FROM public.screens
  WHERE is_public_screen = true AND show_on_map = true AND status = 'online' AND venue_type <> 'residential';

  SELECT COALESCE(array_agg(DISTINCT city), '{}') INTO v_cities
  FROM public.companies
  WHERE show_location_publicly = true AND city IS NOT NULL;

  -- Empresas participantes opt-in (sem dados sensíveis)
  SELECT jsonb_agg(comp) INTO v_companies
  FROM (
    SELECT c.id,
           CASE WHEN c.show_name_publicly THEN c.trade_name ELSE 'Empresa Parceira' END AS name,
           CASE WHEN c.show_logo_publicly THEN c.logo_url ELSE NULL END AS logo_url,
           CASE WHEN c.show_location_publicly THEN c.city ELSE NULL END AS city,
           CASE WHEN c.show_location_publicly THEN c.state ELSE NULL END AS state,
           CASE WHEN c.show_screen_count_publicly THEN count(s.id) ELSE NULL END AS public_screens_count
    FROM public.companies c
    LEFT JOIN public.screens s ON s.company_id = c.id AND s.is_public_screen = true AND s.venue_type <> 'residential'
    WHERE c.show_in_marketplace = true
    GROUP BY c.id, c.trade_name, c.logo_url, c.city, c.state, c.show_name_publicly, c.show_logo_publicly, c.show_location_publicly, c.show_screen_count_publicly
    ORDER BY c.created_at DESC LIMIT 24
  ) comp;

  -- Creators em destaque opt-in
  SELECT jsonb_agg(cr) INTO v_creators
  FROM (
    SELECT cp.id,
           cp.display_name,
           cp.slug,
           cp.avatar_url,
           cp.city,
           cp.state,
           cp.niches,
           cp.tier,
           CASE WHEN cp.show_followers_publicly THEN COALESCE(ms.followers, 0) ELSE NULL END AS followers,
           CASE WHEN cp.show_scores_publicly THEN cp.creator_score ELSE NULL END AS creator_score,
           CASE WHEN cp.show_scores_publicly THEN cp.media_value_score ELSE NULL END AS media_value_score,
           CASE WHEN cp.show_pricing_publicly THEN (
             SELECT min(price_credits) FROM public.creator_rate_cards WHERE creator_id = cp.id AND is_active
           ) ELSE NULL END AS min_price_credits
    FROM public.creator_profiles cp
    LEFT JOIN LATERAL (
      SELECT followers FROM public.creator_metric_snapshots WHERE creator_id = cp.id ORDER BY captured_at DESC LIMIT 1
    ) ms ON true
    WHERE cp.is_public_profile = true AND cp.status = 'active'
    ORDER BY cp.is_verified DESC, cp.media_value_score DESC, cp.creator_score DESC LIMIT 12
  ) cr;

  -- Benefícios ativos da Rede Orgânica
  SELECT jsonb_agg(rw) INTO v_rewards
  FROM (
    SELECT r.id, r.title, r.description, r.credits_required, r.quantity_available, r.status,
           c.trade_name AS company_name
    FROM public.organic_campaign_rewards r
    JOIN public.companies c ON c.id = r.company_id
    WHERE r.status = 'active' AND (r.expires_at IS NULL OR r.expires_at > now()) AND r.quantity_available > 0
    ORDER BY r.created_at DESC LIMIT 6
  ) rw;

  -- Locais de telas opt-in (nunca expor residenciais)
  SELECT jsonb_agg(loc) INTO v_locations
  FROM (
    SELECT s.id,
           s.name,
           s.venue_type,
           s.venue_category,
           c.trade_name AS company_name,
           c.city,
           c.state,
           s.indicative_price_credits
    FROM public.screens s
    JOIN public.companies c ON c.id = s.company_id
    WHERE s.is_public_screen = true AND s.show_on_map = true AND s.venue_type <> 'residential'
      AND c.show_on_map = true AND c.map_privacy_level <> 'hidden'
    ORDER BY s.created_at DESC LIMIT 30
  ) loc;

  RETURN jsonb_build_object(
    'metrics', jsonb_build_object(
      'total_companies', COALESCE(v_companies_count, 0),
      'total_public_screens', COALESCE(v_screens_count, 0),
      'cities_count', COALESCE(array_length(v_cities, 1), 0),
      'cities', COALESCE(v_cities, '{}')
    ),
    'companies', COALESCE(v_companies, '[]'::jsonb),
    'creators', COALESCE(v_creators, '[]'::jsonb),
    'rewards', COALESCE(v_rewards, '[]'::jsonb),
    'locations', COALESCE(v_locations, '[]'::jsonb)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_public_showcase_data() TO anon, authenticated, service_role;

-- 12. FUNÇÃO: get_creator_public_profile (Perfil público `/creators/[slug]`)
CREATE OR REPLACE FUNCTION public.get_creator_public_profile(p_identifier TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_creator public.creator_profiles%ROWTYPE;
  v_snapshot public.creator_metric_snapshots%ROWTYPE;
  v_channels JSONB;
  v_rate_cards JSONB;
  v_reviews JSONB;
  v_completed_campaigns INTEGER := 0;
BEGIN
  -- Busca por slug ou por UUID
  SELECT * INTO v_creator FROM public.creator_profiles
  WHERE (slug = p_identifier OR id::text = p_identifier) AND is_public_profile = true AND status = 'active';

  IF v_creator.id IS NULL THEN
    RAISE EXCEPTION 'Perfil de creator não encontrado ou privado.';
  END IF;

  SELECT * INTO v_snapshot FROM public.creator_metric_snapshots
  WHERE creator_id = v_creator.id ORDER BY captured_at DESC LIMIT 1;

  -- Canais públicos conectados
  SELECT jsonb_agg(ch) INTO v_channels
  FROM (
    SELECT sc.id, sc.provider, sc.channel_type, sc.display_name,
           sc.feed_publish_capable, sc.reel_publish_capable, sc.story_publish_capable,
           sc.publication_mode
    FROM public.social_channels sc
    WHERE sc.owner_type = 'creator' AND sc.owner_id = v_creator.id AND sc.participation_enabled AND sc.status = 'active'
  ) ch;

  -- Preços / Rate cards públicos
  SELECT jsonb_agg(rc) INTO v_rate_cards
  FROM (
    SELECT format, price_credits, turnaround_hours
    FROM public.creator_rate_cards
    WHERE creator_id = v_creator.id AND is_active
    ORDER BY price_credits ASC
  ) rc;

  -- Avaliações públicas
  SELECT jsonb_agg(rv) INTO v_reviews
  FROM (
    SELECT cr.rating, cr.comment, cr.created_at, c.trade_name AS company_name
    FROM public.creator_reviews cr
    JOIN public.companies c ON c.id = cr.reviewer_company_id
    WHERE cr.creator_id = v_creator.id
    ORDER BY cr.created_at DESC LIMIT 10
  ) rv;

  SELECT count(*) INTO v_completed_campaigns
  FROM public.creator_campaign_offers
  WHERE creator_id = v_creator.id AND status = 'completed';

  RETURN jsonb_build_object(
    'id', v_creator.id,
    'display_name', v_creator.display_name,
    'slug', v_creator.slug,
    'avatar_url', v_creator.avatar_url,
    'bio', v_creator.bio,
    'city', v_creator.city,
    'state', v_creator.state,
    'niches', v_creator.niches,
    'tier', v_creator.tier,
    'is_verified', v_creator.is_verified,
    'metrics', CASE WHEN v_creator.show_followers_publicly THEN jsonb_build_object(
      'followers', COALESCE(v_snapshot.followers, 0),
      'views', COALESCE(v_snapshot.views, 0),
      'engagement_rate', COALESCE(v_snapshot.engagement_rate, 0)
    ) ELSE NULL END,
    'scores', CASE WHEN v_creator.show_scores_publicly THEN jsonb_build_object(
      'creator_score', v_creator.creator_score,
      'media_value_score', v_creator.media_value_score,
      'tier', v_creator.tier
    ) ELSE NULL END,
    'channels', COALESCE(v_channels, '[]'::jsonb),
    'rate_cards', CASE WHEN v_creator.show_pricing_publicly THEN COALESCE(v_rate_cards, '[]'::jsonb) ELSE '[]'::jsonb END,
    'reviews', COALESCE(v_reviews, '[]'::jsonb),
    'completed_campaigns', v_completed_campaigns
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_creator_public_profile(TEXT) TO anon, authenticated, service_role;

-- 13. POLÍTICAS RLS ADICIONAIS: Leitura pública e Marketplace
DROP POLICY IF EXISTS "Creator public read" ON public.creator_profiles;
CREATE POLICY "Creator public read" ON public.creator_profiles FOR SELECT TO anon, authenticated
  USING (is_public_profile = true AND status = 'active');

DROP POLICY IF EXISTS "Creator rate cards public read" ON public.creator_rate_cards;
CREATE POLICY "Creator rate cards public read" ON public.creator_rate_cards FOR SELECT TO anon, authenticated
  USING (is_active = true AND creator_id IN (SELECT id FROM public.creator_profiles WHERE is_public_profile = true AND status = 'active'));

DROP POLICY IF EXISTS "Creator reviews public read" ON public.creator_reviews;
CREATE POLICY "Creator reviews public read" ON public.creator_reviews FOR SELECT TO anon, authenticated
  USING (creator_id IN (SELECT id FROM public.creator_profiles WHERE is_public_profile = true AND status = 'active'));

DROP POLICY IF EXISTS "Public commercial screens read" ON public.screens;
CREATE POLICY "Public commercial screens read" ON public.screens FOR SELECT TO anon, authenticated
  USING (is_public_screen = true AND show_on_map = true AND venue_type <> 'residential' AND status = 'online');

-- 14. SEED: Onboarding Flows da Etapa 2
INSERT INTO public.onboarding_flows (code, audience, name, status) VALUES
  ('company-social-marketplace', 'company', 'Onboarding Empresa: Redes Sociais e Marketplace', 'active'),
  ('creator-social-marketplace', 'creator', 'Onboarding Creator: Redes Sociais e Precificação', 'active'),
  ('master-social-marketplace', 'master', 'Onboarding Master: Governança Social e Vitrine', 'active')
ON CONFLICT (code) DO NOTHING;

-- Passos de Onboarding Empresa
INSERT INTO public.onboarding_steps (flow_id, code, title, description, display_order, completion_signal, action_href)
SELECT id, 'empresa-conectar-social', 'Conectar Redes Sociais', 'Vincule a página do Facebook e conta do Instagram da sua empresa para divulgar campanhas.', 1, 'social_connected', '/marketplace?tab=social'
FROM public.onboarding_flows WHERE code = 'company-social-marketplace'
ON CONFLICT (flow_id, code) DO NOTHING;

INSERT INTO public.onboarding_steps (flow_id, code, title, description, display_order, completion_signal, action_href)
SELECT id, 'empresa-encontrar-creator', 'Explorar Creators', 'Use os filtros de cidade, nicho e engajamento para encontrar creators ideais para a sua marca.', 2, 'creator_searched', '/marketplace?tab=creators'
FROM public.onboarding_flows WHERE code = 'company-social-marketplace'
ON CONFLICT (flow_id, code) DO NOTHING;

INSERT INTO public.onboarding_steps (flow_id, code, title, description, display_order, completion_signal, action_href)
SELECT id, 'empresa-comprar-campanha', 'Contratar Mídia Omnichannel', 'Faça a cotação congelada e lance campanhas em TVs parceiras e redes de Creators com segurança.', 3, 'campaign_quoted', '/campaigns/new'
FROM public.onboarding_flows WHERE code = 'company-social-marketplace'
ON CONFLICT (flow_id, code) DO NOTHING;

-- Passos de Onboarding Creator
INSERT INTO public.onboarding_steps (flow_id, code, title, description, display_order, completion_signal, action_href)
SELECT id, 'creator-conectar-meta', 'Conectar Instagram e Facebook', 'Autorize com segurança via OAuth oficial da Meta para detectar suas capacidades de publicação.', 1, 'meta_oauth_connected', '/creator?tab=social'
FROM public.onboarding_flows WHERE code = 'creator-social-marketplace'
ON CONFLICT (flow_id, code) DO NOTHING;

INSERT INTO public.onboarding_steps (flow_id, code, title, description, display_order, completion_signal, action_href)
SELECT id, 'creator-entender-metricas', 'Métricas e Creator Score', 'Conheça seu Creator Score e Media Value Score calculados com base no seu histórico e relevância local.', 2, 'metrics_viewed', '/creator?tab=resumo'
FROM public.onboarding_flows WHERE code = 'creator-social-marketplace'
ON CONFLICT (flow_id, code) DO NOTHING;

INSERT INTO public.onboarding_steps (flow_id, code, title, description, display_order, completion_signal, action_href)
SELECT id, 'creator-definir-precos', 'Definir Preços e Rate Cards', 'Escolha entre preço sugerido pelo algoritmo ou defina seu valor mínimo por Story, Feed ou Reel.', 3, 'rate_card_set', '/creator?tab=marketplace'
FROM public.onboarding_flows WHERE code = 'creator-social-marketplace'
ON CONFLICT (flow_id, code) DO NOTHING;

INSERT INTO public.onboarding_steps (flow_id, code, title, description, display_order, completion_signal, action_href)
SELECT id, 'creator-configurar-publicacao', 'Modos de Publicação', 'Defina se você prefere publicar manualmente, mediante aprovação prévia ou modo automático.', 4, 'pub_mode_configured', '/creator?tab=social'
FROM public.onboarding_flows WHERE code = 'creator-social-marketplace'
ON CONFLICT (flow_id, code) DO NOTHING;

INSERT INTO public.onboarding_steps (flow_id, code, title, description, display_order, completion_signal, action_href)
SELECT id, 'creator-ativar-marketplace', 'Ativar Perfil no Marketplace', 'Apareça na vitrine pública para que empresas locais contratem sua influência.', 5, 'profile_published', '/creator?tab=marketplace'
FROM public.onboarding_flows WHERE code = 'creator-social-marketplace'
ON CONFLICT (flow_id, code) DO NOTHING;

-- Passos de Onboarding Master
INSERT INTO public.onboarding_steps (flow_id, code, title, description, display_order, completion_signal, action_href)
SELECT id, 'master-validar-canais', 'Validar Canais e Capacidades', 'Monitore canais conectados, diagnósticos de permissão e tokens ativos na rede.', 1, 'channels_reviewed', '/admin/mpm'
FROM public.onboarding_flows WHERE code = 'master-social-marketplace'
ON CONFLICT (flow_id, code) DO NOTHING;

INSERT INTO public.onboarding_steps (flow_id, code, title, description, display_order, completion_signal, action_href)
SELECT id, 'master-gerenciar-marketplace', 'Gerenciar Marketplace e Vitrine', 'Modere os perfis exibidos na vitrine e configure a visibilidade pública da rede.', 2, 'marketplace_managed', '/admin/mpm'
FROM public.onboarding_flows WHERE code = 'master-social-marketplace'
ON CONFLICT (flow_id, code) DO NOTHING;

-- 15. SEED: 12 Artigos do Help Center (Etapa 2)
INSERT INTO public.help_articles (slug, audience, title, objective, expected_result, display_order) VALUES
  ('como-conectar-instagram', 'creator', 'Como conectar Instagram', 'Guiar o creator no processo oficial de OAuth do Instagram Profissional.', 'Conta profissional conectada com permissões de publicação detectadas.', 1),
  ('como-conectar-facebook', 'creator', 'Como conectar Facebook', 'Explicar a conexão com Páginas do Facebook administradas pela conta do usuário.', 'Página conectada pronta para exibição e campanhas no feed.', 2),
  ('minha-conta-nao-aparece', 'creator', 'Minha conta não aparece', 'Solucionar casos em que a conta do Instagram não está vinculada a uma Página ou não é profissional.', 'Conta convertida em profissional e vinculada corretamente à Página.', 3),
  ('permissoes-meta', 'creator', 'Permissões Meta', 'Esclarecer quais permissões são requisitadas e por que o portal não armazena senhas.', 'Entendimento sobre segurança, OAuth e escopos autorizados.', 4),
  ('story-automatico', 'creator', 'Story automático', 'Explicar quando o formato Story é elegível e como funciona a publicação automática.', 'Story publicado dentro das regras e horários definidos pelo creator.', 5),
  ('reel-automatico', 'creator', 'Reel automático', 'Instruir sobre requisitos de vídeo e duração para publicação automatizada de Reels.', 'Reel postado diretamente com som e formato adequados.', 6),
  ('como-funciona-preco-creator', 'creator', 'Como funciona o preço do Creator', 'Detalhar o Creator Dynamic Pricing Engine baseado em métricas estáveis de 30 dias.', 'Preço justo gerado pelo sistema respeitando o piso definido pelo creator.', 7),
  ('como-contratar-creator', 'company', 'Como contratar um Creator', 'Demonstrar como uma empresa pesquisa, seleciona formatos e solicita cotação.', 'Campanha contratada com preço congelado e entrega garantida.', 8),
  ('como-anunciar-em-tvs', 'company', 'Como anunciar em TVs', 'Explicar a escolha de pontos indoor no Marketplace de TVs da cidade.', 'Anúncio veiculado em estabelecimentos comerciais estratégicos.', 9),
  ('como-acompanhar-campanha', 'company', 'Como acompanhar uma campanha', 'Acompanhar em tempo real a comprovação de entrega tanto em telas quanto em redes.', 'Relatório transparente de inserções e posts confirmados.', 10),
  ('como-funciona-proof-of-publication', 'creator', 'Como funciona Proof of Publication', 'Demonstrar como o link e dados da postagem comprovam a entrega para liberar os créditos.', 'Settlement econômico creditado sem risco de estorno.', 11),
  ('como-funciona-creator-score', 'creator', 'Como funciona Creator Score', 'Explicar os fatores de pontualidade, consistência e avaliações que aumentam o score.', 'Evolução de tier de Starter até Elite com maior valorização comercial.', 12)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  objective = EXCLUDED.objective,
  expected_result = EXCLUDED.expected_result,
  display_order = EXCLUDED.display_order;
