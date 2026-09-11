-- TikTok como terceiro provider da Social Foundation existente.
-- Migration incremental mínima: amplia constraints, ciclo de refresh e capabilities.

ALTER TABLE public.social_connections
  DROP CONSTRAINT IF EXISTS social_connections_provider_check,
  DROP CONSTRAINT IF EXISTS social_connections_auth_flow_check;

ALTER TABLE public.social_connections
  ADD CONSTRAINT social_connections_provider_check
    CHECK (provider IN ('facebook','instagram','tiktok')),
  ADD CONSTRAINT social_connections_auth_flow_check
    CHECK (auth_flow IN ('facebook_login','instagram_login','tiktok_login')),
  ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS refresh_expires_at TIMESTAMPTZ;

ALTER TABLE public.social_channels
  DROP CONSTRAINT IF EXISTS social_channels_provider_check,
  DROP CONSTRAINT IF EXISTS social_channels_channel_type_check,
  DROP CONSTRAINT IF EXISTS social_channels_auth_flow_check;

ALTER TABLE public.social_channels
  ADD CONSTRAINT social_channels_provider_check
    CHECK (provider IN ('facebook','instagram','tiktok')),
  ADD CONSTRAINT social_channels_channel_type_check
    CHECK (channel_type IN ('facebook_page','instagram_professional','tiktok_profile')),
  ADD CONSTRAINT social_channels_auth_flow_check
    CHECK (auth_flow IN ('facebook_login','instagram_login','tiktok_login')),
  ADD COLUMN IF NOT EXISTS profile_read_capable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_list_capable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_upload_capable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS direct_post_capable BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.platform_settings(key, value, description) VALUES
  ('tiktok_connection_enabled', 'false'::jsonb, 'Login Kit TikTok disponível somente após App e credenciais de produção válidos.'),
  ('tiktok_display_enabled', 'false'::jsonb, 'Display API TikTok disponível somente após aprovação e teste real do escopo.'),
  ('tiktok_upload_enabled', 'false'::jsonb, 'Upload de rascunho TikTok disponível somente após aprovação do produto e escopo video.upload.'),
  ('tiktok_direct_post_enabled', 'false'::jsonb, 'Direct Post TikTok bloqueado até auditoria e aprovação pública.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

DROP POLICY IF EXISTS "PlatformSettings - Public read" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Public read" ON public.platform_settings
FOR SELECT TO anon, authenticated USING (key IN (
  'public_trial_signup_enabled','public_trial_days','trial_invites_count','auto_approve_trial_internal_media','public_signup_disabled_message',
  'plan_price_monthly_cents','plan_price_annual_cents','media_inventory_v2','inventory_capacity_v2','inventory_allocations_v2',
  'inventory_preferred_limit','inventory_growth_enabled','inventory_v2','wallet_mpm_v2','settlement_v2','matching_v2','partner_programs_v2',
  'social_v2','creator_v2','events_v2','payout_v2','dynamic_pricing_v2','inventory_growth_monthly_limit','mpm_default_unit_price',
  'expansion_program_v1','expansion_public_base_url','social_auto_publish_master_enabled',
  'social_connection_enabled','social_manual_publish_enabled','social_approval_publish_enabled','social_metrics_enabled',
  'tiktok_connection_enabled','tiktok_display_enabled','tiktok_upload_enabled','tiktok_direct_post_enabled'
));

GRANT SELECT(id, owner_type, owner_id, provider, provider_account_id, auth_flow, token_key_version, scopes, status, connected_by, connected_at, expires_at, refresh_expires_at, last_refreshed_at, metadata, created_at, updated_at)
ON public.social_connections TO authenticated;

CREATE OR REPLACE FUNCTION public.get_social_diagnostics_for_master()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Acesso exclusivo do Master Admin.';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
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
      WHEN length(sc.provider_account_id) > 6 THEN substr(sc.provider_account_id, 1, 3) || '****' || substr(sc.provider_account_id, length(sc.provider_account_id) - 2)
      ELSE '****'
    END,
    'scopes', sc.scopes,
    'status', sc.status,
    'diagnostic_status', ch.diagnostic_status,
    'diagnostic_message', ch.diagnostic_message,
    'profile_read_capable', ch.profile_read_capable,
    'video_list_capable', ch.video_list_capable,
    'video_upload_capable', ch.video_upload_capable,
    'direct_post_capable', ch.direct_post_capable,
    'metrics_capable', ch.metrics_capable,
    'connected_at', sc.connected_at,
    'expires_at', sc.expires_at,
    'refresh_expires_at', sc.refresh_expires_at,
    'last_refreshed_at', sc.last_refreshed_at,
    'last_error', sc.metadata->>'last_error',
    'review_status', sc.metadata->>'review_status',
    'last_diagnosed_at', ch.last_diagnosed_at
  ) ORDER BY sc.created_at DESC) INTO result
  FROM public.social_connections sc
  LEFT JOIN public.social_channels ch ON ch.connection_id = sc.id;

  RETURN COALESCE(result, '[]'::jsonb);
END $$;

GRANT EXECUTE ON FUNCTION public.get_social_diagnostics_for_master() TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
