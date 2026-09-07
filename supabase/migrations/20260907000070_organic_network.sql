CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.organic_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'MT',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','blocked')),
  pending_balance NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  available_balance NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  lifetime_earned NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organic_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.organic_participants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'organic_tv' CHECK (device_type IN ('organic_tv','organic_windows_monitor')),
  orientation TEXT NOT NULL DEFAULT 'horizontal' CHECK (orientation IN ('horizontal','vertical')),
  status TEXT NOT NULL DEFAULT 'pending_pairing' CHECK (status IN ('pending_pairing','online','offline','paused','blocked')),
  device_token_hash TEXT UNIQUE,
  idle_start_seconds INTEGER NOT NULL DEFAULT 300 CHECK (idle_start_seconds BETWEEN 0 AND 86400),
  daily_credit_limit NUMERIC(12,4) NOT NULL DEFAULT 1.0000 CHECK (daily_credit_limit >= 0),
  allowed_start_time TIME,
  allowed_end_time TIME,
  blocked_categories TEXT[] NOT NULL DEFAULT '{}',
  last_ping_at TIMESTAMPTZ,
  paired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organic_pairing_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  request_secret_hash TEXT NOT NULL,
  screen_id UUID REFERENCES public.organic_screens(id) ON DELETE CASCADE,
  encrypted_device_token JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paired','claimed','expired','cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organic_campaign_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  terms TEXT,
  credits_required NUMERIC(14,4) NOT NULL CHECK (credits_required > 0),
  credit_budget NUMERIC(14,4) NOT NULL CHECK (credit_budget > 0),
  credits_distributed NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (credits_distributed >= 0),
  quantity_total INTEGER NOT NULL CHECK (quantity_total > 0),
  quantity_available INTEGER NOT NULL CHECK (quantity_available >= 0),
  quantity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  quantity_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (quantity_redeemed >= 0),
  city TEXT,
  state TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','exhausted','expired','cancelled')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id)
);

