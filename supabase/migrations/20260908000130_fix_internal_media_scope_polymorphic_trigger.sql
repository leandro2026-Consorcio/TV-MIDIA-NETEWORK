-- Corrige trigger polimórfico legado: NEW possui shape diferente em cada tabela.
CREATE OR REPLACE FUNCTION public.enforce_internal_media_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_internal_only BOOLEAN;
  v_campaign_type TEXT;
  v_media_id UUID;
  v_campaign_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'ad_offer_orders' THEN
    v_media_id := NULLIF(to_jsonb(NEW)->>'requested_media_asset_id', '')::UUID;
    IF v_media_id IS NOT NULL THEN
      SELECT COALESCE(trial_internal_only, FALSE) OR COALESCE(owner_only, FALSE)
      INTO v_internal_only FROM public.media_assets WHERE id = v_media_id;
      IF COALESCE(v_internal_only, FALSE) THEN
        RAISE EXCEPTION 'Mídia exclusiva da empresa não pode ser usada no marketplace.';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'campaign_media' THEN
    v_media_id := NULLIF(to_jsonb(NEW)->>'media_asset_id', '')::UUID;
    v_campaign_id := NULLIF(to_jsonb(NEW)->>'campaign_id', '')::UUID;
    SELECT COALESCE(m.trial_internal_only, FALSE) OR COALESCE(m.owner_only, FALSE), c.campaign_type
      INTO v_internal_only, v_campaign_type
    FROM public.media_assets m CROSS JOIN public.campaigns c
    WHERE m.id = v_media_id AND c.id = v_campaign_id;
    IF COALESCE(v_internal_only, FALSE) AND COALESCE(v_campaign_type, '') <> 'internal' THEN
      RAISE EXCEPTION 'Mídia exclusiva da empresa só pode ser usada em campanhas internas.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
