-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5C: CADASTRO FINANCEIRO DE EXIBIDORES
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE PERFIS FINANCEIROS DAS EXIBIDORAS (SELLER_FINANCIAL_PROFILES)
CREATE TABLE IF NOT EXISTS public.seller_financial_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('cnpj', 'cpf')),
  document_number TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  responsible_name TEXT NOT NULL,
  responsible_email TEXT NOT NULL,
  responsible_phone TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_agency TEXT NOT NULL,
  bank_account TEXT NOT NULL,
  bank_account_digit TEXT NOT NULL,
  bank_account_type TEXT NOT NULL CHECK (bank_account_type IN ('checking', 'savings')),
  pix_key_type TEXT CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')),
  pix_key TEXT,
  asaas_wallet_id TEXT,
  asaas_account_id TEXT,
  asaas_status TEXT NOT NULL DEFAULT 'not_created' CHECK (asaas_status IN ('not_created', 'created', 'pending_validation', 'active', 'rejected', 'blocked')),
  verification_status TEXT NOT NULL DEFAULT 'draft' CHECK (verification_status IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_fin_company_id ON public.seller_financial_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_seller_fin_verification_status ON public.seller_financial_profiles(verification_status);

-- 2. TABELA DE HISTÓRICO E LOGS DE ALTERAÇÃO (SELLER_FINANCIAL_PROFILE_LOGS)
CREATE TABLE IF NOT EXISTS public.seller_financial_profile_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_financial_profile_id UUID REFERENCES public.seller_financial_profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_fin_logs_profile_id ON public.seller_financial_profile_logs(seller_financial_profile_id);

-- 3. TRIGGER: RESET DE APROVAÇÃO SE DADOS SENSÍVEIS FOREM ALTERADOS EM PERFIL APROVADO
CREATE OR REPLACE FUNCTION public.fn_reset_seller_financial_profile_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.verification_status = 'approved' AND (
    NEW.document_number <> OLD.document_number OR
    NEW.bank_code <> OLD.bank_code OR
    NEW.bank_agency <> OLD.bank_agency OR
    NEW.bank_account <> OLD.bank_account OR
    NEW.bank_account_digit <> OLD.bank_account_digit OR
    COALESCE(NEW.pix_key, '') <> COALESCE(OLD.pix_key, '')
  ) THEN
    NEW.verification_status := 'pending_review';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seller_financial_profile_reset_review ON public.seller_financial_profiles;

CREATE TRIGGER trg_seller_financial_profile_reset_review
  BEFORE UPDATE ON public.seller_financial_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_reset_seller_financial_profile_status();

-- 4. HABILITAR RLS E SEGURANÇA MULTIEMPRESA
ALTER TABLE public.seller_financial_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_financial_profile_logs ENABLE ROW LEVEL SECURITY;

-- Politica: Master Admin Acesso Total
CREATE POLICY "SellerProfiles - Master Admin Full Access"
  ON public.seller_financial_profiles FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

-- Politica: Membro da Empresa Leitura dos Próprios Dados
CREATE POLICY "SellerProfiles - Company Member Read"
  ON public.seller_financial_profiles FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids()));

-- Politica: Admin da Empresa Criação do Próprio Perfil
CREATE POLICY "SellerProfiles - Company Admin Insert"
  ON public.seller_financial_profiles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_id = NEW.company_id AND user_id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  );

-- Politica: Admin da Empresa Edição do Próprio Perfil
CREATE POLICY "SellerProfiles - Company Admin Update"
  ON public.seller_financial_profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_id = seller_financial_profiles.company_id AND user_id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  );

-- Politica Logs: Master Admin e Membros da Própria Empresa
CREATE POLICY "SellerProfileLogs - Master Admin & Company Read"
  ON public.seller_financial_profile_logs FOR SELECT TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT get_user_company_ids()));
