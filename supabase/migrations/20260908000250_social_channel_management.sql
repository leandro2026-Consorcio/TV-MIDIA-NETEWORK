-- Mutação segura do opt-in social; ciphertext permanece inacessível ao cliente.
CREATE OR REPLACE FUNCTION public.set_social_channel_participation(p_channel_id UUID,p_enabled BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.social_channels%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.social_channels WHERE id=p_channel_id FOR UPDATE;
 IF c.id IS NULL OR NOT public.mpm_can_manage_holder(c.owner_type,c.owner_id) THEN RAISE EXCEPTION 'Canal inválido ou acesso negado.'; END IF;
 UPDATE public.social_channels SET participation_enabled=p_enabled,status=CASE WHEN p_enabled THEN 'active' ELSE 'paused' END,updated_at=now() WHERE id=c.id;
 RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.set_social_channel_participation(UUID,BOOLEAN) TO authenticated,service_role;
