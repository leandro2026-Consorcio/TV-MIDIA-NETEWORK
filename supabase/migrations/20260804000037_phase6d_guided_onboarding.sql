-- Fase 6D — Tour guiado e primeiros passos por empresa

CREATE TABLE IF NOT EXISTS public.company_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  tour_seen_at TIMESTAMPTZ,
  tour_started_at TIMESTAMPTZ,
  tour_completed_at TIMESTAMPTZ,
  tour_skipped_at TIMESTAMPTZ,
  dont_show_again BOOLEAN NOT NULL DEFAULT FALSE,
  first_screen_created_at TIMESTAMPTZ,
  first_screen_paired_at TIMESTAMPTZ,
  first_media_uploaded_at TIMESTAMPTZ,
  first_playlist_created_at TIMESTAMPTZ,
  first_campaign_started_at TIMESTAMPTZ,
  first_playback_detected_at TIMESTAMPTZ,
  first_invite_copied_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_onboarding_progress_company
  ON public.company_onboarding_progress(company_id);

ALTER TABLE public.company_onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OnboardingProgress - leitura isolada por empresa" ON public.company_onboarding_progress;
CREATE POLICY "OnboardingProgress - leitura isolada por empresa"
  ON public.company_onboarding_progress FOR SELECT
  USING (
    public.is_master_admin()
    OR company_id IN (SELECT public.get_user_company_ids())
  );

-- Não existem policies de INSERT/UPDATE/DELETE para usuários comuns. Toda mutação
-- passa por funções server-side/trigger auditadas; service_role ignora RLS.

