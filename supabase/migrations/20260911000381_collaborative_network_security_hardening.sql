-- Hardening mínimo identificado na homologação da Rede Colaborativa V1.
-- Garante ownership canônico do canal e impede autorrecompensa empresarial.

CREATE OR REPLACE FUNCTION public.validate_collaborative_channel_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE channel_owner_type TEXT; channel_owner_id UUID;
BEGIN
  SELECT owner_type,owner_id INTO channel_owner_type,channel_owner_id
  FROM public.social_channels WHERE id=NEW.social_channel_id;
  IF channel_owner_id IS NULL OR channel_owner_type<>NEW.owner_type OR channel_owner_id<>NEW.owner_id THEN
    RAISE EXCEPTION 'Owner do opt-in não corresponde ao owner canônico do canal.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_collaborative_channel_owner
BEFORE INSERT OR UPDATE OF social_channel_id,owner_type,owner_id ON public.collaborative_channel_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_collaborative_channel_owner();

CREATE OR REPLACE FUNCTION public.prevent_collaborative_self_reward()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.participant_type='company' AND EXISTS(
    SELECT 1 FROM public.campaigns c WHERE c.id=NEW.campaign_id AND c.company_id=NEW.participant_id
  ) THEN
    RAISE EXCEPTION 'Empresa anunciante não pode remunerar o próprio canal.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_prevent_collaborative_self_reward
BEFORE INSERT ON public.offer_acceptances
FOR EACH ROW EXECUTE FUNCTION public.prevent_collaborative_self_reward();
