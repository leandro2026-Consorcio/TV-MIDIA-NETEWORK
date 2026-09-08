-- Crédito MPM V2: ledger imutável, reservas, liquidação por Proof of Delivery
-- e pagamento de mídia/assinatura. Nenhum saldo legado é convertido.

CREATE TABLE public.platform_fee_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('media_sale', 'subscription')),
  percentage NUMERIC(7,4) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

INSERT INTO public.platform_fee_rules(code, operation_type, percentage, effective_from, metadata)
VALUES ('mpm-media-standard-v2', 'media_sale', 10.0000, now(),
  jsonb_build_object('nominal_credit_brl', 1, 'commercial_reference', '2000 inserções ≈ 500 créditos'));

CREATE TABLE public.wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  credit_class TEXT NOT NULL CHECK (credit_class IN ('earned', 'purchased', 'promotional', 'legacy_organic')),
  available_balance NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  reserved_balance NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, credit_class)
);

CREATE TABLE public.wallet_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK (purpose IN ('media_purchase', 'monthly_subscription', 'annual_subscription')),
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'released', 'cancelled')),
  source_type TEXT NOT NULL,
  source_id UUID,
  allocation_id UUID REFERENCES public.inventory_allocations(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(trim(idempotency_key)) > 0),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.wallet_reservation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.wallet_reservations(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.wallet_accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  consumed_ledger_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reservation_id, account_id)
);

CREATE TABLE public.settlement_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  buyer_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.ad_offer_orders(id) ON DELETE RESTRICT,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  playback_log_id UUID NOT NULL REFERENCES public.playback_logs(id) ON DELETE RESTRICT,
  allocation_id UUID REFERENCES public.inventory_allocations(id) ON DELETE SET NULL,
  fee_rule_id UUID NOT NULL REFERENCES public.platform_fee_rules(id) ON DELETE RESTRICT,
  delivered_units NUMERIC(18,4) NOT NULL CHECK (delivered_units > 0),
  gross_credits NUMERIC(18,4) NOT NULL CHECK (gross_credits >= 0),
  platform_fee_credits NUMERIC(18,4) NOT NULL CHECK (platform_fee_credits >= 0),
  supplier_net_credits NUMERIC(18,4) NOT NULL CHECK (supplier_net_credits >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'earned', 'reversed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  UNIQUE(campaign_id, playback_log_id),
  CHECK (gross_credits = platform_fee_credits + supplier_net_credits)
);

