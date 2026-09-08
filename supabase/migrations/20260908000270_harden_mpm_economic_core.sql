-- Correções finais do core econômico: scoring configurável, entitlement vinculado,
-- reversão de comissão e redução da superfície de RPCs administrativas.

INSERT INTO public.platform_settings(key,value,description) VALUES
  ('creator_score_tiers','{"starter":{"creator_score":0,"media_value_score":0},"growth":{"creator_score":50,"media_value_score":0},"pro":{"creator_score":70,"media_value_score":60},"elite":{"creator_score":85,"media_value_score":80}}'::jsonb,
   'Thresholds versionáveis de tier; o maior tier cujos mínimos forem atendidos é aplicado.')
ON CONFLICT(key) DO UPDATE SET description=EXCLUDED.description;

ALTER TABLE public.creator_score_history
  DROP CONSTRAINT IF EXISTS creator_score_history_snapshot_id_key;
ALTER TABLE public.creator_score_history
  ADD COLUMN IF NOT EXISTS configuration_fingerprint TEXT;
UPDATE public.creator_score_history
SET configuration_fingerprint='legacy-'||id::text
WHERE configuration_fingerprint IS NULL;
ALTER TABLE public.creator_score_history
  ALTER COLUMN configuration_fingerprint SET NOT NULL;
ALTER TABLE public.creator_score_history
  ADD CONSTRAINT creator_score_history_snapshot_formula_config_key
  UNIQUE(snapshot_id,formula_version,configuration_fingerprint);

