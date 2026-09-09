-- ============================================================================
-- MIGRACAO INCREMENTAL: SOCIAL FOUNDATION V2
-- Data: 2026-09-09
-- Suporte a Instagram API with Instagram Login (direto, sem Facebook Page)
-- Suporte a Facebook Login for Business (Páginas)
-- Flags granulares, ciclo de vida de tokens e diagnóstico Master
-- ============================================================================

-- 1. EXTENSOES: social_connections
ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS auth_flow TEXT NOT NULL DEFAULT 'facebook_login' CHECK (auth_flow IN ('facebook_login', 'instagram_login')),
  ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_type TEXT DEFAULT 'bearer';

-- 2. EXTENSOES: social_channels
ALTER TABLE public.social_channels
  ADD COLUMN IF NOT EXISTS auth_flow TEXT NOT NULL DEFAULT 'facebook_login' CHECK (auth_flow IN ('facebook_login', 'instagram_login')),
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. PERMISSOES DE COLUNA
GRANT SELECT(id, owner_type, owner_id, provider, provider_account_id, auth_flow, token_key_version, scopes, status, connected_by, connected_at, expires_at, last_refreshed_at, metadata, created_at, updated_at)
ON public.social_connections TO authenticated;

-- 4. FEATURE FLAGS GRANULARES
INSERT INTO public.platform_settings(key, value, description) VALUES
  ('social_connection_enabled', 'true'::jsonb, 'Permite conexão social OAuth via Instagram Login e Facebook Login.'),
  ('social_manual_publish_enabled', 'true'::jsonb, 'Permite publicação manual orientada com prévia e confirmação.'),
  ('social_approval_publish_enabled', 'true'::jsonb, 'Permite publicação com fila de aprovação individual por campanha.'),
  ('social_auto_publish_master_enabled', 'false'::jsonb, 'Trava global de publicação totalmente automática (desligada por padrão).'),
  ('social_metrics_enabled', 'false'::jsonb, 'Leitura de métricas e insights (desabilitada publicamente até aprovação de permissões).')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

DROP POLICY IF EXISTS "PlatformSettings - Public read" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Public read" ON public.platform_settings FOR SELECT TO anon, authenticated USING (key IN (
  'public_trial_signup_enabled','public_trial_days','trial_invites_count','auto_approve_trial_internal_media','public_signup_disabled_message',
  'plan_price_monthly_cents','plan_price_annual_cents','media_inventory_v2','inventory_capacity_v2','inventory_allocations_v2',
  'inventory_preferred_limit','inventory_growth_enabled','inventory_v2','wallet_mpm_v2','settlement_v2','matching_v2','partner_programs_v2',
  'social_v2','creator_v2','events_v2','payout_v2','dynamic_pricing_v2','inventory_growth_monthly_limit','mpm_default_unit_price',
  'expansion_program_v1','expansion_public_base_url','social_auto_publish_master_enabled',
  'social_connection_enabled','social_manual_publish_enabled','social_approval_publish_enabled','social_metrics_enabled'
));

-- 5. FUNCAO: ensure_canonical_creator_profile
CREATE OR REPLACE FUNCTION public.ensure_canonical_creator_profile(p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_creator_id UUID;
  v_display_name TEXT;
  v_slug TEXT;
BEGIN
  -- 1. Verifica se já existe
  SELECT id INTO v_creator_id FROM public.creator_profiles WHERE user_id = p_user_id LIMIT 1;
  IF v_creator_id IS NOT NULL THEN
    RETURN v_creator_id;
  END IF;

  -- 2. Busca nome do perfil ou afiliado
  SELECT COALESCE(p.full_name, a.display_name, 'Creator MPM')
  INTO v_display_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.affiliate_profiles a ON a.user_id = u.id
  WHERE u.id = p_user_id;

  v_slug := 'creator-' || substr(md5(p_user_id::text), 1, 8);

  -- 3. Cria canonicamente
  INSERT INTO public.creator_profiles (
    user_id, display_name, slug, bio, city, state, niches,
    is_public_profile, show_followers_publicly, show_scores_publicly, show_pricing_publicly,
    is_verified, pricing_mode, status, creator_score, media_value_score, tier, metadata
  ) VALUES (
    p_user_id, COALESCE(v_display_name, 'Creator MPM'), v_slug, 'Perfil oficial Creator MPM.',
    'Brasil', 'BR', ARRAY['Geral'],
    true, true, true, true,
    false, 'dynamic', 'active', 50.0, 50.0, 'tier_c',
    jsonb_build_object('auto_provisioned', true, 'created_at', now())
  )
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_creator_id;

  RETURN v_creator_id;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_canonical_creator_profile(UUID) TO authenticated, service_role;

-- 6. RPC: get_social_diagnostics_for_master (sem vazar segredos)
CREATE OR REPLACE FUNCTION public.get_social_diagnostics_for_master()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Acesso exclusivo do Master Admin.';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'connection_id', sc.id,
      'channel_id', ch.id,
      'owner_type', sc.owner_type,
      'owner_id', sc.owner_id,
      'owner_name', CASE
        WHEN sc.owner_type = 'company' THEN (SELECT trade_name FROM public.companies WHERE id = sc.owner_id)
        WHEN sc.owner_type = 'creator' THEN (SELECT display_name FROM public.creator_profiles WHERE id = sc.owner_id)
        ELSE 'Participante Orgânico'
      END,
      'connected_by_email', (SELECT email FROM auth.users WHERE id = sc.connected_by),
      'provider', sc.provider,
      'auth_flow', sc.auth_flow,
      'channel_type', ch.channel_type,
      'display_name', ch.display_name,
      'username', ch.username,
      'provider_account_id_masked', CASE 
        WHEN length(sc.provider_account_id) > 6 
        THEN substr(sc.provider_account_id, 1, 3) || '****' || substr(sc.provider_account_id, length(sc.provider_account_id) - 2)
        ELSE '****'
      END,
      'scopes', sc.scopes,
      'status', sc.status,
      'diagnostic_status', ch.diagnostic_status,
      'diagnostic_message', ch.diagnostic_message,
      'feed_publish_capable', ch.feed_publish_capable,
      'reel_publish_capable', ch.reel_publish_capable,
      'story_publish_capable', ch.story_publish_capable,
      'insights_capable', ch.insights_capable,
      'metrics_capable', ch.metrics_capable,
      'connected_at', sc.connected_at,
      'expires_at', sc.expires_at,
      'last_refreshed_at', sc.last_refreshed_at,
      'last_diagnosed_at', ch.last_diagnosed_at
    ) ORDER BY sc.created_at DESC
  ) INTO result
  FROM public.social_connections sc
  LEFT JOIN public.social_channels ch ON ch.connection_id = sc.id;

  RETURN COALESCE(result, '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.get_social_diagnostics_for_master() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
