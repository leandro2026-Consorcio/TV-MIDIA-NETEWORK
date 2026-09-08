-- Contrato, prova e liquidação omnichannel no mesmo ledger MPM.

INSERT INTO public.media_price_rules(code,version,channel_family,unit_price_credits,priority,effective_from,metadata) VALUES
 ('social-reference',1,'social',0.50,0,now(),'{"configurable":true}'::jsonb),
 ('creator-reference',1,'creator',0.75,0,now(),'{"configurable":true}'::jsonb),
 ('event-reference',1,'event',0.25,0,now(),'{"configurable":true}'::jsonb)
ON CONFLICT(code,version) DO NOTHING;

CREATE TABLE public.media_commercial_contracts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 buyer_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
 supplier_holder_type TEXT NOT NULL CHECK (supplier_holder_type IN ('company','organic_participant','creator','partner')),
 supplier_holder_id UUID NOT NULL,
 inventory_id UUID NOT NULL REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
 campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
 price_quote_id UUID NOT NULL REFERENCES public.media_price_quotes(id) ON DELETE RESTRICT,
 fee_rule_id UUID NOT NULL REFERENCES public.platform_fee_rules(id) ON DELETE RESTRICT,
 settlement_rule_id UUID NOT NULL REFERENCES public.settlement_rules(id) ON DELETE RESTRICT,
 contracted_units BIGINT NOT NULL CHECK (contracted_units>0),
 gross_credits NUMERIC(18,4) NOT NULL CHECK (gross_credits>=0),
 fee_percentage NUMERIC(7,4) NOT NULL CHECK (fee_percentage BETWEEN 0 AND 100),
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('reserved','active','completed','cancelled','expired','disputed')),
 starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
 idempotency_key TEXT NOT NULL UNIQUE, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (ends_at>=starts_at)
);
CREATE TABLE public.delivery_proofs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id UUID NOT NULL REFERENCES public.media_commercial_contracts(id) ON DELETE RESTRICT,
 inventory_id UUID NOT NULL REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
 campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
 proof_type TEXT NOT NULL CHECK (proof_type IN ('proof_of_play','proof_of_publication','event_proof','manual')),
 source_type TEXT NOT NULL CHECK (source_type IN ('playback_log','social_publication','event_delivery','manual')),
 source_id UUID NOT NULL,
 delivered_units NUMERIC(18,4) NOT NULL CHECK (delivered_units>0),
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','rejected','reversed','disputed')),
 evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
 occurred_at TIMESTAMPTZ NOT NULL, validated_at TIMESTAMPTZ, validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 idempotency_key TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(source_type,source_id)
);

