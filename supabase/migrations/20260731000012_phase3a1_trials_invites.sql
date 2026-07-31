-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3A.1: TRIAL DE 60 DIAS E CONVITES VIP
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE TRIALS DAS EMPRESAS (COMPANY_TRIALS)
CREATE TABLE IF NOT EXISTS public.company_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trial_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  trial_end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '60 days'),
  trial_days INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'converted', 'cancelled')),
  converted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir no máximo 1 trial ativo por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_company_trial 
  ON public.company_trials(company_id) 
  WHERE (status = 'active');

CREATE INDEX IF NOT EXISTS idx_company_trials_company_id ON public.company_trials(company_id);
CREATE INDEX IF NOT EXISTS idx_company_trials_status ON public.company_trials(status);

-- 2. TABELA DE CONVITES VIP (REFERRAL_INVITES)
CREATE TABLE IF NOT EXISTS public.referral_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  converted_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  invited_company_name TEXT NOT NULL,
  invited_contact_name TEXT,
  invited_phone TEXT,
  invited_email TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  trial_days INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'sent', 'accepted', 'expired', 'converted', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  accepted_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_invites_inviter ON public.referral_invites(inviter_company_id);
CREATE INDEX IF NOT EXISTS idx_referral_invites_code ON public.referral_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_referral_invites_status ON public.referral_invites(status);

-- 3. TRIGGER DE LIMITE DE CONVITES (MÁXIMO 3 CONVITES VIP POR EMPRESA)
CREATE OR REPLACE FUNCTION public.check_referral_invite_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_invite_count INTEGER := 0;
  v_is_converted BOOLEAN := FALSE;
BEGIN
  -- Verificar se a empresa emissora possui status de trial 'converted' ou convite VIP aceito
  PERFORM 1 FROM public.company_trials 
  WHERE company_id = NEW.inviter_company_id AND status = 'converted';

  IF FOUND THEN
    v_is_converted := TRUE;
  ELSE
    -- Permitir também se for Master Admin
    IF is_master_admin() THEN
      v_is_converted := TRUE;
    END IF;
  END IF;

  IF NOT v_is_converted THEN
    RAISE EXCEPTION 'Apenas empresas com trial convertido ou plano ativado podem emitir convites VIP.';
  END IF;

  -- Contar convites ativos/criados/aceitos/convertidos (convites cancelados ou expirados liberam vaga)
  SELECT COUNT(*) INTO v_invite_count
  FROM public.referral_invites
  WHERE inviter_company_id = NEW.inviter_company_id
    AND status IN ('created', 'sent', 'accepted', 'converted');

  IF v_invite_count >= 3 THEN
    RAISE EXCEPTION 'Limite atingido: A empresa pode emitir no máximo 3 convites VIP ativos ou utilizados.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_referral_invite_limit ON public.referral_invites;
CREATE TRIGGER trg_check_referral_invite_limit
  BEFORE INSERT ON public.referral_invites
  FOR EACH ROW EXECUTE FUNCTION public.check_referral_invite_limit();

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.company_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_invites ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS - COMPANY_TRIALS
CREATE POLICY "CompanyTrials - Leitura por membros da empresa ou Master Admin"
  ON public.company_trials FOR SELECT TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "CompanyTrials - Gerenciamento por Admins da Empresa ou Master Admin"
  ON public.company_trials FOR ALL TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE));

-- POLÍTICAS RLS - REFERRAL_INVITES
CREATE POLICY "ReferralInvites - Leitura por empresa emissora ou Master Admin"
  ON public.referral_invites FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    inviter_company_id IN (SELECT public.get_user_company_ids()) OR
    converted_company_id IN (SELECT public.get_user_company_ids())
  );

CREATE POLICY "ReferralInvites - Gerenciamento por Admins da Empresa ou Master Admin"
  ON public.referral_invites FOR ALL TO authenticated
  USING (is_master_admin() OR inviter_company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE));