CREATE OR REPLACE FUNCTION public.recalculate_creator_score(
  p_creator_id UUID,
  p_snapshot_id UUID,
  p_formula_version TEXT DEFAULT 'creator-v2-configurable'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  s public.creator_metric_snapshots%ROWTYPE;
  creator_weights JSONB;
  media_weights JSONB;
  tiers JSONB;
  components JSONB;
  creator_weight_total NUMERIC:=0;
  creator_weighted_total NUMERIC:=0;
  media_weight_total NUMERIC:=0;
  media_weighted_total NUMERIC:=0;
  reliability NUMERIC;
  delivery NUMERIC;
  engagement NUMERIC;
  local_relevance NUMERIC;
  reach_score NUMERIC;
  niche NUMERIC;
  performance NUMERIC;
  weight_value NUMERIC;
  cs NUMERIC(7,2);
  mvs NUMERIC(7,2);
  tier_name TEXT:='starter';
  next_requirements JSONB:='{}'::jsonb;
  fingerprint TEXT;
  hid UUID;
  stored RECORD;
  campaign_total INTEGER;
BEGIN
  IF NOT (auth.role()='service_role' OR public.is_master_admin() OR EXISTS(
    SELECT 1 FROM public.creator_profiles WHERE id=p_creator_id AND user_id=auth.uid()
  )) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT * INTO s FROM public.creator_metric_snapshots
  WHERE id=p_snapshot_id AND creator_id=p_creator_id FOR SHARE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Snapshot inválido.'; END IF;

  SELECT value INTO creator_weights FROM public.platform_settings WHERE key='creator_score_weights';
  SELECT value INTO media_weights FROM public.platform_settings WHERE key='media_value_score_weights';
  SELECT value INTO tiers FROM public.platform_settings WHERE key='creator_score_tiers';
  IF creator_weights IS NULL OR media_weights IS NULL OR tiers IS NULL THEN
    RAISE EXCEPTION 'Configuração de score incompleta.';
  END IF;

  campaign_total:=s.completed_campaigns+s.delayed_campaigns+s.refused_campaigns;
  delivery:=CASE WHEN campaign_total>0 THEN 100.0*s.completed_campaigns/campaign_total END;
  reliability:=CASE WHEN s.advertiser_rating IS NOT NULL THEN LEAST(100,GREATEST(0,s.advertiser_rating*20)) END;
  engagement:=LEAST(100,GREATEST(0,s.engagement_rate*10));
  local_relevance:=LEAST(100,GREATEST(0,s.local_relevance));
  reach_score:=CASE WHEN s.followers>0 THEN LEAST(100,ln(s.followers+1)/ln(1000001)*100) END;
  niche:=CASE WHEN jsonb_typeof(s.metrics->'niche_relevance')='number'
    THEN LEAST(100,GREATEST(0,(s.metrics->>'niche_relevance')::numeric)) END;
  performance:=COALESCE(reliability,delivery);

  weight_value:=COALESCE((creator_weights->>'reliability')::numeric,0);
  IF weight_value<0 THEN RAISE EXCEPTION 'Peso reliability inválido.'; END IF;
  IF reliability IS NOT NULL AND weight_value>0 THEN creator_weight_total:=creator_weight_total+weight_value; creator_weighted_total:=creator_weighted_total+reliability*weight_value; END IF;
  weight_value:=COALESCE((creator_weights->>'delivery')::numeric,0);
  IF weight_value<0 THEN RAISE EXCEPTION 'Peso delivery inválido.'; END IF;
  IF delivery IS NOT NULL AND weight_value>0 THEN creator_weight_total:=creator_weight_total+weight_value; creator_weighted_total:=creator_weighted_total+delivery*weight_value; END IF;
  weight_value:=COALESCE((creator_weights->>'engagement')::numeric,0);
  IF weight_value<0 THEN RAISE EXCEPTION 'Peso engagement inválido.'; END IF;
  IF weight_value>0 THEN creator_weight_total:=creator_weight_total+weight_value; creator_weighted_total:=creator_weighted_total+engagement*weight_value; END IF;
  weight_value:=COALESCE((creator_weights->>'local_relevance')::numeric,0);
  IF weight_value<0 THEN RAISE EXCEPTION 'Peso local_relevance inválido.'; END IF;
  IF weight_value>0 THEN creator_weight_total:=creator_weight_total+weight_value; creator_weighted_total:=creator_weighted_total+local_relevance*weight_value; END IF;

  weight_value:=COALESCE((media_weights->>'reach')::numeric,0);
  IF weight_value<0 THEN RAISE EXCEPTION 'Peso reach inválido.'; END IF;
  IF reach_score IS NOT NULL AND weight_value>0 THEN media_weight_total:=media_weight_total+weight_value; media_weighted_total:=media_weighted_total+reach_score*weight_value; END IF;
  weight_value:=COALESCE((media_weights->>'engagement')::numeric,0);
  IF weight_value<0 THEN RAISE EXCEPTION 'Peso engagement inválido.'; END IF;
  IF weight_value>0 THEN media_weight_total:=media_weight_total+weight_value; media_weighted_total:=media_weighted_total+engagement*weight_value; END IF;
  weight_value:=COALESCE((media_weights->>'region')::numeric,COALESCE((media_weights->>'local_relevance')::numeric,0));
  IF weight_value<0 THEN RAISE EXCEPTION 'Peso region inválido.'; END IF;
  IF weight_value>0 THEN media_weight_total:=media_weight_total+weight_value; media_weighted_total:=media_weighted_total+local_relevance*weight_value; END IF;
  weight_value:=COALESCE((media_weights->>'niche')::numeric,0);
  IF weight_value<0 THEN RAISE EXCEPTION 'Peso niche inválido.'; END IF;
  IF niche IS NOT NULL AND weight_value>0 THEN media_weight_total:=media_weight_total+weight_value; media_weighted_total:=media_weighted_total+niche*weight_value; END IF;
  weight_value:=COALESCE((media_weights->>'performance')::numeric,COALESCE((media_weights->>'reliability')::numeric,0));
  IF weight_value<0 THEN RAISE EXCEPTION 'Peso performance inválido.'; END IF;
  IF performance IS NOT NULL AND weight_value>0 THEN media_weight_total:=media_weight_total+weight_value; media_weighted_total:=media_weighted_total+performance*weight_value; END IF;

  IF creator_weight_total<=0 OR media_weight_total<=0 THEN RAISE EXCEPTION 'Configuração sem fatores disponíveis.'; END IF;
  cs:=round(LEAST(100,GREATEST(0,creator_weighted_total/creator_weight_total)),2);
  mvs:=round(LEAST(100,GREATEST(0,media_weighted_total/media_weight_total)),2);

  IF cs>=COALESCE((tiers#>>'{elite,creator_score}')::numeric,101) AND mvs>=COALESCE((tiers#>>'{elite,media_value_score}')::numeric,101) THEN tier_name:='elite';
  ELSIF cs>=COALESCE((tiers#>>'{pro,creator_score}')::numeric,101) AND mvs>=COALESCE((tiers#>>'{pro,media_value_score}')::numeric,101) THEN tier_name:='pro';
  ELSIF cs>=COALESCE((tiers#>>'{growth,creator_score}')::numeric,101) AND mvs>=COALESCE((tiers#>>'{growth,media_value_score}')::numeric,101) THEN tier_name:='growth';
  END IF;
  next_requirements:=CASE tier_name WHEN 'starter' THEN COALESCE(tiers->'growth','{}'::jsonb) WHEN 'growth' THEN COALESCE(tiers->'pro','{}'::jsonb) WHEN 'pro' THEN COALESCE(tiers->'elite','{}'::jsonb) ELSE '{}'::jsonb END;
  fingerprint:=md5(creator_weights::text||'|'||media_weights::text||'|'||tiers::text||'|'||p_formula_version);
  components:=jsonb_build_object(
    'configuration_fingerprint',fingerprint,
    'creator_weights',creator_weights,
    'media_value_weights',media_weights,
    'tier_thresholds',tiers,
    'creator_score',jsonb_build_object(
      'reliability',jsonb_build_object('used',reliability IS NOT NULL AND COALESCE((creator_weights->>'reliability')::numeric,0)>0,'value',reliability),
      'delivery',jsonb_build_object('used',delivery IS NOT NULL AND COALESCE((creator_weights->>'delivery')::numeric,0)>0,'value',delivery),
      'engagement',jsonb_build_object('used',COALESCE((creator_weights->>'engagement')::numeric,0)>0,'value',engagement),
      'local_relevance',jsonb_build_object('used',COALESCE((creator_weights->>'local_relevance')::numeric,0)>0,'value',local_relevance),
      'normalized_weight_total',creator_weight_total),
    'media_value_score',jsonb_build_object(
      'reach',jsonb_build_object('used',reach_score IS NOT NULL AND COALESCE((media_weights->>'reach')::numeric,0)>0,'value',reach_score),
      'engagement',jsonb_build_object('used',COALESCE((media_weights->>'engagement')::numeric,0)>0,'value',engagement),
      'region',jsonb_build_object('used',COALESCE((media_weights->>'region')::numeric,COALESCE((media_weights->>'local_relevance')::numeric,0))>0,'value',local_relevance),
      'niche',jsonb_build_object('used',niche IS NOT NULL AND COALESCE((media_weights->>'niche')::numeric,0)>0,'value',niche),
      'performance',jsonb_build_object('used',performance IS NOT NULL AND COALESCE((media_weights->>'performance')::numeric,COALESCE((media_weights->>'reliability')::numeric,0))>0,'value',performance),
      'normalized_weight_total',media_weight_total));

  INSERT INTO public.creator_score_history(creator_id,snapshot_id,creator_score,media_value_score,tier,formula_version,configuration_fingerprint,score_components,next_tier_requirements)
  VALUES(p_creator_id,s.id,cs,mvs,tier_name,p_formula_version,fingerprint,components,next_requirements)
  ON CONFLICT(snapshot_id,formula_version,configuration_fingerprint) DO NOTHING
  RETURNING id,creator_score,media_value_score,tier INTO hid,cs,mvs,tier_name;
  IF hid IS NULL THEN
    SELECT id,creator_score,media_value_score,tier INTO stored
    FROM public.creator_score_history
    WHERE snapshot_id=s.id AND formula_version=p_formula_version AND configuration_fingerprint=fingerprint;
    hid:=stored.id; cs:=stored.creator_score; mvs:=stored.media_value_score; tier_name:=stored.tier;
  END IF;
  UPDATE public.creator_profiles SET creator_score=cs,media_value_score=mvs,tier=tier_name,updated_at=now() WHERE id=p_creator_id;
  RETURN jsonb_build_object('history_id',hid,'creator_score',cs,'media_value_score',mvs,'tier',tier_name,'formula_version',p_formula_version,'configuration_fingerprint',fingerprint);
END $$;

CREATE OR REPLACE FUNCTION public.consume_inventory_entitlement(
  p_entitlement_period_id UUID,p_campaign_id UUID,p_quantity BIGINT,p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  ep public.entitlement_periods%ROWTYPE;
  ent public.inventory_entitlements%ROWTYPE;
  campaign public.campaigns%ROWTYPE;
  existing public.quota_usage%ROWTYPE;
  qid UUID;
BEGIN
  IF NULLIF(trim(p_idempotency_key),'') IS NULL OR p_quantity<=0 THEN RAISE EXCEPTION 'Consumo de cota inválido.'; END IF;
  SELECT * INTO ep FROM public.entitlement_periods WHERE id=p_entitlement_period_id FOR UPDATE;
  IF ep.id IS NULL OR ep.status<>'active' OR current_date NOT BETWEEN ep.period_start AND ep.period_end THEN RAISE EXCEPTION 'Período de direito inválido.'; END IF;
  SELECT * INTO ent FROM public.inventory_entitlements WHERE id=ep.entitlement_id FOR SHARE;
  IF ent.id IS NULL OR ent.status<>'active' OR now()<ent.starts_at OR (ent.ends_at IS NOT NULL AND now()>ent.ends_at) THEN RAISE EXCEPTION 'Entitlement inativo ou fora da vigência.'; END IF;
  IF NOT public.mpm_can_manage_holder(ent.beneficiary_type,ent.beneficiary_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO campaign FROM public.campaigns WHERE id=p_campaign_id FOR SHARE;
  IF campaign.id IS NULL THEN RAISE EXCEPTION 'Campanha inexistente.'; END IF;
  IF campaign.status NOT IN ('scheduled','active') THEN RAISE EXCEPTION 'Campanha não está elegível para consumo de cota.'; END IF;
  IF ent.beneficiary_type='company' AND campaign.company_id<>ent.beneficiary_id AND campaign.buyer_company_id IS DISTINCT FROM ent.beneficiary_id THEN
    RAISE EXCEPTION 'Campanha não pertence ao beneficiário do entitlement.';
  ELSIF ent.beneficiary_type<>'company' AND NOT EXISTS(
    SELECT 1 FROM public.media_commercial_contracts c
    WHERE c.campaign_id=campaign.id AND c.supplier_holder_type=ent.beneficiary_type AND c.supplier_holder_id=ent.beneficiary_id
      AND c.status IN ('reserved','active','completed')
  ) THEN
    RAISE EXCEPTION 'Campanha não está vinculada ao beneficiário do entitlement.';
  END IF;
  IF COALESCE(campaign.end_date,current_date)<ep.period_start OR COALESCE(campaign.start_date,current_date)>ep.period_end THEN
    RAISE EXCEPTION 'Campanha fora do período do entitlement.';
  END IF;
  IF ent.inventory_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.inventory_allocations a
    WHERE a.campaign_id=campaign.id AND a.inventory_id=ent.inventory_id
      AND a.status NOT IN ('cancelled','released','expired')
  ) THEN RAISE EXCEPTION 'Campanha incompatível com o inventário do entitlement.'; END IF;
  SELECT * INTO existing FROM public.quota_usage WHERE idempotency_key=p_idempotency_key;
  IF existing.id IS NOT NULL THEN
    IF existing.entitlement_period_id<>ep.id OR existing.campaign_id IS DISTINCT FROM campaign.id OR existing.quantity<>p_quantity THEN
      RAISE EXCEPTION 'Chave de idempotência já utilizada com parâmetros diferentes.';
    END IF;
    RETURN existing.id;
  END IF;
  IF ep.used_quantity+ep.released_quantity+p_quantity>ep.granted_quantity THEN RAISE EXCEPTION 'Cota insuficiente.'; END IF;
  INSERT INTO public.quota_usage(entitlement_period_id,campaign_id,quantity,idempotency_key)
  VALUES(ep.id,campaign.id,p_quantity,p_idempotency_key) RETURNING id INTO qid;
  UPDATE public.entitlement_periods SET used_quantity=used_quantity+p_quantity WHERE id=ep.id;
  RETURN qid;
END $$;

ALTER TABLE public.recurring_commissions
  ADD COLUMN IF NOT EXISTS reversal_ledger_id UUID REFERENCES public.wallet_ledger(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS outstanding_debit_credits NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(outstanding_debit_credits>=0),
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

CREATE OR REPLACE FUNCTION public.reverse_partner_commissions_for_settlement(
  p_settlement_id UUID,p_reason TEXT,p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  c public.recurring_commissions%ROWTYPE;
  credit_entry public.wallet_ledger%ROWTYPE;
  account public.wallet_accounts%ROWTYPE;
  debit_amount NUMERIC(18,4);
  outstanding NUMERIC(18,4);
  reversal_id UUID;
  reversed_count INTEGER:=0;
  receivable_total NUMERIC(18,4):=0;
BEGIN
  IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF NULLIF(trim(p_reason),'') IS NULL OR NULLIF(trim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Motivo e idempotência são obrigatórios.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('commission-settlement-reversal:'||p_settlement_id::text,0));
  FOR c IN SELECT * FROM public.recurring_commissions
    WHERE source_type='settlement_entry' AND source_id=p_settlement_id AND status IN ('pending','available')
    FOR UPDATE
  LOOP
    reversal_id:=NULL; outstanding:=0;
    IF c.status='available' THEN
      SELECT * INTO credit_entry FROM public.wallet_ledger
      WHERE source_type='recurring_commission' AND source_id=c.id AND entry_type='commission' AND direction='credit'
      ORDER BY created_at LIMIT 1 FOR SHARE;
      IF credit_entry.id IS NULL THEN RAISE EXCEPTION 'Crédito da comissão % não encontrado no ledger.',c.id; END IF;
      SELECT * INTO account FROM public.wallet_accounts WHERE id=credit_entry.account_id FOR UPDATE;
      debit_amount:=LEAST(account.available_balance,c.amount_credits);
      outstanding:=c.amount_credits-debit_amount;
      IF debit_amount>0 THEN
        reversal_id:=public._mpm_post_entry(account.id,'reversal','debit',debit_amount,-debit_amount,0,0,
          'recurring_commission_reversal',c.id,p_idempotency_key||':'||c.id::text,NULL,NULL,p_settlement_id,credit_entry.id,
          jsonb_build_object('reason',p_reason,'commission_id',c.id,'settlement_id',p_settlement_id,'partial',outstanding>0));
      END IF;
    END IF;
    UPDATE public.recurring_commissions SET status='reversed',reversal_ledger_id=reversal_id,
      outstanding_debit_credits=outstanding,reversed_at=now(),reversal_reason=p_reason WHERE id=c.id;
    reversed_count:=reversed_count+1; receivable_total:=receivable_total+outstanding;
  END LOOP;
  RETURN jsonb_build_object('reversed_commissions',reversed_count,'outstanding_debit_credits',receivable_total,'deduplicated',reversed_count=0);
END $$;

CREATE OR REPLACE FUNCTION public.reverse_commissions_after_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
BEGIN
  IF NEW.status='reversed' AND OLD.status<>'reversed' THEN
    PERFORM public.reverse_partner_commissions_for_settlement(NEW.id,
      COALESCE(NULLIF(NEW.metadata->>'reversal_reason',''),'Settlement revertido.'),
      'settlement-reversal:'||NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reverse_commissions_after_settlement ON public.settlement_entries;
CREATE TRIGGER trg_reverse_commissions_after_settlement
AFTER UPDATE OF status ON public.settlement_entries
FOR EACH ROW EXECUTE FUNCTION public.reverse_commissions_after_settlement();

-- RPCs que criam/revertem valor arbitrário são exclusivamente internas.
REVOKE ALL ON FUNCTION public.mpm_grant_credits(UUID,TEXT,NUMERIC,TEXT,UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mpm_reverse_ledger_entry(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reverse_partner_commissions_for_settlement(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reverse_commissions_after_settlement() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.accrue_partner_commission(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_partner_commissions(TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_validated_delivery_proof(UUID,TEXT,UUID,NUMERIC,TIMESTAMPTZ,JSONB,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_pending_mpm_settlements(TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.run_mpm_ecosystem_jobs(TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.run_mpm_maintenance(TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reconcile_legacy_balances() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.requalify_creators() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.expire_mpm_reservations(TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public._mpm_post_entry(UUID,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,UUID,TEXT,UUID,UUID,UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mpm_ensure_account(UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mpm_ensure_holder_account(TEXT,UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.mpm_grant_credits(UUID,TEXT,NUMERIC,TEXT,UUID,TEXT,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.mpm_reverse_ledger_entry(UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_partner_commissions_for_settlement(UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.accrue_partner_commission(UUID,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_partner_commissions(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_validated_delivery_proof(UUID,TEXT,UUID,NUMERIC,TIMESTAMPTZ,JSONB,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_pending_mpm_settlements(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_mpm_ecosystem_jobs(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_mpm_maintenance(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_legacy_balances() TO service_role;
GRANT EXECUTE ON FUNCTION public.requalify_creators() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_mpm_reservations(TIMESTAMPTZ) TO service_role;

-- RPCs de usuário continuam disponíveis, sempre com ownership validado internamente.
REVOKE ALL ON FUNCTION public.consume_inventory_entitlement(UUID,UUID,BIGINT,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.recalculate_creator_score(UUID,UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consume_inventory_entitlement(UUID,UUID,BIGINT,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_creator_score(UUID,UUID,TEXT) TO authenticated,service_role;