CREATE TABLE IF NOT EXISTS public.organic_playback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.organic_participants(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.organic_screens(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.organic_campaign_rewards(id) ON DELETE RESTRICT,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  planned_duration_seconds INTEGER NOT NULL,
  base_credits NUMERIC(14,4) NOT NULL,
  device_multiplier NUMERIC(8,4) NOT NULL DEFAULT 0.0100,
  credits_earned NUMERIC(14,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','rejected','reversed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organic_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.organic_participants(id) ON DELETE CASCADE,
  screen_id UUID REFERENCES public.organic_screens(id) ON DELETE SET NULL,
  playback_event_id UUID UNIQUE REFERENCES public.organic_playback_events(id) ON DELETE SET NULL,
  reward_id UUID REFERENCES public.organic_campaign_rewards(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('earning','release','reservation','redemption','refund','reversal','expiration')),
  amount NUMERIC(14,4) NOT NULL,
  balance_bucket TEXT NOT NULL CHECK (balance_bucket IN ('pending','available','reserved')),
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  available_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organic_reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES public.organic_campaign_rewards(id) ON DELETE RESTRICT,
  participant_id UUID NOT NULL REFERENCES public.organic_participants(id) ON DELETE RESTRICT,
  credits_reserved NUMERIC(14,4) NOT NULL CHECK (credits_reserved > 0),
  redemption_code_hash TEXT NOT NULL UNIQUE,
  redemption_code_suffix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','redeemed','expired','cancelled')),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  validated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organic_screens_participant ON public.organic_screens(participant_id);
CREATE INDEX IF NOT EXISTS idx_organic_rewards_active ON public.organic_campaign_rewards(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_organic_events_daily ON public.organic_playback_events(screen_id, played_at);
CREATE INDEX IF NOT EXISTS idx_organic_ledger_participant ON public.organic_credit_ledger(participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_organic_redemptions_participant ON public.organic_reward_redemptions(participant_id, created_at DESC);

ALTER TABLE public.organic_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organic_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organic_pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organic_campaign_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organic_playback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organic_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organic_reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY organic_participant_own ON public.organic_participants FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_master_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_master_admin());
CREATE POLICY organic_screens_own ON public.organic_screens FOR ALL TO authenticated
  USING (participant_id IN (SELECT id FROM public.organic_participants WHERE user_id = auth.uid()) OR public.is_master_admin())
  WITH CHECK (participant_id IN (SELECT id FROM public.organic_participants WHERE user_id = auth.uid()) OR public.is_master_admin());
CREATE POLICY organic_rewards_read ON public.organic_campaign_rewards FOR SELECT TO authenticated
  USING (status = 'active' OR company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());
CREATE POLICY organic_rewards_company ON public.organic_campaign_rewards FOR ALL TO authenticated
  USING (company_id IN (SELECT public.get_user_admin_company_ids()) OR public.is_master_admin())
  WITH CHECK (company_id IN (SELECT public.get_user_admin_company_ids()) OR public.is_master_admin());
CREATE POLICY organic_events_own ON public.organic_playback_events FOR SELECT TO authenticated
  USING (participant_id IN (SELECT id FROM public.organic_participants WHERE user_id = auth.uid()) OR public.is_master_admin());
CREATE POLICY organic_ledger_own ON public.organic_credit_ledger FOR SELECT TO authenticated
  USING (participant_id IN (SELECT id FROM public.organic_participants WHERE user_id = auth.uid()) OR public.is_master_admin());
CREATE POLICY organic_redemptions_own ON public.organic_reward_redemptions FOR SELECT TO authenticated
  USING (participant_id IN (SELECT id FROM public.organic_participants WHERE user_id = auth.uid()) OR public.is_master_admin());

-- Cadastro seguro do participante sem conceder vínculo ou acesso empresarial.
CREATE OR REPLACE FUNCTION public.activate_organic_participant(p_display_name TEXT, p_city TEXT, p_state TEXT DEFAULT 'MT')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  IF length(trim(p_display_name)) < 2 OR length(trim(p_city)) < 2 THEN RAISE EXCEPTION 'Nome e cidade são obrigatórios.'; END IF;
  INSERT INTO public.organic_participants(user_id, display_name, city, state)
  VALUES(auth.uid(), trim(p_display_name), trim(p_city), upper(trim(p_state)))
  ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name, city=EXCLUDED.city, state=EXCLUDED.state, updated_at=NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.activate_organic_participant(TEXT,TEXT,TEXT) TO authenticated;

-- Reserva estoque e créditos atomicamente; nunca permite quantidade negativa.
CREATE OR REPLACE FUNCTION public.reserve_organic_reward(p_reward_id UUID, p_code_hash TEXT, p_code_suffix TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_participant RECORD; v_reward RECORD; v_redemption UUID;
BEGIN
  SELECT * INTO v_participant FROM public.organic_participants WHERE user_id=auth.uid() AND status='active' FOR UPDATE;
  IF v_participant.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Participante orgânico não encontrado.'); END IF;
  SELECT * INTO v_reward FROM public.organic_campaign_rewards WHERE id=p_reward_id FOR UPDATE;
  IF v_reward.id IS NULL OR v_reward.status!='active' OR v_reward.expires_at<=NOW() OR v_reward.quantity_available<=0 THEN
    RETURN jsonb_build_object('success',false,'error','Benefício indisponível ou esgotado.');
  END IF;
  IF v_participant.available_balance < v_reward.credits_required THEN
    RETURN jsonb_build_object('success',false,'error','Microcréditos insuficientes.');
  END IF;
  UPDATE public.organic_participants SET available_balance=available_balance-v_reward.credits_required, updated_at=NOW() WHERE id=v_participant.id;
  UPDATE public.organic_campaign_rewards SET quantity_available=quantity_available-1, quantity_reserved=quantity_reserved+1, updated_at=NOW() WHERE id=v_reward.id;
  INSERT INTO public.organic_reward_redemptions(reward_id,participant_id,credits_reserved,redemption_code_hash,redemption_code_suffix,expires_at)
  VALUES(v_reward.id,v_participant.id,v_reward.credits_required,p_code_hash,p_code_suffix,LEAST(v_reward.expires_at,NOW()+INTERVAL '7 days')) RETURNING id INTO v_redemption;
  INSERT INTO public.organic_credit_ledger(participant_id,reward_id,type,amount,balance_bucket,description,metadata)
  VALUES(v_participant.id,v_reward.id,'reservation',-v_reward.credits_required,'available','Reserva de benefício',jsonb_build_object('redemption_id',v_redemption));
  RETURN jsonb_build_object('success',true,'redemption_id',v_redemption,'expires_at',LEAST(v_reward.expires_at,NOW()+INTERVAL '7 days'));
END $$;
GRANT EXECUTE ON FUNCTION public.reserve_organic_reward(UUID,TEXT,TEXT) TO authenticated;

-- Libera microcréditos pendentes após 48 horas. Pode ser executada por serviço agendado.
CREATE OR REPLACE FUNCTION public.release_organic_pending_credits()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row RECORD; v_count INTEGER:=0;
BEGIN
  FOR v_row IN SELECT participant_id, SUM(amount) amount FROM public.organic_credit_ledger
    WHERE type='earning' AND balance_bucket='pending' AND available_at<=NOW() AND COALESCE((metadata->>'released')::boolean,false)=false GROUP BY participant_id
  LOOP
    UPDATE public.organic_participants SET pending_balance=GREATEST(0,pending_balance-v_row.amount), available_balance=available_balance+v_row.amount, updated_at=NOW() WHERE id=v_row.participant_id;
    UPDATE public.organic_credit_ledger SET metadata=metadata||'{"released":true}'::jsonb WHERE participant_id=v_row.participant_id AND type='earning' AND balance_bucket='pending' AND available_at<=NOW() AND COALESCE((metadata->>'released')::boolean,false)=false;
    INSERT INTO public.organic_credit_ledger(participant_id,type,amount,balance_bucket,description) VALUES(v_row.participant_id,'release',v_row.amount,'available','Liberação de microcréditos validados');
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.release_organic_pending_credits() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_organic_pending_credits() TO service_role;

-- Registra uma exibição residencial de forma atômica, com fator fixo 0,01,
-- limite diário da tela e orçamento promocional lastreado em benefício ativo.
CREATE OR REPLACE FUNCTION public.record_organic_playback(
  p_screen_id UUID, p_reward_id UUID, p_campaign_id UUID, p_media_asset_id UUID,
  p_duration_seconds INTEGER, p_idempotency_key TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_screen RECORD; v_reward RECORD; v_daily NUMERIC(14,4); v_base NUMERIC(14,4); v_earned NUMERIC(14,4); v_event UUID;
BEGIN
  IF EXISTS(SELECT 1 FROM public.organic_playback_events WHERE idempotency_key=p_idempotency_key) THEN
    RETURN jsonb_build_object('success',true,'deduplicated',true,'credits_earned',0);
  END IF;
  SELECT s.*,p.city,p.state,p.status participant_status INTO v_screen FROM public.organic_screens s JOIN public.organic_participants p ON p.id=s.participant_id WHERE s.id=p_screen_id FOR UPDATE OF s;
  IF v_screen.id IS NULL OR v_screen.status NOT IN ('online','offline') OR v_screen.participant_status!='active' THEN RETURN jsonb_build_object('success',false,'error','Tela orgânica indisponível.'); END IF;
  SELECT * INTO v_reward FROM public.organic_campaign_rewards WHERE id=p_reward_id AND campaign_id=p_campaign_id FOR UPDATE;
  IF v_reward.id IS NULL OR v_reward.status!='active' OR NOW() NOT BETWEEN v_reward.starts_at AND v_reward.expires_at OR v_reward.quantity_available<=0 OR v_reward.credits_distributed>=v_reward.credit_budget THEN RETURN jsonb_build_object('success',false,'error','Campanha orgânica sem benefício disponível.'); END IF;
  IF v_reward.city IS NOT NULL AND lower(v_reward.city)!=lower(v_screen.city) THEN RETURN jsonb_build_object('success',false,'error','Campanha fora da região desta tela.'); END IF;
  IF v_reward.state IS NOT NULL AND upper(v_reward.state)!=upper(v_screen.state) THEN RETURN jsonb_build_object('success',false,'error','Campanha fora do estado desta tela.'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.campaign_media WHERE campaign_id=p_campaign_id AND media_asset_id=p_media_asset_id AND is_active=true) THEN RETURN jsonb_build_object('success',false,'error','Mídia não pertence à campanha.'); END IF;
  IF p_duration_seconds<=5 THEN v_base:=0.5; ELSIF p_duration_seconds<=10 THEN v_base:=1; ELSIF p_duration_seconds<=15 THEN v_base:=1.5; ELSE v_base:=3; END IF;
  v_earned:=ROUND(v_base*0.01,4);
  SELECT COALESCE(SUM(credits_earned),0) INTO v_daily FROM public.organic_playback_events WHERE screen_id=p_screen_id AND status='completed' AND played_at>=date_trunc('day',NOW());
  v_earned:=LEAST(v_earned,GREATEST(0,v_screen.daily_credit_limit-v_daily),GREATEST(0,v_reward.credit_budget-v_reward.credits_distributed));
  IF v_earned<=0 THEN RETURN jsonb_build_object('success',false,'error','Limite diário ou orçamento da campanha atingido.'); END IF;
  INSERT INTO public.organic_playback_events(participant_id,screen_id,reward_id,campaign_id,media_asset_id,planned_duration_seconds,base_credits,device_multiplier,credits_earned,idempotency_key)
  VALUES(v_screen.participant_id,p_screen_id,p_reward_id,p_campaign_id,p_media_asset_id,p_duration_seconds,v_base,0.01,v_earned,p_idempotency_key) RETURNING id INTO v_event;
  UPDATE public.organic_participants SET pending_balance=pending_balance+v_earned,lifetime_earned=lifetime_earned+v_earned,updated_at=NOW() WHERE id=v_screen.participant_id;
  UPDATE public.organic_campaign_rewards SET credits_distributed=credits_distributed+v_earned,updated_at=NOW(),status=CASE WHEN credits_distributed+v_earned>=credit_budget THEN 'exhausted' ELSE status END WHERE id=v_reward.id;
  INSERT INTO public.organic_credit_ledger(participant_id,screen_id,playback_event_id,reward_id,type,amount,balance_bucket,description,available_at,metadata)
  VALUES(v_screen.participant_id,p_screen_id,v_event,p_reward_id,'earning',v_earned,'pending','Microcrédito por exibição residencial validada',NOW()+INTERVAL '48 hours',jsonb_build_object('device_multiplier',0.01,'released',false));
  RETURN jsonb_build_object('success',true,'credits_earned',v_earned,'pending_until',NOW()+INTERVAL '48 hours');
END $$;
REVOKE ALL ON FUNCTION public.record_organic_playback(UUID,UUID,UUID,UUID,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_organic_playback(UUID,UUID,UUID,UUID,INTEGER,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_organic_redemption(p_code_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_redemption RECORD; v_reward RECORD;
BEGIN
  SELECT r.* INTO v_redemption FROM public.organic_reward_redemptions r WHERE r.redemption_code_hash=p_code_hash FOR UPDATE;
  IF v_redemption.id IS NULL OR v_redemption.status!='reserved' OR v_redemption.expires_at<=NOW() THEN RETURN jsonb_build_object('success',false,'error','Código inválido ou expirado.'); END IF;
  SELECT * INTO v_reward FROM public.organic_campaign_rewards WHERE id=v_redemption.reward_id FOR UPDATE;
  IF NOT (public.is_master_admin() OR v_reward.company_id IN (SELECT public.get_user_admin_company_ids())) THEN RETURN jsonb_build_object('success',false,'error','Acesso negado.'); END IF;
  UPDATE public.organic_reward_redemptions SET status='redeemed',redeemed_at=NOW(),validated_by=auth.uid() WHERE id=v_redemption.id;
  UPDATE public.organic_campaign_rewards SET quantity_reserved=GREATEST(0,quantity_reserved-1),quantity_redeemed=quantity_redeemed+1,updated_at=NOW() WHERE id=v_reward.id;
  INSERT INTO public.organic_credit_ledger(participant_id,reward_id,type,amount,balance_bucket,description,metadata)
  VALUES(v_redemption.participant_id,v_reward.id,'redemption',-v_redemption.credits_reserved,'reserved','Benefício resgatado',jsonb_build_object('redemption_id',v_redemption.id));
  RETURN jsonb_build_object('success',true,'title',v_reward.title,'redemption_id',v_redemption.id);
END $$;
GRANT EXECUTE ON FUNCTION public.validate_organic_redemption(TEXT) TO authenticated;
