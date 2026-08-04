-- Corrige a captura automática do progresso sem alterar dados já registrados.
-- A função é compartilhada por triggers de tabelas diferentes; por isso cada
-- campo específico só pode ser acessado dentro do ramo da tabela correspondente.

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
  CASE TG_TABLE_NAME
    WHEN 'screens' THEN
      IF TG_OP = 'INSERT' THEN
        v_event := 'screen_created';
        v_company_id := NEW.company_id;
      ELSIF TG_OP = 'UPDATE'
        AND OLD.paired_at IS NULL
        AND NEW.paired_at IS NOT NULL THEN
        v_event := 'screen_paired';
        v_company_id := NEW.company_id;
      ELSE
        RETURN NEW;
      END IF;

    WHEN 'media_assets' THEN
      IF TG_OP = 'INSERT' THEN
        v_event := 'media_uploaded';
        v_company_id := NEW.company_id;
      ELSE
        RETURN NEW;
      END IF;

    WHEN 'playlists' THEN
      IF TG_OP = 'INSERT' THEN
        v_event := 'playlist_created';
        v_company_id := NEW.company_id;
      ELSE
        RETURN NEW;
      END IF;

    WHEN 'campaigns' THEN
      IF TG_OP = 'UPDATE'
        AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status = 'active' THEN
        v_event := 'campaign_started';
        v_company_id := NEW.company_id;
      ELSE
        RETURN NEW;
      END IF;

    WHEN 'playback_logs' THEN
      IF TG_OP = 'INSERT' AND NEW.status IN ('started', 'completed') THEN
        v_event := 'playback_detected';
        v_company_id := NEW.company_id;
      ELSE
        RETURN NEW;
      END IF;

    ELSE
      RETURN NEW;
  END CASE;

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
