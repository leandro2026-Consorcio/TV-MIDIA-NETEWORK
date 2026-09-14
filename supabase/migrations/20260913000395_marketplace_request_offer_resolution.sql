-- Resolve the seller's operational offer inside the existing atomic request RPC.
CREATE OR REPLACE FUNCTION public.create_campaign_screen_marketplace_request(
  p_offer_id UUID, p_campaign_id UUID, p_screen_id UUID,
  p_media_asset_id UUID DEFAULT NULL, p_request_message TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id UUID := auth.uid(); v_campaign RECORD; v_screen RECORD; v_offer RECORD;
  v_media_id UUID := p_media_asset_id; v_order_id UUID; v_result JSONB;
  v_created_offer BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Usuário não autenticado.'); END IF;
  SELECT c.* INTO v_campaign FROM public.campaigns c WHERE c.id=p_campaign_id AND
    (public.is_master_admin() OR EXISTS (SELECT 1 FROM public.company_users cu WHERE cu.company_id=c.company_id AND cu.user_id=v_user_id AND cu.is_active));
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Campanha não encontrada.'); END IF;
  IF v_campaign.end_date IS NOT NULL AND v_campaign.end_date<CURRENT_DATE THEN RETURN jsonb_build_object('success',false,'error','Esta campanha já terminou.'); END IF;
  SELECT s.* INTO v_screen FROM public.screens s WHERE s.id=p_screen_id AND s.status<>'inactive';
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','TV não encontrada ou indisponível.'); END IF;
  IF v_screen.company_id=v_campaign.company_id THEN RETURN jsonb_build_object('success',false,'error','A TV da própria empresa deve ser vinculada diretamente.'); END IF;
  IF v_media_id IS NULL THEN SELECT cm.media_asset_id INTO v_media_id FROM public.campaign_media cm JOIN public.media_assets m ON m.id=cm.media_asset_id WHERE cm.campaign_id=p_campaign_id AND cm.is_active AND m.status='approved' ORDER BY cm.created_at LIMIT 1; END IF;
  IF v_media_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.campaign_media cm JOIN public.media_assets m ON m.id=cm.media_asset_id WHERE cm.campaign_id=p_campaign_id AND cm.media_asset_id=v_media_id AND cm.is_active AND m.company_id=v_campaign.company_id AND m.status='approved') THEN RETURN jsonb_build_object('success',false,'error','A campanha não possui criativo aprovado válido.'); END IF;
  SELECT id INTO v_order_id FROM public.ad_offer_orders WHERE campaign_id=p_campaign_id AND target_screen_id=p_screen_id AND approval_status IN ('pending_approval','approved') AND status NOT IN ('cancelled','rejected') ORDER BY created_at DESC LIMIT 1;
  IF v_order_id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'duplicate',true,'order_id',v_order_id,'campaign_id',p_campaign_id,'target_screen_id',p_screen_id,'approval_status','pending_approval','message','Solicitação já enviada.'); END IF;

  -- Serializa a resolução por empresa exibidora: duas solicitações concorrentes
  -- não podem criar duas ofertas operacionais padrão.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_screen.company_id::text, 395));

  SELECT o.* INTO v_offer FROM public.company_ad_offers o WHERE o.id=p_offer_id AND o.status='active' AND o.company_id=v_screen.company_id;
  IF NOT FOUND AND p_offer_id IS NULL THEN
    SELECT o.* INTO v_offer FROM public.company_ad_offers o WHERE o.company_id=v_screen.company_id AND o.status='active' ORDER BY o.created_at LIMIT 1;
  END IF;
  IF NOT FOUND AND p_offer_id IS NULL THEN
    INSERT INTO public.company_ad_offers(company_id,title,description,credits_amount,price_cents,status,is_public)
    VALUES(v_screen.company_id,format('Inserções na TV: %s',v_screen.name),format('Exibição comercial na tela %s.',v_screen.name),100,5000,'active',true)
    RETURNING * INTO v_offer;
    v_created_offer := true;
  END IF;
  IF v_offer.id IS NULL OR v_offer.company_id<>v_screen.company_id THEN RETURN jsonb_build_object('success',false,'error','Oferta de mídia inválida para esta TV.'); END IF;
  v_result:=public.create_marketplace_media_request(v_offer.id,v_campaign.company_id,p_request_message,v_campaign.start_date,v_campaign.end_date,v_media_id,format('Campanha %s (%s) para TV %s (%s).',v_campaign.name,p_campaign_id,v_screen.name,p_screen_id));
  IF COALESCE((v_result->>'success')::boolean,false)=false THEN
    IF v_created_offer THEN DELETE FROM public.company_ad_offers WHERE id=v_offer.id; END IF;
    RETURN v_result;
  END IF;
  v_order_id:=NULLIF(v_result->>'order_id','')::uuid;
  UPDATE public.ad_offer_orders SET campaign_id=p_campaign_id,target_screen_id=p_screen_id,updated_at=now() WHERE id=v_order_id;
  RETURN jsonb_build_object('success',true,'duplicate',false,'order_id',v_order_id,'campaign_id',p_campaign_id,'target_screen_id',p_screen_id,'approval_status','pending_approval','message','Solicitação enviada.');
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_order_id FROM public.ad_offer_orders WHERE campaign_id=p_campaign_id AND target_screen_id=p_screen_id AND approval_status IN ('pending_approval','approved') AND status NOT IN ('cancelled','rejected') ORDER BY created_at DESC LIMIT 1;
  RETURN jsonb_build_object('success',true,'duplicate',true,'order_id',v_order_id,'campaign_id',p_campaign_id,'target_screen_id',p_screen_id,'approval_status','pending_approval','message','Solicitação já enviada.');
END; $$;

REVOKE ALL ON FUNCTION public.create_campaign_screen_marketplace_request(UUID, UUID, UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_campaign_screen_marketplace_request(UUID, UUID, UUID, UUID, TEXT) TO authenticated, service_role;
