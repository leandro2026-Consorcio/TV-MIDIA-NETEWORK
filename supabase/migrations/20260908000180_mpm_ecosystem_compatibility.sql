-- Compatibilidade incremental entre a carteira empresarial do Pacote 1 e titulares genéricos.

CREATE OR REPLACE FUNCTION public.mpm_ensure_account(p_company_id UUID,p_credit_class TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id UUID;
BEGIN
 IF p_credit_class NOT IN ('earned','purchased','promotional','legacy_organic') THEN RAISE EXCEPTION 'Classe de crédito inválida.'; END IF;
 INSERT INTO public.wallet_accounts(company_id,holder_type,holder_id,credit_class)
 VALUES(p_company_id,'company',p_company_id,p_credit_class)
 ON CONFLICT (company_id,credit_class) DO UPDATE SET holder_type='company',holder_id=EXCLUDED.holder_id
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE TABLE public.affiliate_profiles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
 company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
 display_name TEXT NOT NULL,
 affiliate_type TEXT NOT NULL CHECK (affiliate_type IN ('screens','companies','advertisers','creators','partners','general')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','suspended','archived')),
 attribution_code TEXT NOT NULL UNIQUE,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (user_id IS NOT NULL OR company_id IS NOT NULL)
);
ALTER TABLE public.affiliate_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliate self read" ON public.affiliate_profiles FOR SELECT TO authenticated
USING (user_id=auth.uid() OR company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());

CREATE OR REPLACE FUNCTION public.record_legacy_balance_observation(
 p_legacy_source TEXT,p_legacy_record_id UUID,p_holder_type TEXT,p_holder_id UUID,p_observed_amount NUMERIC,p_observed_unit TEXT,p_metadata JSONB DEFAULT '{}'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE rid UUID;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 INSERT INTO public.legacy_balance_reconciliations(legacy_source,legacy_record_id,holder_type,holder_id,observed_amount,observed_unit,metadata)
 VALUES(p_legacy_source,p_legacy_record_id,p_holder_type,p_holder_id,p_observed_amount,p_observed_unit,COALESCE(p_metadata,'{}'))
 ON CONFLICT(legacy_source,legacy_record_id) DO UPDATE SET observed_amount=EXCLUDED.observed_amount,observed_unit=EXCLUDED.observed_unit,
   metadata=EXCLUDED.metadata,observed_at=now()
 RETURNING id INTO rid;
 RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.expire_mpm_reservations(p_now TIMESTAMPTZ DEFAULT now())
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r RECORD; total INTEGER:=0;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 FOR r IN SELECT id FROM public.wallet_reservations WHERE status='active' AND expires_at IS NOT NULL AND expires_at<=p_now FOR UPDATE LOOP
   PERFORM public.mpm_release_reservation(r.id,'expiry:'||r.id::text); total:=total+1;
 END LOOP;
 RETURN total;
END $$;

CREATE OR REPLACE FUNCTION public.run_mpm_maintenance(p_run_key TEXT DEFAULT to_char(now(),'YYYY-MM-DD-HH24'))
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE jid UUID; expired_alloc INTEGER:=0; expired_wallet INTEGER:=0; expired_quotes INTEGER:=0; ended_events INTEGER:=0; expired_entitlements INTEGER:=0; released_owner BIGINT:=0; cp RECORD;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 INSERT INTO public.mpm_job_runs(job_name,run_key,status) VALUES('mpm_maintenance',p_run_key,'running')
 ON CONFLICT(job_name,run_key) DO UPDATE SET run_key=EXCLUDED.run_key RETURNING id INTO jid;
 IF (SELECT status FROM public.mpm_job_runs WHERE id=jid)='completed' THEN RETURN (SELECT counters||jsonb_build_object('deduplicated',true) FROM public.mpm_job_runs WHERE id=jid); END IF;
 expired_alloc:=public.expire_inventory_allocations(); expired_wallet:=public.expire_mpm_reservations(now());
 UPDATE public.media_price_quotes SET status='expired' WHERE status='quoted' AND expires_at<=now(); GET DIAGNOSTICS expired_quotes=ROW_COUNT;
 UPDATE public.events SET status='ended',updated_at=now() WHERE status='active' AND ends_at<=now(); GET DIAGNOSTICS ended_events=ROW_COUNT;
 UPDATE public.event_inventory ei SET status='ended' FROM public.events e WHERE e.id=ei.event_id AND e.status='ended' AND ei.status='active';
 UPDATE public.media_inventory mi SET status='inactive',commercial_enabled=false,updated_at=now() FROM public.event_inventory ei WHERE ei.media_inventory_id=mi.id AND ei.status='ended';
 UPDATE public.entitlement_periods SET status='expired',released_quantity=granted_quantity-used_quantity WHERE status='active' AND period_end<current_date; GET DIAGNOSTICS expired_entitlements=ROW_COUNT;
 FOR cp IN SELECT id FROM public.inventory_capacity_periods WHERE status='active' LOOP BEGIN released_owner:=released_owner+public.release_unused_owner_capacity(cp.id,now()); EXCEPTION WHEN OTHERS THEN NULL; END; END LOOP;
 UPDATE public.mpm_job_runs SET status='completed',completed_at=now(),counters=jsonb_build_object('expired_allocations',expired_alloc,'expired_wallet_reservations',expired_wallet,
   'expired_quotes',expired_quotes,'ended_events',ended_events,'expired_entitlements',expired_entitlements,'released_owner_capacity',released_owner) WHERE id=jid;
 RETURN (SELECT counters FROM public.mpm_job_runs WHERE id=jid);
EXCEPTION WHEN OTHERS THEN UPDATE public.mpm_job_runs SET status='failed',completed_at=now(),error_message=SQLERRM WHERE id=jid; RAISE;
END $$;

GRANT EXECUTE ON FUNCTION public.record_legacy_balance_observation(TEXT,UUID,TEXT,UUID,NUMERIC,TEXT,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_mpm_reservations(TIMESTAMPTZ) TO service_role;