ALTER TABLE public.settlement_entries
 ALTER COLUMN seller_company_id DROP NOT NULL,
 ALTER COLUMN order_id DROP NOT NULL,
 ALTER COLUMN playback_log_id DROP NOT NULL,
 ADD COLUMN IF NOT EXISTS supplier_holder_type TEXT NOT NULL DEFAULT 'company',
 ADD COLUMN IF NOT EXISTS supplier_holder_id UUID,
 ADD COLUMN IF NOT EXISTS commercial_contract_id UUID REFERENCES public.media_commercial_contracts(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS delivery_proof_id UUID REFERENCES public.delivery_proofs(id) ON DELETE RESTRICT;
UPDATE public.settlement_entries SET supplier_holder_id=seller_company_id WHERE supplier_holder_id IS NULL;
ALTER TABLE public.settlement_entries ALTER COLUMN supplier_holder_id SET NOT NULL;
ALTER TABLE public.settlement_entries ADD CONSTRAINT settlement_entries_proof_source_check
 CHECK (playback_log_id IS NOT NULL OR delivery_proof_id IS NOT NULL);
CREATE UNIQUE INDEX uq_settlement_delivery_proof ON public.settlement_entries(delivery_proof_id) WHERE delivery_proof_id IS NOT NULL;

ALTER TABLE public.media_commercial_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commercial contracts parties read" ON public.media_commercial_contracts FOR SELECT TO authenticated USING(
 buyer_company_id IN (SELECT public.get_user_company_ids()) OR
 (supplier_holder_type='company' AND supplier_holder_id IN (SELECT public.get_user_company_ids())) OR
 (supplier_holder_type='organic_participant' AND supplier_holder_id IN (SELECT id FROM public.organic_participants WHERE user_id=auth.uid())) OR
 (supplier_holder_type='creator' AND supplier_holder_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR public.is_master_admin()
);
CREATE POLICY "Delivery proofs parties read" ON public.delivery_proofs FOR SELECT TO authenticated USING(contract_id IN (SELECT id FROM public.media_commercial_contracts) OR public.is_master_admin());
DROP POLICY IF EXISTS "MPM settlements parties read" ON public.settlement_entries;
CREATE POLICY "MPM settlements parties read" ON public.settlement_entries FOR SELECT TO authenticated USING(
 buyer_company_id IN (SELECT public.get_user_company_ids()) OR
 (supplier_holder_type='company' AND supplier_holder_id IN (SELECT public.get_user_company_ids())) OR
 (supplier_holder_type='organic_participant' AND supplier_holder_id IN (SELECT id FROM public.organic_participants WHERE user_id=auth.uid())) OR
 (supplier_holder_type='creator' AND supplier_holder_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR public.is_master_admin()
);

CREATE OR REPLACE FUNCTION public.create_media_commercial_contract(
 p_quote_id UUID,p_campaign_id UUID,p_supplier_holder_type TEXT,p_supplier_holder_id UUID,p_idempotency_key TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.media_price_quotes%ROWTYPE; inv public.media_inventory%ROWTYPE; fee public.platform_fee_rules%ROWTYPE; sr public.settlement_rules%ROWTYPE; cid UUID;
BEGIN
 SELECT * INTO q FROM public.media_price_quotes WHERE id=p_quote_id FOR UPDATE;
 SELECT * INTO inv FROM public.media_inventory WHERE id=q.inventory_id FOR SHARE;
 IF q.id IS NULL OR q.status<>'quoted' OR q.expires_at<=now() OR NOT public.mpm_can_manage_company(q.buyer_company_id) THEN RAISE EXCEPTION 'Cotação inválida, expirada ou acesso negado.'; END IF;
 IF inv.owner_type<>p_supplier_holder_type OR inv.owner_id<>p_supplier_holder_id THEN RAISE EXCEPTION 'Fornecedor não corresponde ao inventário.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=p_campaign_id AND COALESCE(c.buyer_company_id,c.company_id)=q.buyer_company_id) THEN RAISE EXCEPTION 'Campanha não pertence à compradora.'; END IF;
 SELECT * INTO fee FROM public.platform_fee_rules WHERE operation_type='media_sale' AND is_active AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY effective_from DESC LIMIT 1;
 SELECT * INTO sr FROM public.settlement_rules WHERE channel_family=inv.channel_family AND is_active AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY version DESC LIMIT 1;
 IF fee.id IS NULL OR sr.id IS NULL THEN RAISE EXCEPTION 'Fee ou settlement rule ausente.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('commercial-contract:'||p_idempotency_key,0));
 SELECT id INTO cid FROM public.media_commercial_contracts WHERE idempotency_key=p_idempotency_key; IF cid IS NOT NULL THEN RETURN cid; END IF;
 INSERT INTO public.media_commercial_contracts(buyer_company_id,supplier_holder_type,supplier_holder_id,inventory_id,campaign_id,price_quote_id,fee_rule_id,settlement_rule_id,
   contracted_units,gross_credits,fee_percentage,status,starts_at,ends_at,idempotency_key,metadata)
 VALUES(q.buyer_company_id,p_supplier_holder_type,p_supplier_holder_id,inv.id,p_campaign_id,q.id,fee.id,sr.id,q.insertion_quantity,q.gross_credits,fee.percentage,'active',q.starts_at,q.ends_at,p_idempotency_key,
   jsonb_build_object('price_rule_id',q.price_rule_id,'unit_price_credits',q.unit_price_credits)) RETURNING id INTO cid;
 UPDATE public.media_price_quotes SET status='accepted' WHERE id=q.id;
 RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.record_validated_delivery_proof(
 p_contract_id UUID,p_source_type TEXT,p_source_id UUID,p_delivered_units NUMERIC,p_occurred_at TIMESTAMPTZ,p_evidence JSONB,p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.media_commercial_contracts%ROWTYPE; inv public.media_inventory%ROWTYPE; sr public.settlement_rules%ROWTYPE;
 proof_id UUID; settlement_id UUID; account_id UUID; delivered_before NUMERIC; gross NUMERIC; fee NUMERIC; net NUMERIC; settle_status TEXT; publication public.social_publications%ROWTYPE;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Validação de prova exige serviço confiável ou Master.'; END IF;
 SELECT * INTO c FROM public.media_commercial_contracts WHERE id=p_contract_id FOR UPDATE;
 SELECT * INTO inv FROM public.media_inventory WHERE id=c.inventory_id FOR SHARE;
 SELECT * INTO sr FROM public.settlement_rules WHERE id=c.settlement_rule_id;
 IF c.id IS NULL OR c.status<>'active' OR p_occurred_at<c.starts_at OR p_occurred_at>c.ends_at OR p_delivered_units<=0 THEN RAISE EXCEPTION 'Contrato ou entrega inválida.'; END IF;
 IF p_source_type='social_publication' THEN
   SELECT * INTO publication FROM public.social_publications WHERE id=p_source_id FOR UPDATE;
   IF publication.id IS NULL OR publication.campaign_id<>c.campaign_id OR publication.status<>'published' OR inv.source_id<>publication.channel_id OR inv.proof_method<>'proof_of_publication' THEN RAISE EXCEPTION 'Publicação não comprova este contrato/inventário.'; END IF;
   UPDATE public.social_publications SET status='validated',validated_at=now(),proof=COALESCE(p_evidence,'{}') WHERE id=publication.id;
 ELSIF p_source_type='event_delivery' THEN
   IF inv.channel_family<>'event' OR inv.proof_method NOT IN ('event_proof','manual') OR COALESCE(p_evidence,'{}')='{}'::jsonb THEN RAISE EXCEPTION 'Prova de evento inválida.'; END IF;
 ELSE RAISE EXCEPTION 'Source de prova omnichannel não suportado.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('delivery-proof:'||p_idempotency_key,0));
 SELECT id INTO proof_id FROM public.delivery_proofs WHERE idempotency_key=p_idempotency_key;
 IF proof_id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'deduplicated',true,'proof_id',proof_id); END IF;
 SELECT COALESCE(sum(delivered_units),0) INTO delivered_before FROM public.delivery_proofs WHERE contract_id=c.id AND status IN ('validated','pending');
 IF delivered_before+p_delivered_units>c.contracted_units THEN RAISE EXCEPTION 'Entrega excede unidades contratadas.'; END IF;
 INSERT INTO public.delivery_proofs(contract_id,inventory_id,campaign_id,proof_type,source_type,source_id,delivered_units,status,evidence,occurred_at,validated_at,validated_by,idempotency_key)
 VALUES(c.id,inv.id,c.campaign_id,sr.proof_method,p_source_type,p_source_id,p_delivered_units,'validated',COALESCE(p_evidence,'{}'),p_occurred_at,now(),auth.uid(),p_idempotency_key) RETURNING id INTO proof_id;
 gross:=round(c.gross_credits*(p_delivered_units/c.contracted_units),4); fee:=round(gross*c.fee_percentage/100,4); net:=gross-fee;
 settle_status:=CASE WHEN sr.hold_hours>0 THEN 'pending' ELSE 'earned' END;
 INSERT INTO public.settlement_entries(seller_company_id,buyer_company_id,order_id,campaign_id,playback_log_id,fee_rule_id,delivered_units,gross_credits,platform_fee_credits,supplier_net_credits,status,
   idempotency_key,metadata,supplier_holder_type,supplier_holder_id,commercial_contract_id,delivery_proof_id,settled_at)
 VALUES(CASE WHEN c.supplier_holder_type='company' THEN c.supplier_holder_id END,c.buyer_company_id,NULL,c.campaign_id,NULL,c.fee_rule_id,p_delivered_units,gross,fee,net,settle_status,
   'omni-settlement:'||proof_id::text,jsonb_build_object('hold_hours',sr.hold_hours,'proof_type',sr.proof_method),c.supplier_holder_type,c.supplier_holder_id,c.id,proof_id,
   CASE WHEN sr.hold_hours=0 THEN now() END) RETURNING id INTO settlement_id;
 account_id:=public.mpm_ensure_holder_account(c.supplier_holder_type,c.supplier_holder_id,'earned');
 PERFORM public._mpm_post_entry(account_id,'settlement_gross','informational',gross,0,0,0,'delivery_proof',proof_id,'omni:'||settlement_id::text||':gross',c.campaign_id,NULL,settlement_id,NULL,'{}');
 IF fee>0 THEN PERFORM public._mpm_post_entry(account_id,'platform_fee','informational',fee,0,0,0,'platform_fee',c.fee_rule_id,'omni:'||settlement_id::text||':fee',c.campaign_id,NULL,settlement_id,NULL,'{}'); END IF;
 IF net>0 THEN
   IF sr.hold_hours>0 THEN PERFORM public._mpm_post_entry(account_id,'pending','credit',net,0,net,0,'delivery_proof',proof_id,'omni:'||settlement_id::text||':pending',c.campaign_id,NULL,settlement_id,NULL,jsonb_build_object('available_at',now()+make_interval(hours=>sr.hold_hours)));
   ELSE PERFORM public._mpm_post_entry(account_id,'earned','credit',net,net,0,0,'delivery_proof',proof_id,'omni:'||settlement_id::text||':earned',c.campaign_id,NULL,settlement_id,NULL,'{}'); END IF;
 END IF;
 IF delivered_before+p_delivered_units=c.contracted_units THEN UPDATE public.media_commercial_contracts SET status='completed',updated_at=now() WHERE id=c.id; END IF;
 RETURN jsonb_build_object('success',true,'proof_id',proof_id,'settlement_id',settlement_id,'gross_credits',gross,'fee_credits',fee,'supplier_net_credits',net,'status',settle_status);
END $$;

CREATE OR REPLACE FUNCTION public.release_pending_mpm_settlements(p_now TIMESTAMPTZ DEFAULT now())
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s RECORD; account_id UUID; total INTEGER:=0;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 FOR s IN SELECT se.*,sr.hold_hours,dp.validated_at FROM public.settlement_entries se JOIN public.delivery_proofs dp ON dp.id=se.delivery_proof_id
   JOIN public.media_commercial_contracts c ON c.id=se.commercial_contract_id JOIN public.settlement_rules sr ON sr.id=c.settlement_rule_id
   WHERE se.status='pending' AND dp.status='validated' AND dp.validated_at+make_interval(hours=>sr.hold_hours)<=p_now FOR UPDATE OF se LOOP
   account_id:=public.mpm_ensure_holder_account(s.supplier_holder_type,s.supplier_holder_id,'earned');
   PERFORM public._mpm_post_entry(account_id,'available','transfer',s.supplier_net_credits,s.supplier_net_credits,-s.supplier_net_credits,0,'delivery_proof',s.delivery_proof_id,
     'omni:'||s.id::text||':available',s.campaign_id,NULL,s.id,NULL,'{}');
   UPDATE public.settlement_entries SET status='earned',settled_at=p_now WHERE id=s.id; total:=total+1;
 END LOOP; RETURN total;
END $$;

GRANT EXECUTE ON FUNCTION public.create_media_commercial_contract(UUID,UUID,TEXT,UUID,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_validated_delivery_proof(UUID,TEXT,UUID,NUMERIC,TIMESTAMPTZ,JSONB,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_pending_mpm_settlements(TIMESTAMPTZ) TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.media_commercial_contracts,public.delivery_proofs FROM authenticated;