CREATE TABLE public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.wallet_accounts(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  credit_class TEXT NOT NULL CHECK (credit_class IN ('earned', 'purchased', 'promotional', 'legacy_organic')),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('grant', 'reserve', 'consume', 'release', 'settlement_gross', 'platform_fee', 'earned', 'subscription_payment', 'reversal')),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit', 'transfer', 'informational')),
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  available_balance_after NUMERIC(18,4) NOT NULL CHECK (available_balance_after >= 0),
  pending_balance_after NUMERIC(18,4) NOT NULL CHECK (pending_balance_after >= 0),
  reserved_balance_after NUMERIC(18,4) NOT NULL CHECK (reserved_balance_after >= 0),
  source_type TEXT NOT NULL,
  source_id UUID,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  settlement_id UUID REFERENCES public.settlement_entries(id) ON DELETE SET NULL,
  reverses_entry_id UUID UNIQUE REFERENCES public.wallet_ledger(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(trim(idempotency_key)) > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_reservation_lines
  ADD CONSTRAINT wallet_reservation_lines_consumed_ledger_fkey
  FOREIGN KEY (consumed_ledger_id) REFERENCES public.wallet_ledger(id) ON DELETE RESTRICT;

CREATE TABLE public.mpm_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  reservation_id UUID NOT NULL REFERENCES public.wallet_reservations(id) ON DELETE RESTRICT,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  billing_reference TEXT NOT NULL,
  amount_credits NUMERIC(18,4) NOT NULL CHECK (amount_credits > 0),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'reversed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_offer_orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'legacy' CHECK (payment_method IN ('legacy', 'asaas', 'manual', 'mpm_credits')),
  ADD COLUMN IF NOT EXISTS wallet_reservation_id UUID REFERENCES public.wallet_reservations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mpm_fee_rule_id UUID REFERENCES public.platform_fee_rules(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_allocations
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

CREATE INDEX idx_wallet_accounts_company ON public.wallet_accounts(company_id);
CREATE INDEX idx_wallet_ledger_company_created ON public.wallet_ledger(company_id, created_at DESC);
CREATE INDEX idx_wallet_reservations_company ON public.wallet_reservations(company_id, created_at DESC);
CREATE INDEX idx_settlement_seller_created ON public.settlement_entries(seller_company_id, created_at DESC);
CREATE INDEX idx_settlement_campaign ON public.settlement_entries(campaign_id);

CREATE OR REPLACE FUNCTION public.mpm_can_manage_company(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp AS $$
  SELECT auth.role() = 'service_role' OR public.is_master_admin()
    OR p_company_id IN (SELECT public.get_user_admin_company_ids());
$$;

CREATE OR REPLACE FUNCTION public.mpm_ensure_account(p_company_id UUID, p_credit_class TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID;
BEGIN
  IF p_credit_class NOT IN ('earned', 'purchased', 'promotional', 'legacy_organic') THEN RAISE EXCEPTION 'Classe de crédito inválida.'; END IF;
  INSERT INTO public.wallet_accounts(company_id, credit_class) VALUES(p_company_id, p_credit_class)
  ON CONFLICT (company_id, credit_class) DO UPDATE SET company_id=EXCLUDED.company_id
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public._mpm_post_entry(
  p_account_id UUID, p_entry_type TEXT, p_direction TEXT, p_amount NUMERIC,
  p_available_delta NUMERIC, p_pending_delta NUMERIC, p_reserved_delta NUMERIC,
  p_source_type TEXT, p_source_id UUID, p_idempotency_key TEXT,
  p_campaign_id UUID DEFAULT NULL, p_media_asset_id UUID DEFAULT NULL,
  p_settlement_id UUID DEFAULT NULL, p_reverses_entry_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_account public.wallet_accounts%ROWTYPE; v_id UUID;
BEGIN
  IF p_amount <= 0 OR NULLIF(trim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Lançamento inválido.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mpm-ledger:' || p_idempotency_key, 0));
  SELECT id INTO v_id FROM public.wallet_ledger WHERE idempotency_key=p_idempotency_key;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT * INTO v_account FROM public.wallet_accounts WHERE id=p_account_id FOR UPDATE;
  IF v_account.id IS NULL THEN RAISE EXCEPTION 'Conta MPM não encontrada.'; END IF;
  IF v_account.available_balance+p_available_delta < 0 OR v_account.pending_balance+p_pending_delta < 0 OR v_account.reserved_balance+p_reserved_delta < 0 THEN
    RAISE EXCEPTION 'Saldo MPM insuficiente.';
  END IF;
  UPDATE public.wallet_accounts SET
    available_balance=available_balance+p_available_delta,
    pending_balance=pending_balance+p_pending_delta,
    reserved_balance=reserved_balance+p_reserved_delta, updated_at=now()
  WHERE id=p_account_id RETURNING * INTO v_account;
  INSERT INTO public.wallet_ledger(account_id, company_id, credit_class, entry_type, direction, amount,
    available_balance_after, pending_balance_after, reserved_balance_after, source_type, source_id,
    campaign_id, media_asset_id, settlement_id, reverses_entry_id, idempotency_key, metadata, actor_id)
  VALUES(v_account.id, v_account.company_id, v_account.credit_class, p_entry_type, p_direction, p_amount,
    v_account.available_balance, v_account.pending_balance, v_account.reserved_balance, p_source_type, p_source_id,
    p_campaign_id, p_media_asset_id, p_settlement_id, p_reverses_entry_id, p_idempotency_key,
    COALESCE(p_metadata,'{}'::jsonb), auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.mpm_grant_credits(p_company_id UUID, p_credit_class TEXT, p_amount NUMERIC,
  p_source_type TEXT, p_source_id UUID, p_idempotency_key TEXT, p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_account UUID;
BEGIN
  IF NOT (auth.role()='service_role' OR public.is_master_admin()) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  v_account := public.mpm_ensure_account(p_company_id,p_credit_class);
  RETURN public._mpm_post_entry(v_account,'grant','credit',p_amount,p_amount,0,0,p_source_type,p_source_id,p_idempotency_key,NULL,NULL,NULL,NULL,p_metadata);
END; $$;

CREATE OR REPLACE FUNCTION public.mpm_reserve_credits(p_company_id UUID, p_amount NUMERIC, p_purpose TEXT,
  p_source_type TEXT, p_source_id UUID, p_idempotency_key TEXT, p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_reservation UUID; v_remaining NUMERIC(18,4):=p_amount; v_take NUMERIC(18,4); v_account RECORD; v_classes TEXT[]; v_class TEXT;
BEGIN
  IF NOT public.mpm_can_manage_company(p_company_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_amount<=0 OR p_purpose NOT IN ('media_purchase','monthly_subscription','annual_subscription') THEN RAISE EXCEPTION 'Reserva inválida.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mpm-reservation:'||p_idempotency_key,0));
  SELECT id INTO v_reservation FROM public.wallet_reservations WHERE idempotency_key=p_idempotency_key;
  IF v_reservation IS NOT NULL THEN RETURN v_reservation; END IF;
  v_classes := CASE WHEN p_purpose IN ('monthly_subscription','annual_subscription') THEN ARRAY['earned','purchased']::TEXT[] ELSE ARRAY['earned','purchased','promotional']::TEXT[] END;
  FOREACH v_class IN ARRAY v_classes LOOP PERFORM public.mpm_ensure_account(p_company_id,v_class); END LOOP;
  INSERT INTO public.wallet_reservations(company_id,purpose,amount,source_type,source_id,idempotency_key,expires_at,metadata,created_by)
  VALUES(p_company_id,p_purpose,p_amount,p_source_type,p_source_id,p_idempotency_key,p_expires_at,COALESCE(p_metadata,'{}'::jsonb),auth.uid()) RETURNING id INTO v_reservation;
  FOR v_account IN SELECT * FROM public.wallet_accounts WHERE company_id=p_company_id AND credit_class=ANY(v_classes)
    ORDER BY array_position(v_classes,credit_class) FOR UPDATE LOOP
    EXIT WHEN v_remaining<=0; v_take:=LEAST(v_remaining,v_account.available_balance);
    IF v_take>0 THEN
      PERFORM public._mpm_post_entry(v_account.id,'reserve','transfer',v_take,-v_take,0,v_take,p_source_type,p_source_id,
        p_idempotency_key||':reserve:'||v_account.credit_class,NULL,NULL,NULL,NULL,jsonb_build_object('reservation_id',v_reservation));
      INSERT INTO public.wallet_reservation_lines(reservation_id,account_id,amount) VALUES(v_reservation,v_account.id,v_take);
      v_remaining:=v_remaining-v_take;
    END IF;
  END LOOP;
  IF v_remaining>0 THEN RAISE EXCEPTION 'Saldo MPM insuficiente: faltam % créditos.',v_remaining; END IF;
  RETURN v_reservation;
END; $$;

CREATE OR REPLACE FUNCTION public.mpm_consume_reservation(p_reservation_id UUID, p_idempotency_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_res public.wallet_reservations%ROWTYPE; v_line RECORD; v_ledger UUID; v_entry_type TEXT;
BEGIN
  SELECT * INTO v_res FROM public.wallet_reservations WHERE id=p_reservation_id FOR UPDATE;
  IF v_res.id IS NULL OR NOT public.mpm_can_manage_company(v_res.company_id) THEN RAISE EXCEPTION 'Reserva inválida ou acesso negado.'; END IF;
  IF v_res.status='consumed' THEN RETURN FALSE; END IF;
  IF v_res.status<>'active' THEN RAISE EXCEPTION 'Reserva não está ativa.'; END IF;
  v_entry_type:=CASE WHEN v_res.purpose IN ('monthly_subscription','annual_subscription') THEN 'subscription_payment' ELSE 'consume' END;
  FOR v_line IN SELECT l.*,a.credit_class FROM public.wallet_reservation_lines l JOIN public.wallet_accounts a ON a.id=l.account_id WHERE l.reservation_id=v_res.id ORDER BY a.credit_class LOOP
    v_ledger:=public._mpm_post_entry(v_line.account_id,v_entry_type,'debit',v_line.amount,0,0,-v_line.amount,v_res.source_type,v_res.source_id,
      p_idempotency_key||':consume:'||v_line.credit_class,NULL,NULL,NULL,NULL,jsonb_build_object('reservation_id',v_res.id));
    UPDATE public.wallet_reservation_lines SET consumed_ledger_id=v_ledger WHERE id=v_line.id;
  END LOOP;
  UPDATE public.wallet_reservations SET status='consumed',updated_at=now() WHERE id=v_res.id;
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.mpm_release_reservation(p_reservation_id UUID, p_idempotency_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_res public.wallet_reservations%ROWTYPE; v_line RECORD;
BEGIN
  SELECT * INTO v_res FROM public.wallet_reservations WHERE id=p_reservation_id FOR UPDATE;
  IF v_res.id IS NULL OR NOT public.mpm_can_manage_company(v_res.company_id) THEN RAISE EXCEPTION 'Reserva inválida ou acesso negado.'; END IF;
  IF v_res.status='released' THEN RETURN FALSE; END IF;
  IF v_res.status<>'active' THEN RAISE EXCEPTION 'Somente reserva ativa pode ser liberada.'; END IF;
  FOR v_line IN SELECT l.*,a.credit_class FROM public.wallet_reservation_lines l JOIN public.wallet_accounts a ON a.id=l.account_id WHERE l.reservation_id=v_res.id LOOP
    PERFORM public._mpm_post_entry(v_line.account_id,'release','transfer',v_line.amount,v_line.amount,0,-v_line.amount,v_res.source_type,v_res.source_id,
      p_idempotency_key||':release:'||v_line.credit_class,NULL,NULL,NULL,NULL,jsonb_build_object('reservation_id',v_res.id));
  END LOOP;
  UPDATE public.wallet_reservations SET status='released',updated_at=now() WHERE id=v_res.id;
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.mpm_pay_subscription(p_company_id UUID,p_amount NUMERIC,p_billing_cycle TEXT,
  p_billing_reference TEXT,p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_res UUID; v_payment UUID;
BEGIN
  IF p_billing_cycle NOT IN ('monthly','annual') OR NULLIF(trim(p_billing_reference),'') IS NULL THEN RAISE EXCEPTION 'Cobrança inválida.'; END IF;
  SELECT id INTO v_payment FROM public.mpm_subscription_payments WHERE idempotency_key=p_idempotency_key;
  IF v_payment IS NOT NULL THEN RETURN v_payment; END IF;
  v_res:=public.mpm_reserve_credits(p_company_id,p_amount,CASE WHEN p_billing_cycle='monthly' THEN 'monthly_subscription' ELSE 'annual_subscription' END,
    'subscription',NULL,p_idempotency_key||':reservation',NULL,jsonb_build_object('billing_reference',p_billing_reference));
  PERFORM public.mpm_consume_reservation(v_res,p_idempotency_key||':payment');
  INSERT INTO public.mpm_subscription_payments(company_id,reservation_id,billing_cycle,billing_reference,amount_credits,idempotency_key)
  VALUES(p_company_id,v_res,p_billing_cycle,p_billing_reference,p_amount,p_idempotency_key) RETURNING id INTO v_payment;
  RETURN v_payment;
END; $$;

CREATE OR REPLACE FUNCTION public.mpm_purchase_media_with_credits(p_order_id UUID,p_inventory_id UUID,
  p_capacity_period_id UUID,p_bucket_policy_id UUID,p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order public.ad_offer_orders%ROWTYPE; v_inventory public.media_inventory%ROWTYPE; v_period public.inventory_capacity_periods%ROWTYPE;
  v_bucket public.inventory_bucket_policies%ROWTYPE; v_media public.media_assets%ROWTYPE; v_screen public.screens%ROWTYPE;
  v_rule public.platform_fee_rules%ROWTYPE; v_res UUID; v_allocation UUID; v_campaign UUID; v_gross NUMERIC(18,4); v_fee_cents INTEGER; v_net_cents INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('mpm-order:'||p_order_id::text,0));
  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id=p_order_id FOR UPDATE;
  IF v_order.id IS NULL OR v_order.buyer_company_id IS NULL OR NOT public.mpm_can_manage_company(v_order.buyer_company_id) THEN RAISE EXCEPTION 'Pedido inválido ou acesso negado.'; END IF;
  IF v_order.campaign_id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'deduplicated',true,'campaign_id',v_order.campaign_id); END IF;
  IF v_order.approval_status<>'approved' OR v_order.status IN ('cancelled','rejected') THEN RAISE EXCEPTION 'Pedido precisa estar aprovado.'; END IF;
  SELECT * INTO v_inventory FROM public.media_inventory WHERE id=p_inventory_id AND owner_type='company' AND source_type='company_screen' FOR SHARE;
  SELECT * INTO v_period FROM public.inventory_capacity_periods WHERE id=p_capacity_period_id AND media_inventory_id=p_inventory_id AND status='active' FOR UPDATE;
  SELECT * INTO v_bucket FROM public.inventory_bucket_policies WHERE id=p_bucket_policy_id AND capacity_period_id=p_capacity_period_id AND status='active' FOR UPDATE;
  SELECT * INTO v_media FROM public.media_assets WHERE id=v_order.requested_media_asset_id;
  SELECT * INTO v_screen FROM public.screens WHERE id=v_inventory.source_id;
  IF v_inventory.id IS NULL OR NOT v_inventory.commercial_enabled OR v_inventory.owner_id<>v_order.seller_company_id OR v_screen.company_id<>v_order.seller_company_id OR v_screen.status='inactive' THEN RAISE EXCEPTION 'Inventário não pertence à exibidora ou não está comercialmente ativo.'; END IF;
  IF v_period.id IS NULL OR v_bucket.id IS NULL THEN RAISE EXCEPTION 'Período ou bolsão inválido.'; END IF;
  IF v_bucket.bucket_type='preferred' AND NOT EXISTS(SELECT 1 FROM public.inventory_preferred_participants WHERE inventory_id=p_inventory_id AND preferred_company_id=v_order.buyer_company_id AND status='active' AND now() BETWEEN starts_at AND ends_at) THEN RAISE EXCEPTION 'Compradora não é preferencial deste inventário.'; END IF;
  IF v_media.id IS NULL OR v_media.company_id<>v_order.buyer_company_id OR v_media.status<>'approved' OR COALESCE(v_media.owner_only,false) OR COALESCE(v_media.trial_internal_only,false) THEN RAISE EXCEPTION 'Mídia da compradora inválida ou restrita.'; END IF;
  SELECT * INTO v_rule FROM public.platform_fee_rules WHERE operation_type='media_sale' AND is_active AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY effective_from DESC LIMIT 1;
  IF v_rule.id IS NULL THEN RAISE EXCEPTION 'Regra de taxa MPM ativa não encontrada.'; END IF;
  v_gross:=round(v_order.gross_amount_cents::numeric/100,4); IF v_gross<=0 THEN RAISE EXCEPTION 'Valor comercial inválido.'; END IF;
  v_fee_cents:=round(v_order.gross_amount_cents*v_rule.percentage/100); v_net_cents:=v_order.gross_amount_cents-v_fee_cents;
  v_res:=public.mpm_reserve_credits(v_order.buyer_company_id,v_gross,'media_purchase','ad_offer_order',v_order.id,p_idempotency_key||':wallet',now()+interval '30 minutes',jsonb_build_object('fee_rule_id',v_rule.id));
  INSERT INTO public.inventory_allocations(inventory_id,capacity_period_id,bucket_policy_id,allocation_type,beneficiary_type,beneficiary_id,
    insertion_quantity,reserved_quantity,status,starts_at,ends_at,expires_at,release_policy,source_type,source_id,idempotency_key,created_by)
  VALUES(p_inventory_id,p_capacity_period_id,p_bucket_policy_id,'commercial_reservation','company',v_order.buyer_company_id,
    v_order.credits_amount::bigint,v_order.credits_amount::bigint,'committed',COALESCE(v_order.requested_start_date,current_date)::timestamptz,
    (COALESCE(v_order.requested_end_date,current_date+30)+1)::timestamptz-interval '1 millisecond',NULL,
    jsonb_build_object('payment_method','mpm_credits','gross_credits',v_gross,'fee_percentage',v_rule.percentage,'fee_rule_id',v_rule.id),
    'mpm_credit_purchase',v_order.id,p_idempotency_key||':inventory',auth.uid()) RETURNING id INTO v_allocation;
  UPDATE public.wallet_reservations SET allocation_id=v_allocation WHERE id=v_res;
  UPDATE public.ad_offer_orders SET payment_method='mpm_credits',wallet_reservation_id=v_res,mpm_fee_rule_id=v_rule.id,
    platform_fee_percentage=v_rule.percentage,platform_fee_cents=v_fee_cents,seller_net_cents=v_net_cents,
    payment_status='paid_manual',status='paid_manual',updated_at=now() WHERE id=v_order.id;
  INSERT INTO public.campaigns(company_id,name,description,campaign_type,status,start_date,end_date,target_insertions,delivered_insertions,
    buyer_company_id,seller_company_id,ad_offer_order_id,credits_contracted,credits_delivered,created_by)
  VALUES(v_order.buyer_company_id,'Campanha MPM: '||COALESCE(v_order.buyer_name,'Anunciante'),'Compra com Créditos MPM','commercial','active',
    COALESCE(v_order.requested_start_date,current_date),COALESCE(v_order.requested_end_date,current_date+30),v_order.credits_amount,0,
    v_order.buyer_company_id,v_order.seller_company_id,v_order.id,v_order.credits_amount,0,auth.uid()) RETURNING id INTO v_campaign;
  INSERT INTO public.campaign_media(campaign_id,media_asset_id,playback_duration_seconds,is_active) VALUES(v_campaign,v_media.id,v_media.playback_duration_seconds,true);
  INSERT INTO public.campaign_screens(campaign_id,screen_id,is_active) VALUES(v_campaign,v_screen.id,true);
  INSERT INTO public.ad_order_delivery_ledger(order_id,campaign_id,seller_company_id,buyer_company_id,credits_contracted,credits_delivered,credits_remaining,status)
  VALUES(v_order.id,v_campaign,v_order.seller_company_id,v_order.buyer_company_id,v_order.credits_amount,0,v_order.credits_amount,'active');
  UPDATE public.inventory_allocations SET campaign_id=v_campaign WHERE id=v_allocation;
  UPDATE public.ad_offer_orders SET status='converted_to_campaign',campaign_id=v_campaign,updated_at=now() WHERE id=v_order.id;
  PERFORM public.mpm_consume_reservation(v_res,p_idempotency_key||':capture');
  RETURN jsonb_build_object('success',true,'campaign_id',v_campaign,'allocation_id',v_allocation,'reservation_id',v_res,'gross_credits',v_gross,'fee_percentage',v_rule.percentage,'supplier_net_credits',v_net_cents::numeric/100);
END; $$;

CREATE OR REPLACE FUNCTION public.settle_mpm_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order public.ad_offer_orders%ROWTYPE; v_allocation public.inventory_allocations%ROWTYPE; v_rule public.platform_fee_rules%ROWTYPE;
  v_settlement UUID; v_account UUID; v_gross NUMERIC(18,4); v_fee NUMERIC(18,4); v_net NUMERIC(18,4); v_earned UUID;
BEGIN
  IF NEW.status<>'used' THEN RETURN NEW; END IF;
  SELECT o.* INTO v_order FROM public.ad_offer_orders o WHERE o.id=NEW.order_id AND o.payment_method='mpm_credits';
  IF v_order.id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_allocation FROM public.inventory_allocations WHERE campaign_id=NEW.campaign_id AND source_type='mpm_credit_purchase' FOR UPDATE;
  SELECT * INTO v_rule FROM public.platform_fee_rules WHERE id=v_order.mpm_fee_rule_id;
  IF v_allocation.id IS NULL OR v_rule.id IS NULL OR v_order.credits_amount<=0 THEN RAISE EXCEPTION 'Liquidação MPM sem allocation ou regra capturada.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mpm-settlement:'||NEW.campaign_id::text||':'||NEW.playback_log_id::text,0));
  SELECT id INTO v_settlement FROM public.settlement_entries WHERE campaign_id=NEW.campaign_id AND playback_log_id=NEW.playback_log_id;
  IF v_settlement IS NOT NULL THEN RETURN NEW; END IF;
  v_gross:=round((v_order.gross_amount_cents::numeric/100)*(NEW.credits_used/v_order.credits_amount),4);
  v_fee:=round(v_gross*v_order.platform_fee_percentage/100,4); v_net:=v_gross-v_fee;
  INSERT INTO public.settlement_entries(seller_company_id,buyer_company_id,order_id,campaign_id,playback_log_id,allocation_id,fee_rule_id,
    delivered_units,gross_credits,platform_fee_credits,supplier_net_credits,idempotency_key,metadata)
  VALUES(v_order.seller_company_id,v_order.buyer_company_id,v_order.id,NEW.campaign_id,NEW.playback_log_id,v_allocation.id,v_rule.id,
    NEW.credits_used,v_gross,v_fee,v_net,'mpm-settlement:'||NEW.campaign_id::text||':'||NEW.playback_log_id::text,jsonb_build_object('fee_percentage',v_order.platform_fee_percentage)) RETURNING id INTO v_settlement;
  v_account:=public.mpm_ensure_account(v_order.seller_company_id,'earned');
  PERFORM public._mpm_post_entry(v_account,'settlement_gross','informational',v_gross,0,0,0,'proof_of_delivery',NEW.playback_log_id,'settlement:'||v_settlement::text||':gross',NEW.campaign_id,NEW.media_asset_id,v_settlement,NULL,'{}');
  IF v_fee>0 THEN PERFORM public._mpm_post_entry(v_account,'platform_fee','informational',v_fee,0,0,0,'platform_fee',v_rule.id,'settlement:'||v_settlement::text||':fee',NEW.campaign_id,NEW.media_asset_id,v_settlement,NULL,'{}'); END IF;
  IF v_net>0 THEN v_earned:=public._mpm_post_entry(v_account,'earned','credit',v_net,v_net,0,0,'proof_of_delivery',NEW.playback_log_id,'settlement:'||v_settlement::text||':earned',NEW.campaign_id,NEW.media_asset_id,v_settlement,NULL,'{}'); END IF;
  UPDATE public.settlement_entries SET status='earned',settled_at=now(),metadata=metadata||jsonb_build_object('earned_ledger_id',v_earned) WHERE id=v_settlement;
  UPDATE public.inventory_allocations SET consumed_quantity=LEAST(insertion_quantity,consumed_quantity+NEW.credits_used::bigint),
    status=CASE WHEN consumed_quantity+NEW.credits_used>=insertion_quantity THEN 'consumed' ELSE 'partially_consumed' END,updated_at=now() WHERE id=v_allocation.id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_settle_mpm_delivery AFTER INSERT ON public.ad_order_delivery_usage
FOR EACH ROW EXECUTE FUNCTION public.settle_mpm_delivery();

CREATE OR REPLACE FUNCTION public.prevent_wallet_ledger_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'wallet_ledger é imutável; use reversal.'; END; $$;
CREATE TRIGGER trg_wallet_ledger_immutable BEFORE UPDATE OR DELETE ON public.wallet_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_wallet_ledger_mutation();

CREATE OR REPLACE FUNCTION public.mpm_reverse_ledger_entry(p_entry_id UUID,p_reason TEXT,p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_entry public.wallet_ledger%ROWTYPE; v_delta NUMERIC; v_id UUID;
BEGIN
  IF NOT (auth.role()='service_role' OR public.is_master_admin()) OR NULLIF(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Acesso negado ou motivo ausente.'; END IF;
  SELECT * INTO v_entry FROM public.wallet_ledger WHERE id=p_entry_id FOR SHARE;
  IF v_entry.id IS NULL OR v_entry.direction NOT IN ('credit','debit') OR v_entry.reverses_entry_id IS NOT NULL THEN RAISE EXCEPTION 'Lançamento não reversível.'; END IF;
  IF EXISTS(SELECT 1 FROM public.wallet_ledger WHERE reverses_entry_id=v_entry.id) THEN SELECT id INTO v_id FROM public.wallet_ledger WHERE reverses_entry_id=v_entry.id; RETURN v_id; END IF;
  v_delta:=CASE WHEN v_entry.direction='credit' THEN -v_entry.amount ELSE v_entry.amount END;
  RETURN public._mpm_post_entry(v_entry.account_id,'reversal',CASE WHEN v_delta>0 THEN 'credit' ELSE 'debit' END,v_entry.amount,v_delta,0,0,'reversal',v_entry.id,p_idempotency_key,v_entry.campaign_id,v_entry.media_asset_id,v_entry.settlement_id,v_entry.id,jsonb_build_object('reason',p_reason));
END; $$;

CREATE OR REPLACE FUNCTION public.mpm_wallet_summary(p_company_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
  SELECT CASE WHEN public.mpm_can_manage_company(p_company_id) OR p_company_id IN (SELECT public.get_user_company_ids()) THEN
    jsonb_build_object('available',COALESCE(sum(available_balance),0),'pending',COALESCE(sum(pending_balance),0),'reserved',COALESCE(sum(reserved_balance),0),
      'by_class',COALESCE(jsonb_object_agg(credit_class,jsonb_build_object('available',available_balance,'pending',pending_balance,'reserved',reserved_balance)),'{}'::jsonb))
    ELSE NULL END FROM public.wallet_accounts WHERE company_id=p_company_id;
$$;

ALTER TABLE public.platform_fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_reservation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpm_subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MPM fee rules read" ON public.platform_fee_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "MPM accounts tenant read" ON public.wallet_accounts FOR SELECT TO authenticated USING (company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());
CREATE POLICY "MPM ledger tenant read" ON public.wallet_ledger FOR SELECT TO authenticated USING (company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());
CREATE POLICY "MPM reservations tenant read" ON public.wallet_reservations FOR SELECT TO authenticated USING (company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());
CREATE POLICY "MPM reservation lines tenant read" ON public.wallet_reservation_lines FOR SELECT TO authenticated USING (reservation_id IN (SELECT id FROM public.wallet_reservations));
CREATE POLICY "MPM settlements parties read" ON public.settlement_entries FOR SELECT TO authenticated USING (buyer_company_id IN (SELECT public.get_user_company_ids()) OR seller_company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());
CREATE POLICY "MPM subscription tenant read" ON public.mpm_subscription_payments FOR SELECT TO authenticated USING (company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());

REVOKE ALL ON FUNCTION public._mpm_post_entry(UUID,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,UUID,TEXT,UUID,UUID,UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mpm_ensure_account(UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mpm_grant_credits(UUID,TEXT,NUMERIC,TEXT,UUID,TEXT,JSONB) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mpm_reserve_credits(UUID,NUMERIC,TEXT,TEXT,UUID,TEXT,TIMESTAMPTZ,JSONB) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mpm_consume_reservation(UUID,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mpm_release_reservation(UUID,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mpm_pay_subscription(UUID,NUMERIC,TEXT,TEXT,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mpm_purchase_media_with_credits(UUID,UUID,UUID,UUID,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mpm_reverse_ledger_entry(UUID,TEXT,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mpm_wallet_summary(UUID) TO authenticated,service_role;

INSERT INTO public.platform_settings(key,value,description) VALUES
  ('mpm_credit_v2','true'::jsonb,'Crédito MPM V2 ativo'),
  ('mpm_nominal_brl','1'::jsonb,'Referência nominal interna: 1 Crédito MPM = R$ 1,00'),
  ('mpm_commercial_reference','{"insertions":2000,"credits":500}'::jsonb,'Referência comercial configurável; não é capacidade')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,description=EXCLUDED.description,updated_at=now();

UPDATE public.platform_settings SET value='true'::jsonb,updated_at=now()
WHERE key IN ('media_inventory_v2','inventory_capacity_v2','inventory_allocations_v2');
UPDATE public.platform_settings SET value='false'::jsonb,updated_at=now() WHERE key='inventory_growth_enabled';

COMMENT ON TABLE public.wallet_ledger IS 'Ledger MPM V2 imutável. Correções são novos lançamentos reversal.';
COMMENT ON TABLE public.wallet_accounts IS 'Saldos MPM V2 por classe; não recebe conversão automática das carteiras legadas.';
COMMENT ON TABLE public.settlement_entries IS 'Liquidação econômica criada apenas por Proof of Delivery comercial MPM válido.';