CREATE OR REPLACE FUNCTION public.mark_company_onboarding_progress(
  p_company_id UUID,
  p_event TEXT,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.company_onboarding_progress
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_row public.company_onboarding_progress;
  v_changed BOOLEAN := FALSE;
  v_was_completed BOOLEAN := FALSE;
  v_audit_action TEXT;
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.is_master_admin()
     AND COALESCE(current_setting('app.onboarding_trigger', TRUE), '') <> '1' THEN
    RAISE EXCEPTION 'ONBOARDING_PROGRESS_SERVER_ONLY';
  END IF;

  INSERT INTO public.company_onboarding_progress (company_id)
  VALUES (p_company_id)
  ON CONFLICT (company_id) DO NOTHING;

  SELECT * INTO v_row
  FROM public.company_onboarding_progress
  WHERE company_id = p_company_id
  FOR UPDATE;
  v_was_completed := v_row.tour_completed_at IS NOT NULL;

  CASE p_event
    WHEN 'tour_seen' THEN
      v_changed := v_row.tour_seen_at IS NULL;
      UPDATE public.company_onboarding_progress SET tour_seen_at = COALESCE(tour_seen_at, v_now) WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_TOUR_SEEN';
    WHEN 'tour_started' THEN
      v_changed := v_row.tour_started_at IS NULL;
      UPDATE public.company_onboarding_progress SET tour_started_at = COALESCE(tour_started_at, v_now) WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_TOUR_STARTED';
    WHEN 'tour_skipped' THEN
      v_changed := v_row.tour_skipped_at IS NULL;
      UPDATE public.company_onboarding_progress SET tour_skipped_at = COALESCE(tour_skipped_at, v_now) WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_TOUR_SKIPPED';
    WHEN 'tour_completed' THEN
      v_changed := v_row.tour_completed_at IS NULL;
      UPDATE public.company_onboarding_progress SET tour_completed_at = COALESCE(tour_completed_at, v_now) WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_TOUR_COMPLETED';
    WHEN 'dont_show_again' THEN
      v_changed := NOT v_row.dont_show_again;
      UPDATE public.company_onboarding_progress SET dont_show_again = TRUE WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_DONT_SHOW_AGAIN_ENABLED';
    WHEN 'screen_created' THEN
      v_changed := v_row.first_screen_created_at IS NULL;
      UPDATE public.company_onboarding_progress SET first_screen_created_at = COALESCE(first_screen_created_at, v_now) WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_FIRST_SCREEN_CREATED';
    WHEN 'screen_paired' THEN
      v_changed := v_row.first_screen_paired_at IS NULL;
      UPDATE public.company_onboarding_progress SET first_screen_paired_at = COALESCE(first_screen_paired_at, v_now) WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_FIRST_SCREEN_PAIRED';
    WHEN 'media_uploaded' THEN
      v_changed := v_row.first_media_uploaded_at IS NULL;
      UPDATE public.company_onboarding_progress SET first_media_uploaded_at = COALESCE(first_media_uploaded_at, v_now) WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_FIRST_MEDIA_UPLOADED';
    WHEN 'playlist_created' THEN
      v_changed := v_row.first_playlist_created_at IS NULL;
      UPDATE public.company_onboarding_progress SET first_playlist_created_at = COALESCE(first_playlist_created_at, v_now) WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_FIRST_PLAYLIST_CREATED';
    WHEN 'campaign_started' THEN
      v_changed := v_row.first_campaign_started_at IS NULL;
      UPDATE public.company_onboarding_progress SET first_campaign_started_at = COALESCE(first_campaign_started_at, v_now) WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_FIRST_CAMPAIGN_STARTED';
    WHEN 'playback_detected' THEN
      v_changed := v_row.first_playback_detected_at IS NULL;
      UPDATE public.company_onboarding_progress SET first_playback_detected_at = COALESCE(first_playback_detected_at, v_now) WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_FIRST_PLAYBACK_DETECTED';
    WHEN 'invite_copied' THEN
      v_changed := v_row.first_invite_copied_at IS NULL;
      UPDATE public.company_onboarding_progress SET first_invite_copied_at = COALESCE(first_invite_copied_at, v_now) WHERE company_id = p_company_id;
      v_audit_action := 'ONBOARDING_FIRST_INVITE_COPIED';
    ELSE
      RAISE EXCEPTION 'INVALID_ONBOARDING_EVENT';
  END CASE;

  UPDATE public.company_onboarding_progress
  SET updated_at = v_now,
      metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
      tour_completed_at = CASE
        WHEN first_screen_created_at IS NOT NULL
         AND first_screen_paired_at IS NOT NULL
         AND first_media_uploaded_at IS NOT NULL
         AND (first_playlist_created_at IS NOT NULL OR first_campaign_started_at IS NOT NULL)
         AND first_playback_detected_at IS NOT NULL
         AND first_invite_copied_at IS NOT NULL
        THEN COALESCE(tour_completed_at, v_now)
        ELSE tour_completed_at
      END
  WHERE company_id = p_company_id
  RETURNING * INTO v_row;

  IF v_changed THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (p_user_id, p_company_id, v_audit_action, COALESCE(p_metadata, '{}'::jsonb));
  END IF;

  IF NOT v_was_completed AND v_row.tour_completed_at IS NOT NULL AND p_event <> 'tour_completed' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (p_user_id, p_company_id, 'ONBOARDING_TOUR_COMPLETED', jsonb_build_object('source', 'all_main_steps_completed'));
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_company_onboarding_progress(UUID, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_company_onboarding_progress(UUID, TEXT, UUID, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.capture_company_onboarding_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event TEXT;
  v_company_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'screens' AND TG_OP = 'INSERT' THEN
    v_event := 'screen_created'; v_company_id := NEW.company_id;
  ELSIF TG_TABLE_NAME = 'screens' AND TG_OP = 'UPDATE'
    AND OLD.paired_at IS NULL AND NEW.paired_at IS NOT NULL THEN
    v_event := 'screen_paired'; v_company_id := NEW.company_id;
  ELSIF TG_TABLE_NAME = 'media_assets' AND TG_OP = 'INSERT' THEN
    v_event := 'media_uploaded'; v_company_id := NEW.company_id;
  ELSIF TG_TABLE_NAME = 'playlists' AND TG_OP = 'INSERT' THEN
    v_event := 'playlist_created'; v_company_id := NEW.company_id;
  ELSIF TG_TABLE_NAME = 'campaigns' AND TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active' THEN
    v_event := 'campaign_started'; v_company_id := NEW.company_id;
  ELSIF TG_TABLE_NAME = 'playback_logs' AND TG_OP = 'INSERT'
    AND NEW.status IN ('started', 'completed') THEN
    v_event := 'playback_detected'; v_company_id := NEW.company_id;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM set_config('app.onboarding_trigger', '1', TRUE);
  PERFORM public.mark_company_onboarding_progress(
    v_company_id,
    v_event,
    auth.uid(),
    jsonb_build_object('source', 'database_trigger', 'record_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_company_onboarding_progress() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS capture_onboarding_screen_insert ON public.screens;
CREATE TRIGGER capture_onboarding_screen_insert AFTER INSERT ON public.screens
FOR EACH ROW EXECUTE FUNCTION public.capture_company_onboarding_progress();

DROP TRIGGER IF EXISTS capture_onboarding_screen_pairing ON public.screens;
CREATE TRIGGER capture_onboarding_screen_pairing AFTER UPDATE OF paired_at ON public.screens
FOR EACH ROW EXECUTE FUNCTION public.capture_company_onboarding_progress();

DROP TRIGGER IF EXISTS capture_onboarding_media_insert ON public.media_assets;
CREATE TRIGGER capture_onboarding_media_insert AFTER INSERT ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.capture_company_onboarding_progress();

DROP TRIGGER IF EXISTS capture_onboarding_playlist_insert ON public.playlists;
CREATE TRIGGER capture_onboarding_playlist_insert AFTER INSERT ON public.playlists
FOR EACH ROW EXECUTE FUNCTION public.capture_company_onboarding_progress();

DROP TRIGGER IF EXISTS capture_onboarding_campaign_active ON public.campaigns;
CREATE TRIGGER capture_onboarding_campaign_active AFTER UPDATE OF status ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.capture_company_onboarding_progress();

DROP TRIGGER IF EXISTS capture_onboarding_playback_insert ON public.playback_logs;
CREATE TRIGGER capture_onboarding_playback_insert AFTER INSERT ON public.playback_logs
FOR EACH ROW EXECUTE FUNCTION public.capture_company_onboarding_progress();

INSERT INTO public.company_onboarding_progress (company_id)
SELECT id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;
