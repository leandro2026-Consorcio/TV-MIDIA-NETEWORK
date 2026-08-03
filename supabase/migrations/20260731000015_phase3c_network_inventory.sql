-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3C: CARTEIRA DA REDE E INVENTÁRIO CEDIDO
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE REGRAS DE POLÍTICAS DE CRÉDITO (CREDIT_POLICY_RULES)
CREATE TABLE IF NOT EXISTS public.credit_policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('trial_standard', 'trial_immediate_conversion', 'vip_invite', 'paid_plan_monthly', 'manual_bonus', 'exchange_agreement')),
  received_credit_type TEXT NOT NULL DEFAULT 'trial_credit',
  received_credits NUMERIC(12,2) DEFAULT 0,
  ceded_credit_type TEXT NOT NULL DEFAULT 'network_inventory_credit',
  ceded_credits NUMERIC(12,2) DEFAULT 0,
  validity_days INTEGER,
  max_external_grade_percentage NUMERIC(5,2) DEFAULT 10.00,
  requires_manual_approval BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir Regras Padrão Iniciais se não existirem
INSERT INTO public.credit_policy_rules (name, rule_type, received_credit_type, received_credits, ceded_credit_type, ceded_credits, validity_days, max_external_grade_percentage)
VALUES 
  ('Trial Comum (60 Dias)', 'trial_standard', 'trial_credit', 50, 'network_inventory_credit', 300, 60, 10.00),
  ('Conversão Imediata (Fechou no Ato)', 'trial_immediate_conversion', 'trial_credit', 100, 'network_inventory_credit', 300, 60, 10.00),
  ('Convite VIP Parceiro', 'vip_invite', 'trial_credit', 50, 'network_inventory_credit', 300, 60, 10.00),
  ('Cota Colaborativa Cliente Pagante', 'paid_plan_monthly', 'paid_credit', 0, 'monthly_network_quota', 50, 30, 10.00)
ON CONFLICT DO NOTHING;

-- 2. TABELA DE PREFERÊNCIAS DA EMPRESA NA REDE (COMPANY_NETWORK_PREFERENCES)
CREATE TABLE IF NOT EXISTS public.company_network_preferences (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  accepts_network_ads BOOLEAN DEFAULT TRUE,
  max_external_grade_percentage NUMERIC(5,2) DEFAULT 10.00,
  requires_manual_approval BOOLEAN DEFAULT TRUE,
  blocked_segments UUID[] DEFAULT '{}'::uuid[],
  blocked_companies UUID[] DEFAULT '{}'::uuid[],
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA LEDGER DE INVENTÁRIO CEDIDO À REDE (NETWORK_INVENTORY_LEDGER)
CREATE TABLE IF NOT EXISTS public.network_inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('trial_policy', 'monthly_quota', 'manual_grant', 'exchange_agreement')),
  source_id UUID,
  credit_type TEXT NOT NULL CHECK (credit_type IN ('network_inventory_credit', 'monthly_network_quota')),
  credits_granted NUMERIC(12,2) NOT NULL CHECK (credits_granted > 0),
  credits_used NUMERIC(12,2) DEFAULT 0,
  credits_remaining NUMERIC(12,2) NOT NULL,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'consumed', 'cancelled')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_net_inv_ledger_company ON public.network_inventory_ledger(company_id);
CREATE INDEX IF NOT EXISTS idx_net_inv_ledger_status ON public.network_inventory_ledger(status);

