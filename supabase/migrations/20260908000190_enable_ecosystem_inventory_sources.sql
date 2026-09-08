-- Habilita fontes concretas do ecossistema mantendo ownership validado.
CREATE OR REPLACE FUNCTION public.validate_media_inventory_source()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_owner UUID; v_type TEXT; v_event UUID;
BEGIN
 IF NEW.source_type='company_screen' THEN
   SELECT company_id INTO v_owner FROM public.screens WHERE id=NEW.source_id;
   IF v_owner IS NULL OR NEW.owner_type<>'company' OR NEW.owner_id<>v_owner OR NEW.channel_family<>'indoor' THEN RAISE EXCEPTION 'Inventário não corresponde à tela empresarial de origem.'; END IF;
 ELSIF NEW.source_type='organic_screen' THEN
   SELECT participant_id INTO v_owner FROM public.organic_screens WHERE id=NEW.source_id;
   IF v_owner IS NULL OR NEW.owner_type<>'organic_participant' OR NEW.owner_id<>v_owner OR NEW.channel_family<>'indoor' THEN RAISE EXCEPTION 'Inventário não corresponde à tela orgânica de origem.'; END IF;
 ELSIF NEW.source_type IN ('social_channel','creator_channel') THEN
   SELECT owner_id,owner_type INTO v_owner,v_type FROM public.social_channels WHERE id=NEW.source_id;
   IF v_owner IS NULL OR NEW.owner_id<>v_owner OR NEW.owner_type<>v_type OR
      (NEW.source_type='creator_channel' AND (v_type<>'creator' OR NEW.channel_family<>'creator')) OR
      (NEW.source_type='social_channel' AND (v_type='creator' OR NEW.channel_family<>'social')) THEN
     RAISE EXCEPTION 'Inventário não corresponde ao canal social/creator de origem.';
   END IF;
 ELSIF NEW.source_type='event_slot' THEN
   BEGIN v_event:=(NEW.metadata->>'event_id')::uuid; EXCEPTION WHEN OTHERS THEN v_event:=NULL; END;
   SELECT owner_company_id INTO v_owner FROM public.events WHERE id=v_event;
   IF v_owner IS NULL OR NEW.owner_type<>'company' OR NEW.owner_id<>v_owner OR NEW.channel_family<>'event' THEN RAISE EXCEPTION 'Inventário não corresponde ao evento de origem.'; END IF;
 ELSIF NEW.source_type='future' THEN
   RAISE EXCEPTION 'Source future permanece bloqueado.';
 END IF;
 RETURN NEW;
END $$;
