-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3B: CRÉDITOS, DÉBITO POR INSERÇÃO E CARTEIRA
-- Data: 2026-07-31
-- ============================================================================

-- 1. ADICIONAR CAMPOS DE TIPAGEM E EXPIRAÇÃO EM WALLET_TRANSACTIONS
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'credit_type') THEN
    ALTER TABLE public.wallet_transactions ADD COLUMN credit_type TEXT DEFAULT 'paid_credit' 
      CHECK (credit_type IN ('paid_credit', 'trial_credit', 'exchange_credit', 'bonus_credit', 'referral_credit', 'network_inventory_credit', 'monthly_network_quota'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'source_type') THEN
    ALTER TABLE public.wallet_transactions ADD COLUMN source_type TEXT DEFAULT 'manual_adjustment'
      CHECK (source_type IN ('manual_adjustment', 'credit_package', 'playback_charge', 'trial_grant', 'referral_bonus', 'network_quota', 'exchange', 'refund'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'source_id') THEN
    ALTER TABLE public.wallet_transactions ADD COLUMN source_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'expires_at') THEN
    ALTER TABLE public.wallet_transactions ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'metadata') THEN
    ALTER TABLE public.wallet_transactions ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. TABELA DE PACOTES DE CRÉDITO (CREDIT_PACKAGES)
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  credits_amount NUMERIC(12,2) NOT NULL CHECK (credits_amount > 0),
  price_cents INTEGER NOT NULL DEFAULT 0,
  credit_type TEXT NOT NULL DEFAULT 'paid_credit' CHECK (credit_type IN ('paid_credit', 'trial_credit', 'bonus_credit')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA LEDGER DE COBRANÇAS POR PLAYBACK (PLAYBACK_CREDIT_CHARGES)
CREATE TABLE IF NOT EXISTS public.playback_credit_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  playback_log_id UUID UNIQUE NOT NULL REFERENCES public.playback_logs(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  credits_charged NUMERIC(12,2) NOT NULL,
  charge_status TEXT NOT NULL CHECK (charge_status IN ('charged', 'skipped', 'failed', 'refunded')),
  failure_reason TEXT,
  wallet_transaction_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playback_credit_charges_company ON public.playback_credit_charges(company_id);
CREATE INDEX IF NOT EXISTS idx_playback_credit_charges_campaign ON public.playback_credit_charges(campaign_id);
CREATE INDEX IF NOT EXISTS idx_playback_credit_charges_log ON public.playback_credit_charges(playback_log_id);

-- 4. RPC POSTGRESQL DE DÉBITO POR PLAYBACK (CHARGE_PLAYBACK_CREDIT)
CREATE OR REPLACE FUNCTION public.charge_playback_credit(p_playback_log_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_log RECORD;
  v_wallet RECORD;
  v_existing_charge RECORD;
  v_credits_to_charge NUMERIC(12,2) := 1.0;
  v_previous_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id UUID;
BEGIN
  -- 1. Buscar o log de exibição
  SELECT * INTO v_log FROM public.playback_logs WHERE id = p_playback_log_id;
  
  IF v_log.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Log de exibição não encontrado.');
  END IF;

  -- 2. Validar se o status é 'completed'
  IF v_log.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas exibições concluídas (status = completed) geram débito de créditos.');
  END IF;

  -- 3. Verificar se o log já foi cobrado (Anti-duplicidade)
  SELECT * INTO v_existing_charge FROM public.playback_credit_charges WHERE playback_log_id = p_playback_log_id;
  
  IF v_existing_charge.id IS NOT NULL THEN
    IF v_existing_charge.charge_status = 'charged' THEN
      RETURN jsonb_build_object('success', true, 'deduplicated', true, 'charged', false, 'credits_charged', 0, 'message', 'Log já cobrado anteriormente.');
    END IF;
  END IF;

  -- 4. Calcular valor do débito conforme a duração planejada
  -- 5s = 0,5 CR | 10s = 1,0 CR | 15s = 1,5 CR | 30s = 3,0 CR
  IF v_log.planned_duration_seconds <= 5 THEN
    v_credits_to_charge := 0.5;
  ELSIF v_log.planned_duration_seconds <= 10 THEN
    v_credits_to_charge := 1.0;
  ELSIF v_log.planned_duration_seconds <= 15 THEN
    v_credits_to_charge := 1.5;
  ELSE
    v_credits_to_charge := 3.0;
  END IF;

  -- 5. Localizar carteira da empresa proprietária com trava pessimista FOR UPDATE
  SELECT * INTO v_wallet FROM public.wallets WHERE company_id = v_log.company_id FOR UPDATE;
  
  IF v_wallet.id IS NULL THEN
    -- Criar carteira caso não exista
    INSERT INTO public.wallets (company_id, balance) VALUES (v_log.company_id, 0)
    RETURNING * INTO v_wallet;
  END IF;

  v_previous_balance := v_wallet.balance;

  -- 6. Validar saldo suficiente
  IF v_previous_balance < v_credits_to_charge THEN
    -- Registrar tentativa com falha de saldo em playback_credit_charges
    INSERT INTO public.playback_credit_charges (
      company_id, wallet_id, playback_log_id, campaign_id, media_asset_id, screen_id, credits_charged, charge_status, failure_reason
    ) VALUES (
      v_log.company_id, v_wallet.id, p_playback_log_id, v_log.playlist_id, v_log.media_asset_id, v_log.screen_id, v_credits_to_charge, 'failed', 'Saldo insuficiente na carteira'
    ) ON CONFLICT (playback_log_id) DO UPDATE SET 
      charge_status = 'failed', failure_reason = 'Saldo insuficiente na carteira';

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Saldo insuficiente na carteira da empresa.', 
      'credits_required', v_credits_to_charge, 
      'balance', v_previous_balance
    );
  END IF;

  -- 7. Debitar da carteira
  v_new_balance := v_previous_balance - v_credits_to_charge;
  
  UPDATE public.wallets 
  SET balance = v_new_balance, updated_at = NOW() 
  WHERE id = v_wallet.id;

  -- 8. Criar registro em wallet_transactions
  INSERT INTO public.wallet_transactions (
    wallet_id, company_id, previous_balance, amount, new_balance, type, source, source_type, credit_type, description
  ) VALUES (
    v_wallet.id, v_log.company_id, v_previous_balance, v_credits_to_charge, v_new_balance, 'debit', 'campaign_spend', 'playback_charge', 'paid_credit', 'Débito por exibição confirmada (Proof of Play)'
  ) RETURNING id INTO v_transaction_id;

  -- 9. Registrar em playback_credit_charges com status charged
  INSERT INTO public.playback_credit_charges (
    company_id, wallet_id, playback_log_id, media_asset_id, screen_id, credits_charged, charge_status, wallet_transaction_id
  ) VALUES (
    v_log.company_id, v_wallet.id, p_playback_log_id, v_log.media_asset_id, v_log.screen_id, v_credits_to_charge, 'charged', v_transaction_id
  ) ON CONFLICT (playback_log_id) DO UPDATE SET
    charge_status = 'charged', failure_reason = NULL, wallet_transaction_id = v_transaction_id;

  RETURN jsonb_build_object(
    'success', true, 
    'charged', true, 
    'credits_charged', v_credits_to_charge, 
    'previous_balance', v_previous_balance, 
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_credit_charges ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS - CREDIT_PACKAGES
CREATE POLICY "CreditPackages - Leitura por todos os usuários autenticados"
  ON public.credit_packages FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "CreditPackages - Gerenciamento por Master Admin"
  ON public.credit_packages FOR ALL TO authenticated
  USING (is_master_admin());

-- POLÍTICAS RLS - PLAYBACK_CREDIT_CHARGES
CREATE POLICY "PlaybackCreditCharges - Leitura por membros da empresa ou Master Admin"
  ON public.playback_credit_charges FOR SELECT TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));