-- 4. TABELA DE REGISTRO DE USO DO INVENTÁRIO (NETWORK_INVENTORY_USAGE)
CREATE TABLE IF NOT EXISTS public.network_inventory_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_ledger_id UUID NOT NULL REFERENCES public.network_inventory_ledger(id) ON DELETE CASCADE,
  display_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  advertiser_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  playback_log_id UUID UNIQUE NOT NULL REFERENCES public.playback_logs(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  credits_used NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'used' CHECK (status IN ('used', 'reversed', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_net_inv_usage_display ON public.network_inventory_usage(display_company_id);
CREATE INDEX IF NOT EXISTS idx_net_inv_usage_advertiser ON public.network_inventory_usage(advertiser_company_id);

-- 5. RPC POSTGRESQL DE CONSUMO DE INVENTÁRIO CEDIDO (USE_NETWORK_INVENTORY_CREDIT)
CREATE OR REPLACE FUNCTION public.use_network_inventory_credit(
  p_playback_log_id UUID,
  p_inventory_ledger_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_log RECORD;
  v_ledger RECORD;
  v_prefs RECORD;
  v_media RECORD;
  v_existing_usage RECORD;
  v_credits_needed NUMERIC(12,2) := 1.0;
  v_new_remaining NUMERIC(12,2);
  v_new_used NUMERIC(12,2);
  v_new_status TEXT;
  v_is_blocked BOOLEAN := FALSE;
BEGIN
  -- 1. Buscar o log de exibição
  SELECT * INTO v_log FROM public.playback_logs WHERE id = p_playback_log_id;
  
  IF v_log.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Log de exibição não encontrado.');
  END IF;

  IF v_log.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas exibições concluídas (completed) podem consumir inventário cedido.');
  END IF;

  -- 2. Idempotência: verificar se este log já consumiu inventário
  SELECT * INTO v_existing_usage FROM public.network_inventory_usage WHERE playback_log_id = p_playback_log_id;
  IF v_existing_usage.id IS NOT NULL AND v_existing_usage.status = 'used' THEN
    RETURN jsonb_build_object('success', true, 'deduplicated', true, 'credits_used', 0, 'message', 'Log já processado no inventário.');
  END IF;

  -- 3. Buscar o registro de inventário cedido com trava pessimista FOR UPDATE
  SELECT * INTO v_ledger FROM public.network_inventory_ledger WHERE id = p_inventory_ledger_id FOR UPDATE;
  
  IF v_ledger.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventário cedido não encontrado.');
  END IF;

  IF v_ledger.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registro de inventário não está ativo.');
  END IF;

  -- Checar se o inventário expirou por data
  IF v_ledger.expires_at IS NOT NULL AND NOW() > v_ledger.expires_at THEN
    UPDATE public.network_inventory_ledger SET status = 'expired', updated_at = NOW() WHERE id = v_ledger.id;
    RETURN jsonb_build_object('success', false, 'error', 'O inventário cedido selecionado expirou.');
  END IF;

  -- 4. Buscar mídia para saber qual empresa é a anunciante
  SELECT * INTO v_media FROM public.media_assets WHERE id = v_log.media_asset_id;

  -- 5. Validar preferências da empresa exibidora (v_ledger.company_id)
  SELECT * INTO v_prefs FROM public.company_network_preferences WHERE company_id = v_ledger.company_id;
  
  IF v_prefs.company_id IS NOT NULL THEN
    IF NOT v_prefs.accepts_network_ads THEN
      RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não aceita anúncios da rede.');
    END IF;

    -- Validar se a empresa anunciante está bloqueada
    IF v_media.company_id = ANY(v_prefs.blocked_companies) THEN
      INSERT INTO public.network_inventory_usage (
        inventory_ledger_id, display_company_id, advertiser_company_id, playback_log_id, media_asset_id, screen_id, credits_used, status, failure_reason
      ) VALUES (
        p_inventory_ledger_id, v_ledger.company_id, v_media.company_id, p_playback_log_id, v_log.media_asset_id, v_log.screen_id, 0, 'failed', 'Empresa anunciante bloqueada'
      ) ON CONFLICT (playback_log_id) DO NOTHING;

      RETURN jsonb_build_object('success', false, 'error', 'Rejeitado: A empresa anunciante está na lista de bloqueados.');
    END IF;
  END IF;

  -- 6. Calcular valor do consumo por duração
  IF v_log.planned_duration_seconds <= 5 THEN v_credits_needed := 0.5;
  ELSIF v_log.planned_duration_seconds <= 10 THEN v_credits_needed := 1.0;
  ELSIF v_log.planned_duration_seconds <= 15 THEN v_credits_needed := 1.5;
  ELSE v_credits_needed := 3.0;
  END IF;

  -- 7. Validar se há saldo de inventário restante
  IF v_ledger.credits_remaining < v_credits_needed THEN
    INSERT INTO public.network_inventory_usage (
      inventory_ledger_id, display_company_id, advertiser_company_id, playback_log_id, media_asset_id, screen_id, credits_used, status, failure_reason
    ) VALUES (
      p_inventory_ledger_id, v_ledger.company_id, v_media.company_id, p_playback_log_id, v_log.media_asset_id, v_log.screen_id, v_credits_needed, 'failed', 'Inventário cedido insuficiente'
    ) ON CONFLICT (playback_log_id) DO UPDATE SET status = 'failed', failure_reason = 'Inventário cedido insuficiente';

    RETURN jsonb_build_object('success', false, 'error', 'Saldo restante de inventário cedido é insuficiente.', 'credits_needed', v_credits_needed, 'credits_remaining', v_ledger.credits_remaining);
  END IF;

  -- 8. Deduzir do inventário cedido
  v_new_remaining := v_ledger.credits_remaining - v_credits_needed;
  v_new_used := v_ledger.credits_used + v_credits_needed;
  v_new_status := CASE WHEN v_new_remaining = 0 THEN 'consumed' ELSE 'active' END;

  UPDATE public.network_inventory_ledger 
  SET 
    credits_remaining = v_new_remaining, 
    credits_used = v_new_used, 
    status = v_new_status, 
    updated_at = NOW() 
  WHERE id = v_ledger.id;

  -- 9. Gravar em network_inventory_usage
  INSERT INTO public.network_inventory_usage (
    inventory_ledger_id, display_company_id, advertiser_company_id, playback_log_id, media_asset_id, screen_id, credits_used, status
  ) VALUES (
    p_inventory_ledger_id, v_ledger.company_id, v_media.company_id, p_playback_log_id, v_log.media_asset_id, v_log.screen_id, v_credits_needed, 'used'
  ) ON CONFLICT (playback_log_id) DO UPDATE SET status = 'used', failure_reason = NULL;

  RETURN jsonb_build_object(
    'success', true, 
    'credits_used', v_credits_needed, 
    'credits_remaining', v_new_remaining, 
    'status', v_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.credit_policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_network_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_inventory_usage ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS - CREDIT_POLICY_RULES
DROP POLICY IF EXISTS "CreditPolicyRules - Leitura por todos os usuários autenticados" ON public.credit_policy_rules;
CREATE POLICY "CreditPolicyRules - Leitura por todos os usuários autenticados"
  ON public.credit_policy_rules FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "CreditPolicyRules - Gerenciamento por Master Admin" ON public.credit_policy_rules;
CREATE POLICY "CreditPolicyRules - Gerenciamento por Master Admin"
  ON public.credit_policy_rules FOR ALL TO authenticated USING (is_master_admin());

-- POLÍTICAS RLS - COMPANY_NETWORK_PREFERENCES
DROP POLICY IF EXISTS "CompanyNetworkPreferences - Leitura por membros ou Master Admin" ON public.company_network_preferences;
CREATE POLICY "CompanyNetworkPreferences - Leitura por membros ou Master Admin"
  ON public.company_network_preferences FOR SELECT TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "CompanyNetworkPreferences - Gerenciamento por Admins da Empresa ou Master Admin" ON public.company_network_preferences;
CREATE POLICY "CompanyNetworkPreferences - Gerenciamento por Admins da Empresa ou Master Admin"
  ON public.company_network_preferences FOR ALL TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_admin_company_ids()));

-- POLÍTICAS RLS - NETWORK_INVENTORY_LEDGER
DROP POLICY IF EXISTS "NetworkInventoryLedger - Leitura por membros ou Master Admin" ON public.network_inventory_ledger;
CREATE POLICY "NetworkInventoryLedger - Leitura por membros ou Master Admin"
  ON public.network_inventory_ledger FOR SELECT TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

-- POLÍTICAS RLS - NETWORK_INVENTORY_USAGE
DROP POLICY IF EXISTS "NetworkInventoryUsage - Leitura por exibidora, anunciante ou Master Admin" ON public.network_inventory_usage;
CREATE POLICY "NetworkInventoryUsage - Leitura por exibidora, anunciante ou Master Admin"
  ON public.network_inventory_usage FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    display_company_id IN (SELECT public.get_user_company_ids()) OR
    advertiser_company_id IN (SELECT public.get_user_company_ids())
  );
