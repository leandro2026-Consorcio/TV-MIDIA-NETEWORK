-- Comissões liquidadas, reconciliação sem conversão e orquestração de jobs.

CREATE OR REPLACE FUNCTION public.accrue_partner_commission(
 p_attribution_id UUID,p_settlement_id UUID,p_period_reference TEXT,p_idempotency_key TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.acquisition_attributions%ROWTYPE; p public.partner_programs%ROWTYPE; s public.settlement_entries%ROWTYPE; amount NUMERIC(18,4); accrued NUMERIC; cid UUID;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 SELECT * INTO a FROM public.acquisition_attributions WHERE id=p_attribution_id FOR SHARE;
 SELECT * INTO p FROM public.partner_programs WHERE id=a.program_id AND status='active' AND now() BETWEEN starts_at AND COALESCE(ends_at,'infinity') FOR SHARE;
 SELECT * INTO s FROM public.settlement_entries WHERE id=p_settlement_id AND status='earned' FOR SHARE;
 IF a.id IS NULL OR p.id IS NULL OR s.id IS NULL THEN RAISE EXCEPTION 'Atribuição, programa ou operação liquidada inválida.'; END IF;
 IF p.reward_type='recurring_percentage' THEN amount:=round(s.platform_fee_credits*p.reward_value/100,4);
 ELSIF p.reward_type IN ('fixed','mpm_credit') THEN amount:=p.reward_value;
 ELSE RAISE EXCEPTION 'Programa não gera comissão monetária.'; END IF;
 SELECT COALESCE(sum(amount_credits),0) INTO accrued FROM public.recurring_commissions WHERE attribution_id=a.id AND status NOT IN ('reversed','cancelled');
 IF p.reward_cap IS NOT NULL THEN amount:=LEAST(amount,GREATEST(0,p.reward_cap-accrued)); END IF;
 IF amount<=0 THEN RAISE EXCEPTION 'Comissão sem valor disponível.'; END IF;
 INSERT INTO public.recurring_commissions(program_id,attribution_id,beneficiary_type,beneficiary_id,source_type,source_id,amount_credits,period_reference,status,idempotency_key,available_at)
 VALUES(p.id,a.id,a.attributed_holder_type,a.attributed_holder_id,'settlement_entry',s.id,amount,p_period_reference,'pending',p_idempotency_key,now())
 ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id INTO cid;
 RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.release_partner_commissions(p_now TIMESTAMPTZ DEFAULT now())
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c RECORD; aid UUID; total INTEGER:=0;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 FOR c IN SELECT * FROM public.recurring_commissions WHERE status='pending' AND available_at<=p_now FOR UPDATE LOOP
  aid:=public.mpm_ensure_holder_account(c.beneficiary_type,c.beneficiary_id,'earned');
  PERFORM public._mpm_post_entry(aid,'commission','credit',c.amount_credits,c.amount_credits,0,0,'recurring_commission',c.id,'commission:'||c.id::text,NULL,NULL,NULL,NULL,jsonb_build_object('program_id',c.program_id));
  UPDATE public.recurring_commissions SET status='available' WHERE id=c.id; total:=total+1;
 END LOOP; RETURN total;
END $$;

CREATE OR REPLACE FUNCTION public.requalify_creators()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r RECORD; total INTEGER:=0;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 FOR r IN SELECT DISTINCT ON (s.creator_id) s.creator_id,s.id FROM public.creator_metric_snapshots s
   LEFT JOIN public.creator_score_history h ON h.snapshot_id=s.id WHERE h.id IS NULL ORDER BY s.creator_id,s.captured_at DESC LOOP
  PERFORM public.recalculate_creator_score(r.creator_id,r.id,'creator-v1'); total:=total+1;
 END LOOP; RETURN total;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_legacy_balances()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wallet_count INTEGER; seller_count INTEGER; organic_count INTEGER;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 INSERT INTO public.legacy_balance_reconciliations(legacy_source,legacy_record_id,holder_type,holder_id,observed_amount,observed_unit,metadata)
 SELECT 'wallets',w.id,'company',w.company_id,w.balance,'legacy_credit','{"converted":false}' FROM public.wallets w
 ON CONFLICT(legacy_source,legacy_record_id) DO UPDATE SET observed_amount=EXCLUDED.observed_amount,observed_at=now(); GET DIAGNOSTICS wallet_count=ROW_COUNT;
 INSERT INTO public.legacy_balance_reconciliations(legacy_source,legacy_record_id,holder_type,holder_id,observed_amount,observed_unit,metadata)
 SELECT 'seller_financial_ledger',s.id,'company',s.seller_company_id,s.amount_available_cents,'brl_centavos','{"converted":false}' FROM public.seller_financial_ledger s
 ON CONFLICT(legacy_source,legacy_record_id) DO UPDATE SET observed_amount=EXCLUDED.observed_amount,observed_at=now(); GET DIAGNOSTICS seller_count=ROW_COUNT;
 INSERT INTO public.legacy_balance_reconciliations(legacy_source,legacy_record_id,holder_type,holder_id,observed_amount,observed_unit,metadata)
 SELECT 'organic_credit_ledger',o.id,'organic_participant',o.participant_id,o.amount,'organic_microcredit','{"converted":false,"factor_preserved":0.01}' FROM public.organic_credit_ledger o
 ON CONFLICT(legacy_source,legacy_record_id) DO UPDATE SET observed_amount=EXCLUDED.observed_amount,observed_at=now(); GET DIAGNOSTICS organic_count=ROW_COUNT;
 RETURN jsonb_build_object('wallets',wallet_count,'seller_financial_ledger',seller_count,'organic_credit_ledger',organic_count,'converted',false);
END $$;

CREATE OR REPLACE FUNCTION public.run_mpm_ecosystem_jobs(p_run_key TEXT DEFAULT to_char(now(),'YYYY-MM-DD-HH24'))
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE jid UUID; core JSONB; settlements INTEGER; commissions INTEGER; creators INTEGER; reconciliation JSONB;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 INSERT INTO public.mpm_job_runs(job_name,run_key,status) VALUES('mpm_ecosystem',p_run_key,'running')
 ON CONFLICT(job_name,run_key) DO UPDATE SET run_key=EXCLUDED.run_key RETURNING id INTO jid;
 IF (SELECT status FROM public.mpm_job_runs WHERE id=jid)='completed' THEN RETURN (SELECT counters||jsonb_build_object('deduplicated',true) FROM public.mpm_job_runs WHERE id=jid); END IF;
 core:=public.run_mpm_maintenance(p_run_key||':core'); settlements:=public.release_pending_mpm_settlements(now()); commissions:=public.release_partner_commissions(now());
 creators:=public.requalify_creators(); reconciliation:=public.reconcile_legacy_balances();
 UPDATE public.mpm_job_runs SET status='completed',completed_at=now(),counters=jsonb_build_object('core',core,'settlements_released',settlements,'commissions_released',commissions,'creators_requalified',creators,'reconciliation',reconciliation) WHERE id=jid;
 RETURN (SELECT counters FROM public.mpm_job_runs WHERE id=jid);
EXCEPTION WHEN OTHERS THEN UPDATE public.mpm_job_runs SET status='failed',completed_at=now(),error_message=SQLERRM WHERE id=jid; RAISE;
END $$;

GRANT EXECUTE ON FUNCTION public.accrue_partner_commission(UUID,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_partner_commissions(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.requalify_creators() TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_legacy_balances() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_mpm_ecosystem_jobs(TEXT) TO service_role;
