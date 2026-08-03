-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 1: FUNDAÇÃO SAAS MULTIEMPRESA
-- Data: 2026-07-31
-- ============================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. TABELAS BASE DA APLICAÇÃO
-- ============================================================================

-- 2.1 PROFILES (Dados do Usuário alinhados com auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  is_master_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 COMPANIES (Empresas / Tenants)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name TEXT NOT NULL,
  corporate_name TEXT,
  cnpj TEXT UNIQUE,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  neighborhood TEXT,
  address TEXT,
  accepts_external_media BOOLEAN DEFAULT TRUE,
  accepts_exchange BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 COMPANY_USERS (Junção N:N Usuário ↔ Empresa com Roles)
CREATE TABLE IF NOT EXISTS public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'external')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_company_user UNIQUE(company_id, user_id)
);

-- 2.4 SEGMENTS (Segmentos de Mercado)
CREATE TABLE IF NOT EXISTS public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 COMPANY_SEGMENTS (Mapeamento de Segmentos por Empresa)
CREATE TABLE IF NOT EXISTS public.company_segments (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (company_id, segment_id)
);

-- 2.6 WALLETS (Carteira de Créditos por Empresa)
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.7 WALLET_TRANSACTIONS (Extrato Imutável de Créditos)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  previous_balance NUMERIC(12,2) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  new_balance NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  source TEXT NOT NULL CHECK (source IN ('manual_grant', 'purchase', 'exchange_earn', 'campaign_spend', 'refund', 'system_bonus')),
  description TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.8 AUDIT_LOGS (Logs de Auditoria Administrativa)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. FUNÇÕES DE SUPORTE E SEGURANÇA (SECURITY DEFINER)
-- ============================================================================

-- 3.1 Verifica se o usuário atual é Master Admin
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT is_master_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3.2 Retorna os IDs das empresas às quais o usuário autenticado tem acesso
CREATE OR REPLACE FUNCTION public.get_user_company_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT company_id 
  FROM public.company_users 
  WHERE user_id = auth.uid() AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3.3 Logger de Auditoria Helper
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID,
  p_company_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (p_user_id, p_company_id, p_action, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.4 PREVENÇÃO DE ELEVAÇÃO DE PRIVILÉGIO (IS_MASTER_ADMIN)
CREATE OR REPLACE FUNCTION public.prevent_self_master_admin_elevation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_master_admin IS DISTINCT FROM NEW.is_master_admin THEN
    IF NOT public.is_master_admin() THEN
      RAISE EXCEPTION 'Acesso negado: Apenas Master Admins existentes podem alterar o status is_master_admin.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_profile_master_admin_elevation ON public.profiles;
CREATE TRIGGER check_profile_master_admin_elevation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_master_admin_elevation();

-- 3.5 RPC ATÔMICA E PROTEGIDA PARA MOVIMENTAÇÃO DE CRÉDITOS
CREATE OR REPLACE FUNCTION public.process_credit_transaction(
  p_company_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_source TEXT,
  p_description TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id UUID;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Validação de Permissão (Master Admin ou Admin da empresa)
  IF NOT (
    public.is_master_admin() OR 
    EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = p_company_id 
        AND user_id = v_caller_id 
        AND role = 'admin' 
        AND is_active = TRUE
    )
  ) THEN
    RAISE EXCEPTION 'Acesso Negado: Você não possui permissão de Administrador para movimentar créditos da empresa %', p_company_id;
  END IF;

  -- Validar tipo de transação
  IF p_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'Tipo de transação inválido: %. Deve ser credit ou debit.', p_type;
  END IF;

  -- Validar origem
  IF p_source NOT IN ('manual_grant', 'purchase', 'exchange_earn', 'campaign_spend', 'refund', 'system_bonus') THEN
    RAISE EXCEPTION 'Origem de transação inválida: %', p_source;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor da transação deve ser estritamente positivo. Valor informado: %', p_amount;
  END IF;

  -- Trava pessimista (FOR UPDATE) na carteira
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM public.wallets
  WHERE company_id = p_company_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Carteira não encontrada para a empresa %', p_company_id;
  END IF;

  -- Calcular novo saldo e impedir saldo negativo
  IF p_type = 'credit' THEN
    v_new_balance := v_current_balance + ABS(p_amount);
  ELSE
    IF v_current_balance < ABS(p_amount) THEN
      RAISE EXCEPTION 'Saldo insuficiente na carteira. Saldo atual: %, Valor solicitado: %', v_current_balance, ABS(p_amount);
    END IF;
    v_new_balance := v_current_balance - ABS(p_amount);
  END IF;

  -- Atualizar saldo na tabela wallets
  UPDATE public.wallets
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Inserir extrato imutável
  INSERT INTO public.wallet_transactions (
    wallet_id,
    company_id,
    previous_balance,
    amount,
    new_balance,
    type,
    source,
    description,
    user_id
  ) VALUES (
    v_wallet_id,
    p_company_id,
    v_current_balance,
    CASE WHEN p_type = 'credit' THEN ABS(p_amount) ELSE -ABS(p_amount) END,
    v_new_balance,
    p_type,
    p_source,
    p_description,
    COALESCE(p_user_id, v_caller_id)
  )
  RETURNING id INTO v_transaction_id;

  -- Registrar no log de auditoria
  PERFORM public.log_audit_event(
    COALESCE(p_user_id, v_caller_id),
    p_company_id,
    'CREDIT_TRANSACTION_PROCESSED',
    jsonb_build_object(
      'wallet_id', v_wallet_id,
      'previous_balance', v_current_balance,
      'amount', p_amount,
      'new_balance', v_new_balance,
      'type', p_type,
      'source', p_source,
      'description', p_description
    )
  );

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. TRIGGERS AUTOMÁTICAS DO BANCO
-- ============================================================================

-- 4.1 Sync de auth.users -> public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4.2 Auto-criação de Wallets ao registrar nova Company
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar carteira zerada para a nova empresa
  INSERT INTO public.wallets (company_id, balance)
  VALUES (NEW.id, 0.00)
  ON CONFLICT (company_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_company();

-- ============================================================================
-- 5. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5.1 RLS - PROFILES
DROP POLICY IF EXISTS "Profiles - Master Admin tudo, Usuários lêem/editam próprio perfil" ON public.profiles;
CREATE POLICY "Profiles - Master Admin tudo, Usuários lêem/editam próprio perfil"
  ON public.profiles FOR ALL
  TO authenticated
  USING (is_master_admin() OR id = auth.uid())
  WITH CHECK (is_master_admin() OR id = auth.uid());

-- 5.2 RLS - COMPANIES
DROP POLICY IF EXISTS "Companies - Master Admin vê todas, Usuários vêem vinculadas" ON public.companies;
CREATE POLICY "Companies - Master Admin vê todas, Usuários vêem vinculadas"
  ON public.companies FOR SELECT
  TO authenticated
  USING (is_master_admin() OR id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "Companies - Usuários autenticados criam empresas" ON public.companies;
CREATE POLICY "Companies - Usuários autenticados criam empresas"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Companies - Master Admin e Admins da empresa editam" ON public.companies;
CREATE POLICY "Companies - Master Admin e Admins da empresa editam"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR 
    id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 5.3 RLS - COMPANY_USERS
DROP POLICY IF EXISTS "CompanyUsers - Master Admin vê todos, Usuários vêem de suas empresas" ON public.company_users;
CREATE POLICY "CompanyUsers - Master Admin vê todos, Usuários vêem de suas empresas"
  ON public.company_users FOR SELECT
  TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "CompanyUsers - Master Admin e Admins gerenciam membros" ON public.company_users;
CREATE POLICY "CompanyUsers - Master Admin e Admins gerenciam membros"
  ON public.company_users FOR ALL
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 5.4 RLS - SEGMENTS
DROP POLICY IF EXISTS "Segments - Leitura pública para autenticados" ON public.segments;
CREATE POLICY "Segments - Leitura pública para autenticados"
  ON public.segments FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Segments - Apenas Master Admin modifica" ON public.segments;
CREATE POLICY "Segments - Apenas Master Admin modifica"
  ON public.segments FOR ALL
  TO authenticated
  USING (is_master_admin());

-- 5.5 RLS - COMPANY_SEGMENTS
DROP POLICY IF EXISTS "CompanySegments - Leitura para membros da empresa ou Master" ON public.company_segments;
CREATE POLICY "CompanySegments - Leitura para membros da empresa ou Master"
  ON public.company_segments FOR SELECT
  TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "CompanySegments - Edição por Admins da empresa ou Master" ON public.company_segments;
CREATE POLICY "CompanySegments - Edição por Admins da empresa ou Master"
  ON public.company_segments FOR ALL
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 5.6 RLS - WALLETS (REGRA RÍGIDA: UPDATE BLOQUEADO PARA CLIENTES)
DROP POLICY IF EXISTS "Wallets - Leitura para membros da empresa ou Master Admin" ON public.wallets;
CREATE POLICY "Wallets - Leitura para membros da empresa ou Master Admin"
  ON public.wallets FOR SELECT
  TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

-- NENHUMA POLÍTICA DE UPDATE É CRIADA PARA CLIENTES COMUNS.
-- Alteração de saldo só pode ocorrer via SECURITY DEFINER (process_credit_transaction RPC).

-- 5.7 RLS - WALLET_TRANSACTIONS
DROP POLICY IF EXISTS "WalletTransactions - Leitura para membros da empresa ou Master Admin" ON public.wallet_transactions;
CREATE POLICY "WalletTransactions - Leitura para membros da empresa ou Master Admin"
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

-- 5.8 RLS - AUDIT_LOGS
DROP POLICY IF EXISTS "AuditLogs - Leitura para Master Admin ou Admins da empresa" ON public.audit_logs;
CREATE POLICY "AuditLogs - Leitura para Master Admin ou Admins da empresa"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "AuditLogs - Inserção de eventos autorizados" ON public.audit_logs;
CREATE POLICY "AuditLogs - Inserção de eventos autorizados"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR is_master_admin()
  );

-- ============================================================================
-- 6. DADOS INICIAIS (SEED SEGMENTS)
-- ============================================================================
INSERT INTO public.segments (name, description, icon) VALUES
  ('Fitness / Academias', 'Academias, crossfit, estúdios de pilates e lutas', 'dumbbell'),
  ('Bares & Restaurantes', 'Restaurantes, lanchonetes, bares e cafeterias', 'utensils'),
  ('Clínicas & Saúde', 'Clínicas médicas, odontológicas e laboratórios', 'activity'),
  ('Educação & Cursos', 'Escolas, faculdades e centros de idiomas', 'book-open'),
  ('Varejo & Lojas', 'Lojas de roupas, calçados e conveniência', 'shopping-bag'),
  ('Serviços Automotivos', 'Postos de combustível, lava-rápidos e oficinas', 'car'),
  ('Beleza & Estética', 'Salões de beleza, barbearias e clínicas de estética', 'scissors'),
  ('Outros', 'Demais segmentos de mercado', 'grid')
ON CONFLICT (name) DO NOTHING;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 1: CORREÇÕES DE AUDITORIA E SEGURANÇA (AUDIT FIXES)
-- Data: 2026-07-31
-- ============================================================================

-- 1. PROTEÇÃO CONTRA AUTO-ELEVAÇÃO DE PERFIL (IS_MASTER_ADMIN)
-- Impede que um usuário comum envie UPDATE profiles SET is_master_admin = true
CREATE OR REPLACE FUNCTION public.prevent_self_master_admin_elevation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_master_admin IS DISTINCT FROM NEW.is_master_admin THEN
    -- Se quem está tentando mudar NÃO era Master Admin previamente
    IF NOT public.is_master_admin() THEN
      RAISE EXCEPTION 'Acesso negado: Apenas Master Admins existentes podem alterar o status is_master_admin.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_profile_master_admin_elevation ON public.profiles;
CREATE TRIGGER check_profile_master_admin_elevation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_master_admin_elevation();


-- 2. CORREÇÃO DE SEGURANÇA NA RPC PROCESS_CREDIT_TRANSACTION
-- Valida obrigatoriamente se o auth.uid() é Master Admin ou Admin da empresa que possui a carteira
CREATE OR REPLACE FUNCTION public.process_credit_transaction(
  p_company_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_source TEXT,
  p_description TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id UUID;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- 2.1 VALIDAÇÃO RIGOROSA DE PERMISSÃO DO CHAMADOR
  IF NOT (
    public.is_master_admin() OR 
    EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = p_company_id 
        AND user_id = v_caller_id 
        AND role = 'admin' 
        AND is_active = TRUE
    )
  ) THEN
    RAISE EXCEPTION 'Acesso Negado: Você não possui permissão de Administrador para movimentar créditos da empresa %', p_company_id;
  END IF;

  -- 2.2 VALIDAÇÃO DOS PARÂMETROS
  IF p_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'Tipo de transação inválido: %. Deve ser credit ou debit.', p_type;
  END IF;

  IF p_source NOT IN ('manual_grant', 'purchase', 'exchange_earn', 'campaign_spend', 'refund', 'system_bonus') THEN
    RAISE EXCEPTION 'Origem de transação inválida: %', p_source;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor da transação deve ser estritamente positivo. Valor informado: %', p_amount;
  END IF;

  -- 2.3 TRAVA PESSIMISTA (FOR UPDATE) NA CARTEIRA
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM public.wallets
  WHERE company_id = p_company_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Carteira não encontrada para a empresa %', p_company_id;
  END IF;

  -- 2.4 CÁLCULO E PROTEÇÃO CONTRA SALDO NEGATIVO
  IF p_type = 'credit' THEN
    v_new_balance := v_current_balance + ABS(p_amount);
  ELSE
    IF v_current_balance < ABS(p_amount) THEN
      RAISE EXCEPTION 'Saldo insuficiente na carteira. Saldo atual: %, Valor solicitado: %', v_current_balance, ABS(p_amount);
    END IF;
    v_new_balance := v_current_balance - ABS(p_amount);
  END IF;

  -- 2.5 ATUALIZAÇÃO DA CARTEIRA
  UPDATE public.wallets
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  -- 2.6 INSERÇÃO ATÔMICA NO EXTRATO IMUTÁVEL
  INSERT INTO public.wallet_transactions (
    wallet_id,
    company_id,
    previous_balance,
    amount,
    new_balance,
    type,
    source,
    description,
    user_id
  ) VALUES (
    v_wallet_id,
    p_company_id,
    v_current_balance,
    CASE WHEN p_type = 'credit' THEN ABS(p_amount) ELSE -ABS(p_amount) END,
    v_new_balance,
    p_type,
    p_source,
    p_description,
    COALESCE(p_user_id, v_caller_id)
  )
  RETURNING id INTO v_transaction_id;

  -- 2.7 AUDITORIA DO EVENTO
  PERFORM public.log_audit_event(
    COALESCE(p_user_id, v_caller_id),
    p_company_id,
    'CREDIT_TRANSACTION_PROCESSED',
    jsonb_build_object(
      'wallet_id', v_wallet_id,
      'previous_balance', v_current_balance,
      'amount', p_amount,
      'new_balance', v_new_balance,
      'type', p_type,
      'source', p_source,
      'description', p_description
    )
  );

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. AJUSTE DE RLS EM AUDIT_LOGS (PERMITIR INSERÇÃO APENAS PARA AÇÕES PRÓPRIAS)
DROP POLICY IF EXISTS "AuditLogs - Leitura para Master Admin ou Admins da empresa" ON public.audit_logs;

DROP POLICY IF EXISTS "AuditLogs - Leitura para Master Admin ou Admins da empresa" ON public.audit_logs;
CREATE POLICY "AuditLogs - Leitura para Master Admin ou Admins da empresa"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "AuditLogs - Inserção de eventos autorizados" ON public.audit_logs;
CREATE POLICY "AuditLogs - Inserção de eventos autorizados"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR is_master_admin()
  );
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2A: TELAS E PAREAMENTO (SCREENS)
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE TELAS (SCREENS)
CREATE TABLE IF NOT EXISTS public.screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  orientation TEXT NOT NULL CHECK (orientation IN ('horizontal', 'vertical')),
  resolution TEXT DEFAULT '1920x1080',
  location_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending_pairing' CHECK (status IN ('pending_pairing', 'online', 'offline', 'inactive')),
  device_token_hash TEXT,
  last_ping_at TIMESTAMPTZ,
  paired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para buscas rápidas de heartbeat via hash do token
CREATE INDEX IF NOT EXISTS idx_screens_device_token_hash ON public.screens(device_token_hash);
CREATE INDEX IF NOT EXISTS idx_screens_company_id ON public.screens(company_id);

-- 2. TABELA DE CÓDIGOS DE PAREAMENTO (SCREEN_PAIRING_CODES)
CREATE TABLE IF NOT EXISTS public.screen_pairing_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  screen_id UUID REFERENCES public.screens(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  encrypted_device_token JSONB, -- Payload criptografado em AES-256-GCM (Zero texto claro)
  pairing_secret_hash TEXT,     -- Hash SHA-256 da chave de pareamento do cliente
  device_fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paired', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  paired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pairing_codes_code ON public.screen_pairing_codes(code);

-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_pairing_codes ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS - SCREENS
DROP POLICY IF EXISTS "Screens - Leitura para membros da empresa ou Master Admin" ON public.screens;
CREATE POLICY "Screens - Leitura para membros da empresa ou Master Admin"
  ON public.screens FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "Screens - Inserção por Admins da Empresa ou Master Admin" ON public.screens;
CREATE POLICY "Screens - Inserção por Admins da Empresa ou Master Admin"
  ON public.screens FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR 
    company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE)
  );

DROP POLICY IF EXISTS "Screens - Edição por Admins da Empresa ou Master Admin" ON public.screens;
CREATE POLICY "Screens - Edição por Admins da Empresa ou Master Admin"
  ON public.screens FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE)
  );

DROP POLICY IF EXISTS "Screens - Exclusão restrita a Admins da Empresa ou Master Admin" ON public.screens;
CREATE POLICY "Screens - Exclusão restrita a Admins da Empresa ou Master Admin"
  ON public.screens FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE)
  );

-- 5. POLÍTICAS RLS - SCREEN_PAIRING_CODES
DROP POLICY IF EXISTS "PairingCodes - Leitura Master Admin" ON public.screen_pairing_codes;
CREATE POLICY "PairingCodes - Leitura Master Admin"
  ON public.screen_pairing_codes FOR SELECT
  TO authenticated
  USING (is_master_admin());
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2A: HARDENING DE SEGURANÇA NO PAREAMENTO
-- Remoção total de tokens em texto claro no banco de dados.
-- Data: 2026-07-31
-- ============================================================================

-- 1. REMOVER CAMPO EM TEXTO CLARO TEMP_DEVICE_TOKEN
ALTER TABLE public.screen_pairing_codes DROP COLUMN IF EXISTS temp_device_token;

-- 2. ADICIONAR CAMPOS DE CRIPTOGRAFIA AES-256-GCM E HASH DE SEGREDO
ALTER TABLE public.screen_pairing_codes ADD COLUMN IF NOT EXISTS encrypted_device_token JSONB;
ALTER TABLE public.screen_pairing_codes ADD COLUMN IF NOT EXISTS pairing_secret_hash TEXT;

-- 3. REFORÇAR RLS EM SCREEN_PAIRING_CODES (NENHUM CLIENTE COMUM PODE LER OU INSERIR DIRETO)
DROP POLICY IF EXISTS "PairingCodes - Leitura Master Admin" ON public.screen_pairing_codes;

DROP POLICY IF EXISTS "PairingCodes - Leitura Master Admin" ON public.screen_pairing_codes;
CREATE POLICY "PairingCodes - Leitura Master Admin"
  ON public.screen_pairing_codes FOR SELECT
  TO authenticated
  USING (is_master_admin());

-- Nenhuma política de INSERT/UPDATE para o cliente. Acesso 100% isolado via Server Actions.
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2B: MÍDIAS E STORAGE (MEDIA_ASSETS)
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE MÍDIAS (MEDIA_ASSETS)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  orientation TEXT NOT NULL DEFAULT 'horizontal' CHECK (orientation IN ('horizontal', 'vertical', 'square', 'unknown')),
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  playback_duration_seconds INTEGER NOT NULL CHECK (playback_duration_seconds IN (5, 10, 15, 30)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  rejection_reason TEXT,
  is_external BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para buscas e ordenação rápida por tenant e status
CREATE INDEX IF NOT EXISTS idx_media_assets_company_id ON public.media_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON public.media_assets(status);

-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS RLS - MEDIA_ASSETS
-- 3.1 LEITURA: Master Admin ou membros ativos (Admin e Operador) da mesma empresa
DROP POLICY IF EXISTS "MediaAssets - Leitura para membros da empresa ou Master Admin" ON public.media_assets;
CREATE POLICY "MediaAssets - Leitura para membros da empresa ou Master Admin"
  ON public.media_assets FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

-- 3.2 INSERÇÃO: Admins e Operadores ativos da mesma empresa
DROP POLICY IF EXISTS "MediaAssets - Inserção por membros da empresa ou Master Admin" ON public.media_assets;
CREATE POLICY "MediaAssets - Inserção por membros da empresa ou Master Admin"
  ON public.media_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

-- 3.3 EDIÇÃO/ATUALIZAÇÃO:
-- Master Admin ou Admin da empresa podem editar tudo (inclusive aprovar/reprovar status).
-- Operadores podem editar título/descrição de mídias de sua própria empresa.
DROP POLICY IF EXISTS "MediaAssets - Edição para membros da empresa ou Master Admin" ON public.media_assets;
CREATE POLICY "MediaAssets - Edição para membros da empresa ou Master Admin"
  ON public.media_assets FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  )
  WITH CHECK (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

-- 3.4 EXCLUSÃO / ARQUIVAMENTO FÍSICO: Restrito a Master Admin ou Admin da empresa
DROP POLICY IF EXISTS "MediaAssets - Exclusão por Admins da Empresa ou Master Admin" ON public.media_assets;
CREATE POLICY "MediaAssets - Exclusão por Admins da Empresa ou Master Admin"
  ON public.media_assets FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE)
  );

-- ============================================================================
-- 4. CONFIGURAÇÃO E SEGURANÇA DO SUPABASE STORAGE BUCKET (MEDIA-ASSETS)
-- ============================================================================

-- Inserir o bucket 'media-assets' na tabela de buckets do Supabase se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-assets', 'media-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para o schema storage.objects no bucket media-assets
-- O caminho do arquivo segue a estrutura: {company_id}/{media_id}/{filename}

-- Leitura de arquivos do Storage: Autenticados da mesma empresa ou Master Admin
DROP POLICY IF EXISTS "Storage - Leitura de mídias por empresa" ON storage.objects;
CREATE POLICY "Storage - Leitura de mídias por empresa"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'media-assets' AND (
      is_master_admin() OR 
      (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_company_ids())
    )
  );

-- Leitura pública para exibição de imagens/vídeos nos players e previews do dashboard
DROP POLICY IF EXISTS "Storage - Leitura pública para renderização de mídias" ON storage.objects;
CREATE POLICY "Storage - Leitura pública para renderização de mídias"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'media-assets');

-- Upload de arquivos: Restrito a usuários autenticados da empresa pertencente ao caminho
DROP POLICY IF EXISTS "Storage - Upload por membros da empresa" ON storage.objects;
CREATE POLICY "Storage - Upload por membros da empresa"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media-assets' AND (
      is_master_admin() OR 
      (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_company_ids())
    )
  );

-- Remoção/Exclusão no Storage: Restrito a Admins da Empresa ou Master Admin
DROP POLICY IF EXISTS "Storage - Remoção por Admins da Empresa ou Master Admin" ON storage.objects;
CREATE POLICY "Storage - Remoção por Admins da Empresa ou Master Admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media-assets' AND (
      is_master_admin() OR 
      (storage.foldername(name))[1]::uuid IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE)
    )
  );
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2B: HARDENING DE SEGURANÇA CORRIGIDO
-- Data: 2026-07-31
-- ============================================================================

-- 1. TORNAR O BUCKET 'MEDIA-ASSETS' PRIVADO E REMOVER ACESSO PÚBLICO IRRESTRITO
UPDATE storage.buckets
SET public = false
WHERE id = 'media-assets';

-- Remover a política pública de leitura
DROP POLICY IF EXISTS "Storage - Leitura pública para renderização de mídias" ON storage.objects;
DROP POLICY IF EXISTS "Storage - Leitura de mídias por empresa" ON storage.objects;
DROP POLICY IF EXISTS "Storage - Leitura estrita de mídias por empresa" ON storage.objects;

-- Recriar política estrita de leitura no Storage para usuários autenticados da mesma empresa ou Master Admin
DROP POLICY IF EXISTS "Storage - Leitura estrita de mídias por empresa" ON storage.objects;
CREATE POLICY "Storage - Leitura estrita de mídias por empresa"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'media-assets' AND (
      is_master_admin() OR 
      (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_company_ids())
    )
  );

-- 2. TRIGGER DE SEGURANÇA CONTRA ALTERAÇÃO INDEVIDA DE STATUS POR OPERADORES (CORRIGIDO)
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_media_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
  v_is_master BOOLEAN;
BEGIN
  -- Se status e motivo de reprovação NÃO mudaram, permitir a edição comum (ex: alterar título/descrição)
  IF OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.rejection_reason IS NOT DISTINCT FROM NEW.rejection_reason THEN
    RETURN NEW;
  END IF;

  -- Verificar se é Master Admin
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = auth.uid();
  IF v_is_master THEN
    RETURN NEW;
  END IF;

  -- Verificar se o usuário possui papel Admin na empresa proprietária da mídia
  SELECT role INTO v_user_role 
  FROM public.company_users 
  WHERE company_id = OLD.company_id AND user_id = auth.uid() AND is_active = TRUE;

  IF v_user_role IS NULL OR v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores da empresa ou Master Admin podem aprovar, reprovar, arquivar ou alterar o motivo de reprovação de mídias.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_unauthorized_media_status_change ON public.media_assets;
CREATE TRIGGER trg_prevent_unauthorized_media_status_change
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_media_status_change();

-- 3. RPCS SEGURAS PARA MODERAÇÃO DE MÍDIAS (COM SET search_path = public)

-- 3.1 RPC: APROVAR MÍDIA
CREATE OR REPLACE FUNCTION public.approve_media_asset(p_media_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_media RECORD;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Verificar usuário autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Buscar a mídia
  SELECT * INTO v_media FROM public.media_assets WHERE id = p_media_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mídia não encontrada.';
  END IF;

  -- Verificar permissão (Admin da Empresa ou Master Admin)
  IF is_master_admin() THEN
    v_is_admin := TRUE;
  ELSE
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.company_users
    WHERE company_id = v_media.company_id AND user_id = auth.uid() AND is_active = TRUE;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores da empresa podem aprovar mídias.';
  END IF;

  -- Atualizar status
  UPDATE public.media_assets
  SET status = 'approved',
      rejection_reason = NULL,
      updated_at = NOW()
  WHERE id = p_media_id;

  -- Gravar log de auditoria
  PERFORM public.log_audit_event(
    auth.uid(),
    v_media.company_id,
    'MEDIA_APPROVED',
    jsonb_build_object('media_id', p_media_id, 'title', v_media.title)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3.2 RPC: REPROVAR MÍDIA
CREATE OR REPLACE FUNCTION public.reject_media_asset(p_media_id UUID, p_reason TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_media RECORD;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Validação estrita de motivo não nulo e não vazio
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A justificativa de reprovação é obrigatória e não pode ser vazia.';
  END IF;

  SELECT * INTO v_media FROM public.media_assets WHERE id = p_media_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mídia não encontrada.';
  END IF;

  IF is_master_admin() THEN
    v_is_admin := TRUE;
  ELSE
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.company_users
    WHERE company_id = v_media.company_id AND user_id = auth.uid() AND is_active = TRUE;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores da empresa podem reprovar mídias.';
  END IF;

  UPDATE public.media_assets
  SET status = 'rejected',
      rejection_reason = trim(p_reason),
      updated_at = NOW()
  WHERE id = p_media_id;

  PERFORM public.log_audit_event(
    auth.uid(),
    v_media.company_id,
    'MEDIA_REJECTED',
    jsonb_build_object('media_id', p_media_id, 'title', v_media.title, 'reason', trim(p_reason))
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3.3 RPC: ARQUIVAR MÍDIA (ARQUIVAMENTO LÓGICO)
CREATE OR REPLACE FUNCTION public.archive_media_asset(p_media_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_media RECORD;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_media FROM public.media_assets WHERE id = p_media_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mídia não encontrada.';
  END IF;

  IF is_master_admin() THEN
    v_is_admin := TRUE;
  ELSE
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.company_users
    WHERE company_id = v_media.company_id AND user_id = auth.uid() AND is_active = TRUE;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores da empresa podem arquivar mídias.';
  END IF;

  -- Arquivamento lógico (altera status para 'archived', mantendo o registro e o arquivo)
  UPDATE public.media_assets
  SET status = 'archived',
      updated_at = NOW()
  WHERE id = p_media_id;

  PERFORM public.log_audit_event(
    auth.uid(),
    v_media.company_id,
    'MEDIA_ARCHIVED',
    jsonb_build_object('media_id', p_media_id, 'title', v_media.title)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2C: PLAYLISTS, ITENS E ATRIBUIÇÃO A TELAS
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE PLAYLISTS
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  orientation TEXT NOT NULL DEFAULT 'horizontal' CHECK (orientation IN ('horizontal', 'vertical', 'mixed')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playlists_company_id ON public.playlists(company_id);
CREATE INDEX IF NOT EXISTS idx_playlists_status ON public.playlists(status);

-- 2. TABELA DE ITENS DA PLAYLIST (PLAYLIST_ITEMS)
CREATE TABLE IF NOT EXISTS public.playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  playback_duration_seconds INTEGER NOT NULL CHECK (playback_duration_seconds IN (5, 10, 15, 30)),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON public.playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_sort_order ON public.playlist_items(playlist_id, sort_order);

-- 3. TABELA DE VÍNCULO DE PLAYLIST E TELA (SCREEN_PLAYLISTS)
CREATE TABLE IF NOT EXISTS public.screen_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Garantir que cada tela possui no máximo UMA playlist ativa por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_screen_playlists_active_screen 
  ON public.screen_playlists(screen_id) 
  WHERE (is_active = TRUE);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_playlists ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS RLS - PLAYLISTS
DROP POLICY IF EXISTS "Playlists - Leitura por membros da empresa ou Master Admin" ON public.playlists;
CREATE POLICY "Playlists - Leitura por membros da empresa ou Master Admin"
  ON public.playlists FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "Playlists - Inserção por membros da empresa ou Master Admin" ON public.playlists;
CREATE POLICY "Playlists - Inserção por membros da empresa ou Master Admin"
  ON public.playlists FOR INSERT TO authenticated
  WITH CHECK (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "Playlists - Edição por membros da empresa ou Master Admin" ON public.playlists;
CREATE POLICY "Playlists - Edição por membros da empresa ou Master Admin"
  ON public.playlists FOR UPDATE TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "Playlists - Exclusão por Admins da Empresa ou Master Admin" ON public.playlists;
CREATE POLICY "Playlists - Exclusão por Admins da Empresa ou Master Admin"
  ON public.playlists FOR DELETE TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE)
  );

-- 6. POLÍTICAS RLS - PLAYLIST_ITEMS
DROP POLICY IF EXISTS "PlaylistItems - Leitura por membros da empresa ou Master Admin" ON public.playlist_items;
CREATE POLICY "PlaylistItems - Leitura por membros da empresa ou Master Admin"
  ON public.playlist_items FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    playlist_id IN (SELECT id FROM public.playlists WHERE company_id IN (SELECT public.get_user_company_ids()))
  );

DROP POLICY IF EXISTS "PlaylistItems - Gerenciamento por membros da empresa ou Master Admin" ON public.playlist_items;
CREATE POLICY "PlaylistItems - Gerenciamento por membros da empresa ou Master Admin"
  ON public.playlist_items FOR ALL TO authenticated
  USING (
    is_master_admin() OR 
    playlist_id IN (SELECT id FROM public.playlists WHERE company_id IN (SELECT public.get_user_company_ids()))
  );

-- 7. POLÍTICAS RLS - SCREEN_PLAYLISTS
DROP POLICY IF EXISTS "ScreenPlaylists - Leitura por membros da empresa ou Master Admin" ON public.screen_playlists;
CREATE POLICY "ScreenPlaylists - Leitura por membros da empresa ou Master Admin"
  ON public.screen_playlists FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    screen_id IN (SELECT id FROM public.screens WHERE company_id IN (SELECT public.get_user_company_ids()))
  );

DROP POLICY IF EXISTS "ScreenPlaylists - Atribuição por Admins da Empresa ou Master Admin" ON public.screen_playlists;
CREATE POLICY "ScreenPlaylists - Atribuição por Admins da Empresa ou Master Admin"
  ON public.screen_playlists FOR ALL TO authenticated
  USING (
    is_master_admin() OR 
    screen_id IN (SELECT id FROM public.screens WHERE company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE))
  );
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2C: HARDENING DE BANCO, TRIGGERS E INTEGRIDADE
-- Data: 2026-07-31
-- ============================================================================

-- 1. TRIGGER DE INTEGRIDADE PARA PLAYLIST_ITEMS
-- Impede inclusão de mídias de outras empresas ou com status diferente de 'approved'
CREATE OR REPLACE FUNCTION public.check_playlist_item_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_playlist_company_id UUID;
  v_media RECORD;
BEGIN
  -- Buscar a empresa da playlist
  SELECT company_id INTO v_playlist_company_id FROM public.playlists WHERE id = NEW.playlist_id;
  IF v_playlist_company_id IS NULL THEN
    RAISE EXCEPTION 'Playlist não encontrada.';
  END IF;

  -- Buscar a mídia
  SELECT company_id, status INTO v_media FROM public.media_assets WHERE id = NEW.media_asset_id;
  IF v_media.company_id IS NULL THEN
    RAISE EXCEPTION 'Mídia não encontrada.';
  END IF;

  -- 1. Validar empresa igual
  IF v_media.company_id != v_playlist_company_id THEN
    RAISE EXCEPTION 'Violação de segurança no banco: A mídia deve pertencer à mesma empresa da playlist.';
  END IF;

  -- 2. Validar status obrigatoriamente 'approved'
  IF v_media.status != 'approved' THEN
    RAISE EXCEPTION 'Violação de integridade no banco: Apenas mídias com status Aprovada podem ser inseridas na playlist.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_playlist_item_integrity ON public.playlist_items;
CREATE TRIGGER trg_check_playlist_item_integrity
  BEFORE INSERT OR UPDATE ON public.playlist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_playlist_item_integrity();

-- 2. TRIGGER DE INTEGRIDADE PARA SCREEN_PLAYLISTS
-- Impede atribuição de playlist de outra empresa a uma TV
CREATE OR REPLACE FUNCTION public.check_screen_playlist_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_screen_company_id UUID;
  v_playlist_company_id UUID;
BEGIN
  SELECT company_id INTO v_screen_company_id FROM public.screens WHERE id = NEW.screen_id;
  SELECT company_id INTO v_playlist_company_id FROM public.playlists WHERE id = NEW.playlist_id;

  IF v_screen_company_id IS NULL OR v_playlist_company_id IS NULL THEN
    RAISE EXCEPTION 'Tela ou Playlist não encontrada.';
  END IF;

  IF v_screen_company_id != v_playlist_company_id THEN
    RAISE EXCEPTION 'Violação de segurança no banco: Tela e Playlist devem pertencer à mesma empresa.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_screen_playlist_integrity ON public.screen_playlists;
CREATE TRIGGER trg_check_screen_playlist_integrity
  BEFORE INSERT OR UPDATE ON public.screen_playlists
  FOR EACH ROW
  EXECUTE FUNCTION public.check_screen_playlist_integrity();

-- 3. RPC ATÔMICA: ATRIBUIR PLAYLIST À TELA (DESATIVA ANTERIORES E ATIVA NOVA)
CREATE OR REPLACE FUNCTION public.assign_playlist_to_screen(
  p_screen_id UUID,
  p_playlist_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_screen RECORD;
  v_playlist RECORD;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- 1. Autenticação do usuário
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- 2. Buscar Tela e Playlist
  SELECT * INTO v_screen FROM public.screens WHERE id = p_screen_id;
  SELECT * INTO v_playlist FROM public.playlists WHERE id = p_playlist_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tela ou Playlist não encontrada.';
  END IF;

  -- 3. Validar mesma empresa no banco
  IF v_screen.company_id != v_playlist.company_id THEN
    RAISE EXCEPTION 'A tela e a playlist devem pertencer à mesma empresa.';
  END IF;

  -- 4. Validar permissão (Admin da Empresa ou Master Admin)
  IF is_master_admin() THEN
    v_is_admin := TRUE;
  ELSE
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.company_users
    WHERE company_id = v_screen.company_id AND user_id = auth.uid() AND is_active = TRUE;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores da empresa ou Master Admin podem atribuir playlists a telas.';
  END IF;

  -- 5. Troca Atômica: Desativar vínculos anteriores da tela
  UPDATE public.screen_playlists
  SET is_active = FALSE
  WHERE screen_id = p_screen_id;

  -- 6. Inserir novo vínculo ativo
  INSERT INTO public.screen_playlists (screen_id, playlist_id, is_active, assigned_by)
  VALUES (p_screen_id, p_playlist_id, TRUE, auth.uid());

  -- 7. Registrar Auditoria
  PERFORM public.log_audit_event(
    auth.uid(),
    v_screen.company_id,
    'SCREEN_PLAYLIST_ASSIGNED',
    jsonb_build_object('screen_id', p_screen_id, 'playlist_id', p_playlist_id, 'playlist_name', v_playlist.name)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2D: PLAYBACK LOGS & PROOF OF PLAY
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE LOGS DE EXIBIÇÃO (PLAYBACK_LOGS)
CREATE TABLE IF NOT EXISTS public.playback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL,
  playlist_item_id UUID REFERENCES public.playlist_items(id) ON DELETE SET NULL,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  planned_duration_seconds INTEGER NOT NULL,
  actual_duration_seconds NUMERIC(6,2),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'skipped', 'failed')),
  failure_reason TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  player_session_id TEXT,
  device_token_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de Alta Performance para Consultas e Desduplicação Rápida
CREATE INDEX IF NOT EXISTS idx_playback_logs_company_id ON public.playback_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_screen_id ON public.playback_logs(screen_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_media_asset_id ON public.playback_logs(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_played_at ON public.playback_logs(played_at);
CREATE INDEX IF NOT EXISTS idx_playback_logs_status ON public.playback_logs(status);
CREATE INDEX IF NOT EXISTS idx_playback_logs_idempotency_key ON public.playback_logs(idempotency_key);

-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.playback_logs ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS RLS - PLAYBACK_LOGS
-- 3.1 LEITURA: Master Admin ou membros ativos (Admin e Operador) da mesma empresa
DROP POLICY IF EXISTS "PlaybackLogs - Leitura por membros da empresa ou Master Admin" ON public.playback_logs;
CREATE POLICY "PlaybackLogs - Leitura por membros da empresa ou Master Admin"
  ON public.playback_logs FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

-- 3.2 INSERÇÃO: Permitida para membros da empresa ou via Server Actions (Security Definer)
DROP POLICY IF EXISTS "PlaybackLogs - Inserção autenticada por empresa ou Master Admin" ON public.playback_logs;
CREATE POLICY "PlaybackLogs - Inserção autenticada por empresa ou Master Admin"
  ON public.playback_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2D: RPC DE INGEST SEGURO (SECURITY DEFINER)
-- Data: 2026-07-31
-- ============================================================================

-- RPC SEGURA DE REGISTRO DE PLAYBACK LOG (PLAYERS ANÔNIMOS)
-- Executa com permissões elevadas de banco (SECURITY DEFINER SET search_path = public)
-- Valida obrigatoriamente Hash do Token, Empresa, Mídia Aprovada, Playlist Ativa e Item
CREATE OR REPLACE FUNCTION public.record_playback_log(
  p_device_token_hash TEXT,
  p_media_asset_id UUID,
  p_playlist_id UUID DEFAULT NULL,
  p_playlist_item_id UUID DEFAULT NULL,
  p_media_type TEXT DEFAULT 'image',
  p_planned_duration_seconds INTEGER DEFAULT 10,
  p_actual_duration_seconds NUMERIC DEFAULT NULL,
  p_started_at TIMESTAMPTZ DEFAULT NOW(),
  p_ended_at TIMESTAMPTZ DEFAULT NULL,
  p_status TEXT DEFAULT 'completed',
  p_failure_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_player_session_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_screen RECORD;
  v_active_playlist_id UUID;
  v_media RECORD;
  v_item RECORD;
  v_inserted_id UUID;
  v_failure_msg TEXT := p_failure_reason;
BEGIN
  -- 1. Validar chave de idempotência obrigatória
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'Chave de idempotência (idempotency_key) não fornecida.';
  END IF;

  -- 2. Validar limites de duração e status
  IF p_planned_duration_seconds NOT IN (5, 10, 15, 30) THEN
    RAISE EXCEPTION 'Duração planejada inválida. Deve ser 5, 10, 15 ou 30 segundos.';
  END IF;

  IF p_actual_duration_seconds IS NOT NULL AND p_actual_duration_seconds < 0 THEN
    RAISE EXCEPTION 'Duração real não pode ser negativa.';
  END IF;

  IF p_status NOT IN ('started', 'completed', 'skipped', 'failed') THEN
    RAISE EXCEPTION 'Status de exibição inválido.';
  END IF;

  IF p_status = 'failed' AND (v_failure_msg IS NULL OR length(trim(v_failure_msg)) = 0) THEN
    v_failure_msg := 'Erro indeterminado de reprodução ou mídia corrompida';
  END IF;

  -- 3. Buscar Tela pelo Hash SHA-256 no Banco
  SELECT id, company_id, status INTO v_screen
  FROM public.screens
  WHERE device_token_hash = p_device_token_hash;

  IF v_screen.id IS NULL THEN
    RAISE EXCEPTION 'Dispositivo não encontrado ou pareamento revogado.';
  END IF;

  IF v_screen.status = 'inactive' THEN
    RAISE EXCEPTION 'Dispositivo desativado pelo administrador.';
  END IF;

  -- 4. Buscar Playlist Ativa da Tela
  SELECT playlist_id INTO v_active_playlist_id
  FROM public.screen_playlists
  WHERE screen_id = v_screen.id AND is_active = TRUE
  LIMIT 1;

  IF v_active_playlist_id IS NULL THEN
    RAISE EXCEPTION 'A tela não possui nenhuma playlist ativa vinculada.';
  END IF;

  -- Se p_playlist_id for fornecido pelo client, deve bater com a playlist ativa da TV
  IF p_playlist_id IS NOT NULL AND p_playlist_id != v_active_playlist_id THEN
    RAISE EXCEPTION 'Violação de segurança: A playlist informada não é a playlist ativa desta tela.';
  END IF;

  -- 5. Validar Mídia (Mesma empresa, status = 'approved', media_type correto)
  SELECT id, company_id, status, media_type INTO v_media
  FROM public.media_assets
  WHERE id = p_media_asset_id;

  IF v_media.id IS NULL THEN
    RAISE EXCEPTION 'Mídia não encontrada.';
  END IF;

  IF v_media.company_id != v_screen.company_id THEN
    RAISE EXCEPTION 'Violação de segurança: A mídia informada não pertence à empresa do dispositivo.';
  END IF;

  IF v_media.status != 'approved' THEN
    RAISE EXCEPTION 'Integridade rejeitada: Não é possível registrar exibição de mídia não aprovada.';
  END IF;

  IF v_media.media_type != p_media_type THEN
    RAISE EXCEPTION 'Tipo de mídia divergente entre o payload e o banco de dados.';
  END IF;

  -- 6. Validar Item de Playlist (Se fornecido, deve pertencer à playlist ativa da TV e à mesma mídia)
  IF p_playlist_item_id IS NOT NULL THEN
    SELECT id, playlist_id, media_asset_id, playback_duration_seconds, is_active INTO v_item
    FROM public.playlist_items
    WHERE id = p_playlist_item_id;

    IF v_item.id IS NULL THEN
      RAISE EXCEPTION 'Item de playlist não encontrado.';
    END IF;

    IF v_item.playlist_id != v_active_playlist_id THEN
      RAISE EXCEPTION 'Violação de integridade: O item não pertence à playlist ativa desta tela.';
    END IF;

    IF v_item.media_asset_id != p_media_asset_id THEN
      RAISE EXCEPTION 'Violação de integridade: O item de playlist não corresponde à mídia informada.';
    END IF;

    IF NOT v_item.is_active THEN
      RAISE EXCEPTION 'Integridade rejeitada: O item de playlist informado está inativo.';
    END IF;

    IF v_item.playback_duration_seconds != p_planned_duration_seconds THEN
      RAISE EXCEPTION 'Duração planejada divergente do item de playlist.';
    END IF;
  ELSE
    -- Se playlist_item_id não foi enviado, confirmar ao menos que a mídia está na playlist ativa
    PERFORM 1 FROM public.playlist_items
    WHERE playlist_id = v_active_playlist_id AND media_asset_id = p_media_asset_id AND is_active = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Integridade rejeitada: A mídia exibida não pertence à playlist ativa desta tela.';
    END IF;
  END IF;

  -- 7. Inserir com Desduplicação Automática (ON CONFLICT DO NOTHING)
  INSERT INTO public.playback_logs (
    company_id,
    screen_id,
    playlist_id,
    playlist_item_id,
    media_asset_id,
    media_type,
    planned_duration_seconds,
    actual_duration_seconds,
    started_at,
    ended_at,
    played_at,
    status,
    failure_reason,
    idempotency_key,
    player_session_id,
    device_token_hash,
    synced_at
  ) VALUES (
    v_screen.company_id,
    v_screen.id,
    v_active_playlist_id,
    p_playlist_item_id,
    p_media_asset_id,
    p_media_type,
    p_planned_duration_seconds,
    p_actual_duration_seconds,
    p_started_at,
    p_ended_at,
    NOW(),
    p_status,
    v_failure_msg,
    p_idempotency_key,
    p_player_session_id,
    p_device_token_hash,
    NOW()
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_inserted_id;

  -- Retornar resultado seguro
  IF v_inserted_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'deduplicated', false,
      'log_id', v_inserted_id
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'deduplicated', true,
      'message', 'Log de exibição já registrado anteriormente (desduplicado).'
    );
  END IF;

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', true,
      'deduplicated', true,
      'message', 'Log de exibição já registrado anteriormente (desduplicado).'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3A: CAMPANHAS INTERNAS E PACOTES DE INSERÇÃO
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE CAMPANHAS (CAMPAIGNS)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'internal' CHECK (campaign_type IN ('internal', 'paid', 'exchange', 'external')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled', 'archived')),
  start_date DATE,
  end_date DATE,
  target_insertions INTEGER CHECK (target_insertions IS NULL OR target_insertions > 0),
  delivered_insertions INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_company_id ON public.campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON public.campaigns(campaign_type);

-- 2. TABELA ASSOCIATIVA MÍDIAS DA CAMPANHA (CAMPAIGN_MEDIA)
CREATE TABLE IF NOT EXISTS public.campaign_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  playback_duration_seconds INTEGER NOT NULL CHECK (playback_duration_seconds IN (5, 10, 15, 30)),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_campaign_media UNIQUE (campaign_id, media_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_media_campaign_id ON public.campaign_media(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_media_media_asset_id ON public.campaign_media(media_asset_id);

-- 3. TABELA ASSOCIATIVA TELAS DA CAMPANHA (CAMPAIGN_SCREENS)
CREATE TABLE IF NOT EXISTS public.campaign_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_campaign_screens UNIQUE (campaign_id, screen_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_screens_campaign_id ON public.campaign_screens(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_screens_screen_id ON public.campaign_screens(screen_id);

-- 4. TRIGGERS DE INTEGRIDADE DE BANCO

-- 4.1 Trigger para Validação da Campanha (Datas e Tipo Interno)
CREATE OR REPLACE FUNCTION public.check_campaign_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar Datas
  IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
    IF NEW.end_date < NEW.start_date THEN
      RAISE EXCEPTION 'A data de término não pode ser anterior à data de início.';
    END IF;
  END IF;

  -- No MVP 3A, apenas campanhas do tipo 'internal' são permitidas
  IF NEW.campaign_type != 'internal' THEN
    RAISE EXCEPTION 'Apenas campanhas do tipo internas (internal) são permitidas no MVP 3A.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_campaign_integrity ON public.campaigns;
CREATE TRIGGER trg_check_campaign_integrity
  BEFORE INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.check_campaign_integrity();

-- 4.2 Trigger para Mídias da Campanha (Empresa Igual e Status Approved)
CREATE OR REPLACE FUNCTION public.check_campaign_media_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign_company_id UUID;
  v_media RECORD;
BEGIN
  SELECT company_id INTO v_campaign_company_id FROM public.campaigns WHERE id = NEW.campaign_id;
  SELECT company_id, status INTO v_media FROM public.media_assets WHERE id = NEW.media_asset_id;

  IF v_campaign_company_id IS NULL OR v_media.company_id IS NULL THEN
    RAISE EXCEPTION 'Campanha ou Mídia não encontrada.';
  END IF;

  IF v_media.company_id != v_campaign_company_id THEN
    RAISE EXCEPTION 'Violação de segurança: A mídia deve pertencer à mesma empresa da campanha.';
  END IF;

  IF v_media.status != 'approved' THEN
    RAISE EXCEPTION 'Integridade rejeitada: Apenas mídias com status Aprovada podem ser vinculadas à campanha.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_campaign_media_integrity ON public.campaign_media;
CREATE TRIGGER trg_check_campaign_media_integrity
  BEFORE INSERT OR UPDATE ON public.campaign_media
  FOR EACH ROW EXECUTE FUNCTION public.check_campaign_media_integrity();

-- 4.3 Trigger para Telas da Campanha (Empresa Igual)
CREATE OR REPLACE FUNCTION public.check_campaign_screen_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign_company_id UUID;
  v_screen_company_id UUID;
BEGIN
  SELECT company_id INTO v_campaign_company_id FROM public.campaigns WHERE id = NEW.campaign_id;
  SELECT company_id INTO v_screen_company_id FROM public.screens WHERE id = NEW.screen_id;

  IF v_campaign_company_id IS NULL OR v_screen_company_id IS NULL THEN
    RAISE EXCEPTION 'Campanha ou Tela não encontrada.';
  END IF;

  IF v_screen_company_id != v_campaign_company_id THEN
    RAISE EXCEPTION 'Violação de segurança: A tela deve pertencer à mesma empresa da campanha.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_campaign_screen_integrity ON public.campaign_screens;
CREATE TRIGGER trg_check_campaign_screen_integrity
  BEFORE INSERT OR UPDATE ON public.campaign_screens
  FOR EACH ROW EXECUTE FUNCTION public.check_campaign_screen_integrity();

-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_screens ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS - CAMPAIGNS
DROP POLICY IF EXISTS "Campaigns - Leitura por membros da empresa ou Master Admin" ON public.campaigns;
CREATE POLICY "Campaigns - Leitura por membros da empresa ou Master Admin"
  ON public.campaigns FOR SELECT TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "Campaigns - Inserção por membros da empresa ou Master Admin" ON public.campaigns;
CREATE POLICY "Campaigns - Inserção por membros da empresa ou Master Admin"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "Campaigns - Edição por membros da empresa ou Master Admin" ON public.campaigns;
CREATE POLICY "Campaigns - Edição por membros da empresa ou Master Admin"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "Campaigns - Exclusão por Admins da Empresa ou Master Admin" ON public.campaigns;
CREATE POLICY "Campaigns - Exclusão por Admins da Empresa ou Master Admin"
  ON public.campaigns FOR DELETE TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE));

-- POLÍTICAS RLS - CAMPAIGN_MEDIA & CAMPAIGN_SCREENS
DROP POLICY IF EXISTS "CampaignMedia - Leitura por membros da empresa ou Master Admin" ON public.campaign_media;
CREATE POLICY "CampaignMedia - Leitura por membros da empresa ou Master Admin"
  ON public.campaign_media FOR SELECT TO authenticated
  USING (is_master_admin() OR campaign_id IN (SELECT id FROM public.campaigns WHERE company_id IN (SELECT public.get_user_company_ids())));

DROP POLICY IF EXISTS "CampaignMedia - Gerenciamento por membros da empresa ou Master Admin" ON public.campaign_media;
CREATE POLICY "CampaignMedia - Gerenciamento por membros da empresa ou Master Admin"
  ON public.campaign_media FOR ALL TO authenticated
  USING (is_master_admin() OR campaign_id IN (SELECT id FROM public.campaigns WHERE company_id IN (SELECT public.get_user_company_ids())));

DROP POLICY IF EXISTS "CampaignScreens - Leitura por membros da empresa ou Master Admin" ON public.campaign_screens;
CREATE POLICY "CampaignScreens - Leitura por membros da empresa ou Master Admin"
  ON public.campaign_screens FOR SELECT TO authenticated
  USING (is_master_admin() OR campaign_id IN (SELECT id FROM public.campaigns WHERE company_id IN (SELECT public.get_user_company_ids())));

DROP POLICY IF EXISTS "CampaignScreens - Gerenciamento por membros da empresa ou Master Admin" ON public.campaign_screens;
CREATE POLICY "CampaignScreens - Gerenciamento por membros da empresa ou Master Admin"
  ON public.campaign_screens FOR ALL TO authenticated
  USING (is_master_admin() OR campaign_id IN (SELECT id FROM public.campaigns WHERE company_id IN (SELECT public.get_user_company_ids())));
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3A: CORREÇÃO E REFORÇO FINAL DE TRIGGERS
-- Data: 2026-07-31
-- ============================================================================

-- 1. TRIGGER REESCRITO DE PROTEÇÃO DA TABELA CAMPAIGNS
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_campaign_updates()
RETURNS TRIGGER AS $$
DECLARE
  v_is_master BOOLEAN := FALSE;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  v_is_master := is_master_admin();

  -- Verificar vínculo de Admin da Empresa se não for Master Admin
  IF NOT v_is_master THEN
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.company_users
    WHERE company_id = NEW.company_id AND user_id = auth.uid() AND is_active = TRUE;
  END IF;

  -- Regra 1: Campanhas em status finalizado (archived, completed, cancelled) são IMUTÁVEIS
  -- Bloqueia qualquer edição ou tentativa de reabertura/mudança de status por Admin Empresa ou Operador
  IF OLD.status IN ('archived', 'completed', 'cancelled') AND NOT v_is_master THEN
    RAISE EXCEPTION 'Operação negada: Campanhas concluídas, canceladas ou arquivadas são imutáveis e não podem ser editadas ou reabertas.';
  END IF;

  -- Regra 2: Alteração de STATUS permitida apenas para Admin Empresa ou Master Admin
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT v_is_admin AND NOT v_is_master THEN
      RAISE EXCEPTION 'Acesso negado: Apenas administradores da empresa ou Master Admin podem alterar o status de campanhas.';
    END IF;
  END IF;

  -- Regra 3: delivered_insertions NÃO PODE ser alterado manualmente por Admin Empresa nem Operador
  -- Permitido apenas para Master Admin em manutenção ou jobs internos do sistema (service_role)
  IF OLD.delivered_insertions IS DISTINCT FROM NEW.delivered_insertions THEN
    IF NOT v_is_master AND current_setting('role', true) != 'service_role' THEN
      RAISE EXCEPTION 'Operação negada: A contagem de inserções entregues (delivered_insertions) não pode ser alterada manualmente por administradores ou operadores.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_unauthorized_campaign_updates ON public.campaigns;
CREATE TRIGGER trg_prevent_unauthorized_campaign_updates
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unauthorized_campaign_updates();

-- 2. REFORÇO NO TRIGGER DE CAMPAIGN_MEDIA (BLOQUEIO EM CAMPANHAS FINALIZADAS)
CREATE OR REPLACE FUNCTION public.check_campaign_media_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign RECORD;
  v_media RECORD;
BEGIN
  SELECT company_id, status INTO v_campaign FROM public.campaigns WHERE id = NEW.campaign_id;
  SELECT company_id, status INTO v_media FROM public.media_assets WHERE id = NEW.media_asset_id;

  IF v_campaign.company_id IS NULL OR v_media.company_id IS NULL THEN
    RAISE EXCEPTION 'Campanha ou Mídia não encontrada.';
  END IF;

  -- Bloquear novos vínculos se a campanha estiver encerrada ou arquivada
  IF v_campaign.status IN ('archived', 'completed', 'cancelled') AND NOT is_master_admin() THEN
    RAISE EXCEPTION 'Integridade rejeitada: Não é possível adicionar mídias a campanhas concluídas, canceladas ou arquivadas.';
  END IF;

  IF v_media.company_id != v_campaign.company_id THEN
    RAISE EXCEPTION 'Violação de segurança: A mídia deve pertencer à mesma empresa da campanha.';
  END IF;

  IF v_media.status != 'approved' THEN
    RAISE EXCEPTION 'Integridade rejeitada: Apenas mídias com status Aprovada podem ser vinculadas à campanha.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_campaign_media_integrity ON public.campaign_media;
CREATE TRIGGER trg_check_campaign_media_integrity
  BEFORE INSERT OR UPDATE ON public.campaign_media
  FOR EACH ROW EXECUTE FUNCTION public.check_campaign_media_integrity();

-- 3. REFORÇO NO TRIGGER DE CAMPAIGN_SCREENS (BLOQUEIO EM CAMPANHAS FINALIZADAS)
CREATE OR REPLACE FUNCTION public.check_campaign_screen_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign RECORD;
  v_screen RECORD;
BEGIN
  SELECT company_id, status INTO v_campaign FROM public.campaigns WHERE id = NEW.campaign_id;
  SELECT company_id INTO v_screen FROM public.screens WHERE id = NEW.screen_id;

  IF v_campaign.company_id IS NULL OR v_screen.company_id IS NULL THEN
    RAISE EXCEPTION 'Campanha ou Tela não encontrada.';
  END IF;

  -- Bloquear novos vínculos se a campanha estiver encerrada ou arquivada
  IF v_campaign.status IN ('archived', 'completed', 'cancelled') AND NOT is_master_admin() THEN
    RAISE EXCEPTION 'Integridade rejeitada: Não é possível adicionar telas a campanhas concluídas, canceladas ou arquivadas.';
  END IF;

  IF v_screen.company_id != v_campaign.company_id THEN
    RAISE EXCEPTION 'Violação de segurança: A tela deve pertencer à mesma empresa da campanha.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_campaign_screen_integrity ON public.campaign_screens;
CREATE TRIGGER trg_check_campaign_screen_integrity
  BEFORE INSERT OR UPDATE ON public.campaign_screens
  FOR EACH ROW EXECUTE FUNCTION public.check_campaign_screen_integrity();
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
DROP POLICY IF EXISTS "CompanyTrials - Leitura por membros da empresa ou Master Admin" ON public.company_trials;
CREATE POLICY "CompanyTrials - Leitura por membros da empresa ou Master Admin"
  ON public.company_trials FOR SELECT TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "CompanyTrials - Gerenciamento por Admins da Empresa ou Master Admin" ON public.company_trials;
CREATE POLICY "CompanyTrials - Gerenciamento por Admins da Empresa ou Master Admin"
  ON public.company_trials FOR ALL TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE));

-- POLÍTICAS RLS - REFERRAL_INVITES
DROP POLICY IF EXISTS "ReferralInvites - Leitura por empresa emissora ou Master Admin" ON public.referral_invites;
CREATE POLICY "ReferralInvites - Leitura por empresa emissora ou Master Admin"
  ON public.referral_invites FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    inviter_company_id IN (SELECT public.get_user_company_ids()) OR
    converted_company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "ReferralInvites - Gerenciamento por Admins da Empresa ou Master Admin" ON public.referral_invites;
CREATE POLICY "ReferralInvites - Gerenciamento por Admins da Empresa ou Master Admin"
  ON public.referral_invites FOR ALL TO authenticated
  USING (is_master_admin() OR inviter_company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE));
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
DROP POLICY IF EXISTS "CreditPackages - Leitura por todos os usuários autenticados" ON public.credit_packages;
CREATE POLICY "CreditPackages - Leitura por todos os usuários autenticados"
  ON public.credit_packages FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "CreditPackages - Gerenciamento por Master Admin" ON public.credit_packages;
CREATE POLICY "CreditPackages - Gerenciamento por Master Admin"
  ON public.credit_packages FOR ALL TO authenticated
  USING (is_master_admin());

-- POLÍTICAS RLS - PLAYBACK_CREDIT_CHARGES
DROP POLICY IF EXISTS "PlaybackCreditCharges - Leitura por membros da empresa ou Master Admin" ON public.playback_credit_charges;
CREATE POLICY "PlaybackCreditCharges - Leitura por membros da empresa ou Master Admin"
  ON public.playback_credit_charges FOR SELECT TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3B: AUDITORIA E HARDENING DE CRÉDITOS
-- Data: 2026-07-31
-- ============================================================================

-- 1. ATUALIZAR CHECK CONSTRAINT DE CREDIT_TYPE EM WALLET_TRANSACTIONS
DO $$ 
BEGIN
  -- Remover constraint antiga se existir
  ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_credit_type_check;
  
  -- Adicionar 'usage_debit' aos tipos de crédito aceitos
  ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_credit_type_check
    CHECK (credit_type IN (
      'paid_credit', 
      'trial_credit', 
      'exchange_credit', 
      'bonus_credit', 
      'referral_credit', 
      'network_inventory_credit', 
      'monthly_network_quota',
      'usage_debit'
    ));
END $$;

-- 2. REESCREVER RPC CHARGE_PLAYBACK_CREDIT COM CAMPAIGN_ID CORRETO, RETRY E USAGE_DEBIT
CREATE OR REPLACE FUNCTION public.charge_playback_credit(
  p_playback_log_id UUID,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_log RECORD;
  v_campaign RECORD;
  v_wallet RECORD;
  v_existing_charge RECORD;
  v_credits_to_charge NUMERIC(12,2) := 1.0;
  v_previous_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id UUID;
  v_media_count INTEGER := 0;
  v_screen_count INTEGER := 0;
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

  -- 3. Se p_campaign_id for informado, validar integridade da campanha
  IF p_campaign_id IS NOT NULL THEN
    SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;

    IF v_campaign.id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Campanha informada não foi encontrada.');
    END IF;

    IF v_campaign.company_id != v_log.company_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Violação de segurança: A campanha pertence a outra empresa.');
    END IF;

    IF v_campaign.status IN ('archived', 'cancelled', 'completed') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Campanha finalizada ou arquivada não pode processar novos débitos.');
    END IF;

    -- Validar se a mídia pertence à campanha
    SELECT COUNT(*) INTO v_media_count FROM public.campaign_media 
    WHERE campaign_id = p_campaign_id AND media_asset_id = v_log.media_asset_id;

    IF v_media_count = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'A mídia do log não pertence à campanha informada.');
    END IF;

    -- Validar se a tela pertence à campanha
    SELECT COUNT(*) INTO v_screen_count FROM public.campaign_screens 
    WHERE campaign_id = p_campaign_id AND screen_id = v_log.screen_id;

    IF v_screen_count = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'A tela do log não pertence à campanha informada.');
    END IF;

    -- Validar período da campanha, quando houver
    IF v_campaign.start_date IS NOT NULL AND v_log.played_at < (v_campaign.start_date::text || ' 00:00:00')::timestamptz THEN
      RETURN jsonb_build_object('success', false, 'error', 'Exibição ocorreu antes do início da campanha.');
    END IF;

    IF v_campaign.end_date IS NOT NULL AND v_log.played_at > (v_campaign.end_date::text || ' 23:59:59.999')::timestamptz THEN
      RETURN jsonb_build_object('success', false, 'error', 'Exibição ocorreu após o término da campanha.');
    END IF;
  END IF;

  -- 4. Verificar se o log já foi cobrado (Idempotência com Retry)
  SELECT * INTO v_existing_charge FROM public.playback_credit_charges WHERE playback_log_id = p_playback_log_id;
  
  IF v_existing_charge.id IS NOT NULL THEN
    -- Se já foi cobrado com SUCESSO, retorna deduplicated = true (não repete o débito)
    IF v_existing_charge.charge_status = 'charged' THEN
      RETURN jsonb_build_object(
        'success', true, 
        'deduplicated', true, 
        'charged', false, 
        'credits_charged', 0, 
        'message', 'Log já debitado com sucesso anteriormente.'
      );
    END IF;
    -- Se falhou anteriormente por saldo insuficiente, o fluxo continua permitindo RETRY!
  END IF;

  -- 5. Calcular valor do débito conforme a duração planejada
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

  -- 6. Localizar carteira da empresa proprietária com trava pessimista FOR UPDATE
  SELECT * INTO v_wallet FROM public.wallets WHERE company_id = v_log.company_id FOR UPDATE;
  
  IF v_wallet.id IS NULL THEN
    INSERT INTO public.wallets (company_id, balance) VALUES (v_log.company_id, 0)
    RETURNING * INTO v_wallet;
  END IF;

  v_previous_balance := v_wallet.balance;

  -- 7. Validar saldo suficiente
  IF v_previous_balance < v_credits_to_charge THEN
    -- Gravar ou atualizar registro com status 'failed'
    INSERT INTO public.playback_credit_charges (
      company_id, wallet_id, playback_log_id, campaign_id, media_asset_id, screen_id, credits_charged, charge_status, failure_reason
    ) VALUES (
      v_log.company_id, v_wallet.id, p_playback_log_id, p_campaign_id, v_log.media_asset_id, v_log.screen_id, v_credits_to_charge, 'failed', 'Saldo insuficiente na carteira'
    ) ON CONFLICT (playback_log_id) DO UPDATE SET 
      campaign_id = EXCLUDED.campaign_id,
      charge_status = 'failed', 
      failure_reason = 'Saldo insuficiente na carteira';

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Saldo insuficiente na carteira da empresa.', 
      'credits_required', v_credits_to_charge, 
      'balance', v_previous_balance
    );
  END IF;

  -- 8. Debitar da carteira (Saldo nunca fica negativo devido ao check anterior)
  v_new_balance := v_previous_balance - v_credits_to_charge;
  
  UPDATE public.wallets 
  SET balance = v_new_balance, updated_at = NOW() 
  WHERE id = v_wallet.id;

  -- 9. Criar registro em wallet_transactions com credit_type = 'usage_debit' e metadata
  INSERT INTO public.wallet_transactions (
    wallet_id, 
    company_id, 
    previous_balance, 
    amount, 
    new_balance, 
    type, 
    source, 
    source_type, 
    credit_type, 
    source_id,
    metadata,
    description
  ) VALUES (
    v_wallet.id, 
    v_log.company_id, 
    v_previous_balance, 
    v_credits_to_charge, 
    v_new_balance, 
    'debit', 
    'campaign_spend', 
    'playback_charge', 
    'usage_debit', 
    p_playback_log_id::text,
    jsonb_build_object(
      'playback_log_id', p_playback_log_id,
      'campaign_id', p_campaign_id,
      'media_asset_id', v_log.media_asset_id,
      'screen_id', v_log.screen_id,
      'duration_seconds', v_log.planned_duration_seconds
    ),
    'Débito por exibição confirmada (Proof of Play)'
  ) RETURNING id INTO v_transaction_id;

  -- 10. Registrar/Atualizar em playback_credit_charges com status 'charged'
  INSERT INTO public.playback_credit_charges (
    company_id, wallet_id, playback_log_id, campaign_id, media_asset_id, screen_id, credits_charged, charge_status, wallet_transaction_id
  ) VALUES (
    v_log.company_id, v_wallet.id, p_playback_log_id, p_campaign_id, v_log.media_asset_id, v_log.screen_id, v_credits_to_charge, 'charged', v_transaction_id
  ) ON CONFLICT (playback_log_id) DO UPDATE SET
    campaign_id = EXCLUDED.campaign_id,
    charge_status = 'charged', 
    failure_reason = NULL, 
    wallet_transaction_id = v_transaction_id;

  RETURN jsonb_build_object(
    'success', true, 
    'charged', true, 
    'credits_charged', v_credits_to_charge, 
    'previous_balance', v_previous_balance, 
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
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
  USING (is_master_admin() OR company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE));

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
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3C: HARDENING E AUDITORIA DE INVENTÁRIO
-- Data: 2026-07-31
-- ============================================================================

-- REESCREVER RPC USE_NETWORK_INVENTORY_CREDIT COM VALIDAÇÕES RÍGIDAS DE SEGURANÇA
CREATE OR REPLACE FUNCTION public.use_network_inventory_credit(
  p_playback_log_id UUID,
  p_inventory_ledger_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_log RECORD;
  v_screen RECORD;
  v_ledger RECORD;
  v_prefs RECORD;
  v_media RECORD;
  v_existing_usage RECORD;
  v_credits_needed NUMERIC(12,2) := 1.0;
  v_new_remaining NUMERIC(12,2);
  v_new_used NUMERIC(12,2);
  v_new_status TEXT;
  v_blocked_segment_count INTEGER := 0;
BEGIN
  -- 1. Buscar o log de exibição
  SELECT * INTO v_log FROM public.playback_logs WHERE id = p_playback_log_id;
  
  IF v_log.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Log de exibição não encontrado.');
  END IF;

  IF v_log.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas exibições concluídas (status = completed) podem consumir inventário cedido.');
  END IF;

  -- 2. Buscar o registro de inventário cedido com trava pessimista FOR UPDATE
  SELECT * INTO v_ledger FROM public.network_inventory_ledger WHERE id = p_inventory_ledger_id FOR UPDATE;
  
  IF v_ledger.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventário cedido não encontrado.');
  END IF;

  -- 3. VALIDAR INTEGRIDADE TELA VS EMPRESA EXIBIDORA (PONTO CRÍTICO 1)
  SELECT * INTO v_screen FROM public.screens WHERE id = v_log.screen_id;

  IF v_screen.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tela associada ao log não encontrada.');
  END IF;

  IF v_screen.company_id != v_ledger.company_id THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Violação de segurança: A tela da exibição pertence a uma empresa diferente da empresa do inventário cedido.'
    );
  END IF;

  -- 4. Idempotência: verificar se este log já foi processado no inventário
  SELECT * INTO v_existing_usage FROM public.network_inventory_usage WHERE playback_log_id = p_playback_log_id;
  IF v_existing_usage.id IS NOT NULL AND v_existing_usage.status = 'used' THEN
    RETURN jsonb_build_object(
      'success', true, 
      'deduplicated', true, 
      'credits_used', 0, 
      'message', 'Log de exibição já debitado no inventário cedido anteriormente com sucesso.'
    );
  END IF;

  -- 5. Validar status e vencimento do inventário
  IF v_ledger.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registro de inventário cedido não está ativo.');
  END IF;

  IF v_ledger.expires_at IS NOT NULL AND NOW() > v_ledger.expires_at THEN
    UPDATE public.network_inventory_ledger SET status = 'expired', updated_at = NOW() WHERE id = v_ledger.id;
    RETURN jsonb_build_object('success', false, 'error', 'O inventário cedido selecionado expirou.');
  END IF;

  -- 6. Buscar mídia para identificar a empresa anunciante
  SELECT * INTO v_media FROM public.media_assets WHERE id = v_log.media_asset_id;

  IF v_media.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mídia anunciante não encontrada.');
  END IF;

  -- 7. BLOQUEIO DE AUTO-CONSUMO (PONTO CRÍTICO 2)
  IF v_media.company_id = v_ledger.company_id THEN
    INSERT INTO public.network_inventory_usage (
      inventory_ledger_id, display_company_id, advertiser_company_id, playback_log_id, media_asset_id, screen_id, credits_used, status, failure_reason
    ) VALUES (
      p_inventory_ledger_id, v_ledger.company_id, v_media.company_id, p_playback_log_id, v_log.media_asset_id, v_log.screen_id, 0, 'failed', 'Auto-consumo não permitido'
    ) ON CONFLICT (playback_log_id) DO UPDATE SET status = 'failed', failure_reason = 'Auto-consumo não permitido';

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Auto-consumo rejeitado: O inventário cedido à rede não pode ser consumido por mídias da própria empresa exibidora.'
    );
  END IF;

  -- 8. CHECAGEM DE PREFERÊNCIAS DA REDE E BLOQUEIOS
  SELECT * INTO v_prefs FROM public.company_network_preferences WHERE company_id = v_ledger.company_id;
  
  IF v_prefs.company_id IS NOT NULL THEN
    IF NOT v_prefs.accepts_network_ads THEN
      INSERT INTO public.network_inventory_usage (
        inventory_ledger_id, display_company_id, advertiser_company_id, playback_log_id, media_asset_id, screen_id, credits_used, status, failure_reason
      ) VALUES (
        p_inventory_ledger_id, v_ledger.company_id, v_media.company_id, p_playback_log_id, v_log.media_asset_id, v_log.screen_id, 0, 'failed', 'Empresa não aceita anúncios da rede'
      ) ON CONFLICT (playback_log_id) DO UPDATE SET status = 'failed', failure_reason = 'Empresa não aceita anúncios da rede';

      RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora está com a opção de aceitar anúncios da rede desativada.');
    END IF;

    -- Validar se a empresa exige aprovação manual (PONTO CRÍTICO 4)
    IF v_prefs.requires_manual_approval THEN
      INSERT INTO public.network_inventory_usage (
        inventory_ledger_id, display_company_id, advertiser_company_id, playback_log_id, media_asset_id, screen_id, credits_used, status, failure_reason
      ) VALUES (
        p_inventory_ledger_id, v_ledger.company_id, v_media.company_id, p_playback_log_id, v_log.media_asset_id, v_log.screen_id, 0, 'failed', 'Aprovação manual pendente'
      ) ON CONFLICT (playback_log_id) DO UPDATE SET status = 'failed', failure_reason = 'Aprovação manual pendente';

      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Rejeitado: A empresa exibidora exige aprovação manual prévia para anúncios da rede.'
      );
    END IF;

    -- Validar se a empresa anunciante está bloqueada diretamente
    IF v_media.company_id = ANY(v_prefs.blocked_companies) THEN
      INSERT INTO public.network_inventory_usage (
        inventory_ledger_id, display_company_id, advertiser_company_id, playback_log_id, media_asset_id, screen_id, credits_used, status, failure_reason
      ) VALUES (
        p_inventory_ledger_id, v_ledger.company_id, v_media.company_id, p_playback_log_id, v_log.media_asset_id, v_log.screen_id, 0, 'failed', 'Empresa anunciante bloqueada'
      ) ON CONFLICT (playback_log_id) DO UPDATE SET status = 'failed', failure_reason = 'Empresa anunciante bloqueada';

      RETURN jsonb_build_object('success', false, 'error', 'Rejeitado: A empresa anunciante está na lista de bloqueio direto da exibidora.');
    END IF;

    -- VALIDAR SE O SEGMENTO DA EMPRESA ANUNCIANTE ESTÁ BLOQUEADO (PONTO CRÍTICO 3)
    IF array_length(v_prefs.blocked_segments, 1) > 0 THEN
      SELECT COUNT(*) INTO v_blocked_segment_count 
      FROM public.company_segments 
      WHERE company_id = v_media.company_id AND segment_id = ANY(v_prefs.blocked_segments);

      IF v_blocked_segment_count > 0 THEN
        INSERT INTO public.network_inventory_usage (
          inventory_ledger_id, display_company_id, advertiser_company_id, playback_log_id, media_asset_id, screen_id, credits_used, status, failure_reason
        ) VALUES (
          p_inventory_ledger_id, v_ledger.company_id, v_media.company_id, p_playback_log_id, v_log.media_asset_id, v_log.screen_id, 0, 'failed', 'Segmento do anunciante bloqueado'
        ) ON CONFLICT (playback_log_id) DO UPDATE SET status = 'failed', failure_reason = 'Segmento do anunciante bloqueado';

        RETURN jsonb_build_object('success', false, 'error', 'Rejeitado: O segmento da empresa anunciante está na lista de bloqueio da exibidora.');
      END IF;
    END IF;
  END IF;

  -- 9. Calcular valor do consumo por duração (5s=0.5, 10s=1.0, 15s=1.5, 30s=3.0)
  IF v_log.planned_duration_seconds <= 5 THEN
    v_credits_needed := 0.5;
  ELSIF v_log.planned_duration_seconds <= 10 THEN
    v_credits_needed := 1.0;
  ELSIF v_log.planned_duration_seconds <= 15 THEN
    v_credits_needed := 1.5;
  ELSE
    v_credits_needed := 3.0;
  END IF;

  -- 10. Validar saldo de inventário restante
  IF v_ledger.credits_remaining < v_credits_needed THEN
    INSERT INTO public.network_inventory_usage (
      inventory_ledger_id, display_company_id, advertiser_company_id, playback_log_id, media_asset_id, screen_id, credits_used, status, failure_reason
    ) VALUES (
      p_inventory_ledger_id, v_ledger.company_id, v_media.company_id, p_playback_log_id, v_log.media_asset_id, v_log.screen_id, v_credits_needed, 'failed', 'Inventário cedido insuficiente'
    ) ON CONFLICT (playback_log_id) DO UPDATE SET status = 'failed', failure_reason = 'Inventário cedido insuficiente';

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Saldo restante de inventário cedido é insuficiente.', 
      'credits_needed', v_credits_needed, 
      'credits_remaining', v_ledger.credits_remaining
    );
  END IF;

  -- 11. Deduzir do inventário cedido
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

  -- 12. Gravar com status 'used'
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
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3D: VITRINE DE PLANOS DE MÍDIA POR EMPRESA
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE CONFIGURAÇÕES DE RECEITA DA PLATAFORMA (PLATFORM_REVENUE_SETTINGS)
CREATE TABLE IF NOT EXISTS public.platform_revenue_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_platform_fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  minimum_price_cents INTEGER NOT NULL DEFAULT 5000, -- R$ 50,00
  allow_company_custom_fee BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir Configuração Padrão se não existir
INSERT INTO public.platform_revenue_settings (default_platform_fee_percentage, minimum_price_cents, allow_company_custom_fee, is_active)
VALUES (15.00, 5000, FALSE, TRUE)
ON CONFLICT DO NOTHING;

-- 2. TABELA DE CARDS DE OFERTAS DE MÍDIA DAS EMPRESAS (COMPANY_AD_OFFERS)
CREATE TABLE IF NOT EXISTS public.company_ad_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  credits_amount NUMERIC(12,2) NOT NULL CHECK (credits_amount > 0),
  duration_seconds INTEGER DEFAULT 10,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 5000),
  platform_fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  platform_fee_cents INTEGER GENERATED ALWAYS AS (ROUND(price_cents * platform_fee_percentage / 100)::integer) STORED,
  seller_net_cents INTEGER GENERATED ALWAYS AS ((price_cents - ROUND(price_cents * platform_fee_percentage / 100))::integer) STORED,
  requires_approval BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'rejected', 'archived')),
  rejection_reason TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_offers_company ON public.company_ad_offers(company_id);
CREATE INDEX IF NOT EXISTS idx_ad_offers_status ON public.company_ad_offers(status);

-- 3. TABELA DE PEDIDOS DE PLANOS DE MÍDIA (AD_OFFER_ORDERS)
CREATE TABLE IF NOT EXISTS public.ad_offer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.company_ad_offers(id) ON DELETE RESTRICT,
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  buyer_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  gross_amount_cents INTEGER NOT NULL,
  platform_fee_percentage NUMERIC(5,2) NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  seller_net_cents INTEGER NOT NULL,
  credits_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('draft', 'requested', 'approved', 'rejected', 'cancelled', 'paid_manual', 'converted_to_campaign')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('not_required', 'pending', 'paid_manual', 'failed', 'refunded')),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_orders_seller ON public.ad_offer_orders(seller_company_id);
CREATE INDEX IF NOT EXISTS idx_ad_orders_buyer ON public.ad_offer_orders(buyer_company_id);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.platform_revenue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_ad_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_offer_orders ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS - PLATFORM_REVENUE_SETTINGS
DROP POLICY IF EXISTS "PlatformRevenueSettings - Leitura por todos os autenticados" ON public.platform_revenue_settings;
CREATE POLICY "PlatformRevenueSettings - Leitura por todos os autenticados"
  ON public.platform_revenue_settings FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "PlatformRevenueSettings - Gerenciamento por Master Admin" ON public.platform_revenue_settings;
CREATE POLICY "PlatformRevenueSettings - Gerenciamento por Master Admin"
  ON public.platform_revenue_settings FOR ALL TO authenticated USING (is_master_admin());

-- POLÍTICAS RLS - COMPANY_AD_OFFERS
DROP POLICY IF EXISTS "CompanyAdOffers - Leitura por membros, ativas públicas ou Master Admin" ON public.company_ad_offers;
CREATE POLICY "CompanyAdOffers - Leitura por membros, ativas públicas ou Master Admin"
  ON public.company_ad_offers FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids()) OR
    (status = 'active' AND is_public = TRUE)
  );

DROP POLICY IF EXISTS "CompanyAdOffers - Gerenciamento por Admins da Empresa ou Master Admin" ON public.company_ad_offers;
CREATE POLICY "CompanyAdOffers - Gerenciamento por Admins da Empresa ou Master Admin"
  ON public.company_ad_offers FOR ALL TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE)
  );

-- POLÍTICAS RLS - AD_OFFER_ORDERS
DROP POLICY IF EXISTS "AdOfferOrders - Leitura por vendedor, comprador ou Master Admin" ON public.ad_offer_orders;
CREATE POLICY "AdOfferOrders - Leitura por vendedor, comprador ou Master Admin"
  ON public.ad_offer_orders FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    seller_company_id IN (SELECT public.get_user_company_ids()) OR
    (buyer_company_id IS NOT NULL AND buyer_company_id IN (SELECT public.get_user_company_ids()))
  );

DROP POLICY IF EXISTS "AdOfferOrders - Criação por usuários autenticados" ON public.ad_offer_orders;
CREATE POLICY "AdOfferOrders - Criação por usuários autenticados"
  ON public.ad_offer_orders FOR INSERT TO authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "AdOfferOrders - Atualização por vendedor ou Master Admin" ON public.ad_offer_orders;
CREATE POLICY "AdOfferOrders - Atualização por vendedor ou Master Admin"
  ON public.ad_offer_orders FOR UPDATE TO authenticated
  USING (
    is_master_admin() OR 
    seller_company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE)
  );
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3D: HARDENING E SEGURANÇA DE OFERTAS E PEDIDOS
-- Data: 2026-07-31
-- ============================================================================

-- 1. CORRIGIR POLICY DE INSERÇÃO EM AD_OFFER_ORDERS (REMOVER WITH CHECK TRUE)
DROP POLICY IF EXISTS "AdOfferOrders - Criação por usuários autenticados" ON public.ad_offer_orders;

DROP POLICY IF EXISTS "AdOfferOrders - Criação por membros da empresa compradora ou Master Admin" ON public.ad_offer_orders;
CREATE POLICY "AdOfferOrders - Criação por membros da empresa compradora ou Master Admin"
  ON public.ad_offer_orders FOR INSERT TO authenticated
  WITH CHECK (
    is_master_admin() OR 
    (buyer_company_id IS NOT NULL AND buyer_company_id IN (SELECT public.get_user_company_ids())) OR
    buyer_name IS NOT NULL
  );

-- 2. TRIGGER DE INTEGRIDADE E CONGELAMENTO DE VALORES EM AD_OFFER_ORDERS
CREATE OR REPLACE FUNCTION public.validate_ad_offer_order_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_offer RECORD;
BEGIN
  -- 1. Buscar a oferta referenciada
  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = NEW.offer_id;

  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'A oferta de mídia especificada não foi encontrada.';
  END IF;

  -- 2. Validar que a oferta está obrigatoriamente ACTIVE
  IF v_offer.status != 'active' THEN
    RAISE EXCEPTION 'Pedidos de mídia só podem ser criados para ofertas ativas (status = active). Status atual: %', v_offer.status;
  END IF;

  -- 3. Validar se a empresa vendedora é exatamente a dona da oferta
  IF NEW.seller_company_id IS NULL OR NEW.seller_company_id != v_offer.company_id THEN
    NEW.seller_company_id := v_offer.company_id;
  END IF;

  -- 4. CONGELAR OS VALORES REAIS DA OFERTA NO ATO DO PEDIDO (IMPEDE ADULTERAÇÃO DE VALORES)
  NEW.gross_amount_cents := v_offer.price_cents;
  NEW.platform_fee_percentage := v_offer.platform_fee_percentage;
  NEW.platform_fee_cents := v_offer.platform_fee_cents;
  NEW.seller_net_cents := v_offer.seller_net_cents;
  NEW.credits_amount := v_offer.credits_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_ad_offer_order_integrity ON public.ad_offer_orders;
CREATE TRIGGER trg_validate_ad_offer_order_integrity
  BEFORE INSERT ON public.ad_offer_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ad_offer_order_integrity();

-- 3. TRIGGER DE VALIDAÇÃO DE TRANSIÇÕES DE STATUS E MOTIVO DE REJEIÇÃO EM COMPANY_AD_OFFERS
CREATE OR REPLACE FUNCTION public.validate_ad_offer_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Rejeição exige motivo não nulo
  IF NEW.status = 'rejected' AND (NEW.rejection_reason IS NULL OR trim(NEW.rejection_reason) = '') THEN
    RAISE EXCEPTION 'A rejeição de uma oferta de mídia exige obrigatoriamente o preenchimento da justificativa (rejection_reason).';
  END IF;

  -- Bloquear edição direta de comissão por empresa não-master se não permitido
  IF OLD.platform_fee_percentage != NEW.platform_fee_percentage AND NOT is_master_admin() THEN
    RAISE EXCEPTION 'Apenas o Master Admin pode alterar o percentual de comissão da plataforma em uma oferta.';
  END IF;

  -- Transição de arquivado exige Master Admin
  IF OLD.status = 'archived' AND NEW.status != 'archived' AND NOT is_master_admin() THEN
    RAISE EXCEPTION 'Ofertas arquivadas só podem ser reativadas pelo Master Admin.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_ad_offer_status_transition ON public.company_ad_offers;
CREATE TRIGGER trg_validate_ad_offer_status_transition
  BEFORE UPDATE ON public.company_ad_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ad_offer_status_transition();

-- 4. RPC TRANSACIONAL PARA CRIAÇÃO SEGURA DE PEDIDOS (CREATE_AD_OFFER_ORDER)
CREATE OR REPLACE FUNCTION public.create_ad_offer_order_rpc(
  p_offer_id UUID,
  p_buyer_company_id UUID DEFAULT NULL,
  p_buyer_name TEXT DEFAULT NULL,
  p_buyer_email TEXT DEFAULT NULL,
  p_buyer_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_offer RECORD;
  v_order_id UUID;
BEGIN
  -- 1. Buscar a oferta ativa
  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = p_offer_id;
  
  IF v_offer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oferta de mídia não encontrada.');
  END IF;

  IF v_offer.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas ofertas de mídia ativas podem receber pedidos.');
  END IF;

  -- 2. Inserir o pedido com congelamento automático de valores
  INSERT INTO public.ad_offer_orders (
    offer_id,
    seller_company_id,
    buyer_company_id,
    buyer_name,
    buyer_email,
    buyer_phone,
    gross_amount_cents,
    platform_fee_percentage,
    platform_fee_cents,
    seller_net_cents,
    credits_amount,
    status,
    payment_status,
    notes,
    created_by
  ) VALUES (
    v_offer.id,
    v_offer.company_id,
    p_buyer_company_id,
    p_buyer_name,
    p_buyer_email,
    p_buyer_phone,
    v_offer.price_cents,
    v_offer.platform_fee_percentage,
    v_offer.platform_fee_cents,
    v_offer.seller_net_cents,
    v_offer.credits_amount,
    'requested',
    'pending',
    p_notes,
    auth.uid()
  ) RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true, 
    'order_id', v_order_id, 
    'gross_amount_cents', v_offer.price_cents, 
    'seller_net_cents', v_offer.seller_net_cents
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4A: MARKETPLACE INTERNO E SOLICITAÇÃO DE MÍDIA
-- Data: 2026-07-31
-- ============================================================================

-- 1. ADICIONAR NOVOS CAMPOS DE SOLICITAÇÃO EM AD_OFFER_ORDERS
ALTER TABLE public.ad_offer_orders
  ADD COLUMN IF NOT EXISTS request_message TEXT,
  ADD COLUMN IF NOT EXISTS requested_start_date DATE,
  ADD COLUMN IF NOT EXISTS requested_end_date DATE,
  ADD COLUMN IF NOT EXISTS requested_media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending_approval' CHECK (approval_status IN ('pending_approval', 'approved', 'rejected', 'cancelled')),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_ad_orders_approval_status ON public.ad_offer_orders(approval_status);

-- 2. RPC TRANSACIONAL PARA CRIAR SOLICITAÇÃO NO MARKETPLACE COM VALIDAÇÃO DE CONCORRENTES
CREATE OR REPLACE FUNCTION public.create_marketplace_media_request(
  p_offer_id UUID,
  p_buyer_company_id UUID,
  p_request_message TEXT DEFAULT NULL,
  p_requested_start_date DATE DEFAULT NULL,
  p_requested_end_date DATE DEFAULT NULL,
  p_requested_media_asset_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_offer RECORD;
  v_prefs RECORD;
  v_buyer_segments TEXT[];
  v_seg TEXT;
  v_media RECORD;
  v_order_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- 1. Buscar a oferta de mídia
  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = p_offer_id;

  IF v_offer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oferta de mídia não encontrada.');
  END IF;

  -- Validar se a oferta está ACTIVE
  IF v_offer.status != 'active' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_REQUEST_BLOCKED_INACTIVE_OFFER', jsonb_build_object('offer_id', p_offer_id));

    RETURN jsonb_build_object('success', false, 'error', 'Apenas ofertas de mídia com status ATIVO podem receber solicitações.');
  END IF;

  -- 2. BLOQUEAR AUTO-COMPRA (buyer_company_id != seller_company_id)
  IF p_buyer_company_id = v_offer.company_id THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_AUTO_PURCHASE_BLOCKED', jsonb_build_object('offer_id', p_offer_id));

    RETURN jsonb_build_object('success', false, 'error', 'Você não pode solicitar veiculação em uma oferta da própria empresa.');
  END IF;

  -- 3. VALIDAR PREFERÊNCIAS E BLOQUEIOS DA EMPRESA EXIBIDORA
  SELECT * INTO v_prefs FROM public.company_network_preferences WHERE company_id = v_offer.company_id;

  IF v_prefs.company_id IS NOT NULL THEN
    -- A. Exibidora não aceita anúncios da rede
    IF v_prefs.accepts_network_ads = FALSE THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_SELLER_NO_NETWORK_ADS', jsonb_build_object('seller_company_id', v_offer.company_id));

      RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não está aceitando anúncios da rede no momento.');
    END IF;

    -- B. Empresa compradora bloqueada individualmente
    IF v_prefs.blocked_companies IS NOT NULL AND ARRAY[p_buyer_company_id::text] <@ v_prefs.blocked_companies THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_COMPANY_BLOCKED', jsonb_build_object('seller_company_id', v_offer.company_id, 'buyer_company_id', p_buyer_company_id));

      RETURN jsonb_build_object('success', false, 'error', 'A solicitação foi recusada devido a restrições de concorrência configuradas pela empresa exibidora.');
    END IF;

    -- C. Segmentos da empresa compradora bloqueados
    IF v_prefs.blocked_segments IS NOT NULL AND array_length(v_prefs.blocked_segments, 1) > 0 THEN
      SELECT ARRAY_AGG(segment_id::text) INTO v_buyer_segments 
      FROM public.company_segments 
      WHERE company_id = p_buyer_company_id;

      IF v_buyer_segments IS NOT NULL THEN
        FOREACH v_seg IN ARRAY v_buyer_segments LOOP
          IF ARRAY[v_seg] <@ v_prefs.blocked_segments THEN
            INSERT INTO public.audit_logs (user_id, company_id, action, details)
            VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_SEGMENT_BLOCKED', jsonb_build_object('seller_company_id', v_offer.company_id, 'blocked_segment', v_seg));

            RETURN jsonb_build_object('success', false, 'error', 'A solicitação foi recusada pois o segmento da sua empresa é considerado concorrente direto pela exibidora.');
          END IF;
        END LOOP;
      END IF;
    END IF;
  END IF;

  -- 4. VALIDAR MÍDIA SOLICITADA (SE FORNECIDA)
  IF p_requested_media_asset_id IS NOT NULL THEN
    SELECT * INTO v_media FROM public.media_assets WHERE id = p_requested_media_asset_id;

    IF v_media.id IS NULL OR v_media.company_id != p_buyer_company_id OR v_media.status != 'approved' THEN
      RETURN jsonb_build_object('success', false, 'error', 'A mídia selecionada deve pertencer à sua empresa e estar com status APROVADO.');
    END IF;
  END IF;

  -- 5. CRIAR PEDIDO COM CONGELAMENTO AUTOMÁTICO DOS VALORES
  INSERT INTO public.ad_offer_orders (
    offer_id,
    seller_company_id,
    buyer_company_id,
    gross_amount_cents,
    platform_fee_percentage,
    platform_fee_cents,
    seller_net_cents,
    credits_amount,
    status,
    payment_status,
    approval_status,
    request_message,
    requested_start_date,
    requested_end_date,
    requested_media_asset_id,
    notes,
    created_by
  ) VALUES (
    v_offer.id,
    v_offer.company_id,
    p_buyer_company_id,
    v_offer.price_cents,
    v_offer.platform_fee_percentage,
    v_offer.platform_fee_cents,
    v_offer.seller_net_cents,
    v_offer.credits_amount,
    'requested',
    'pending',
    'pending_approval',
    p_request_message,
    p_requested_start_date,
    p_requested_end_date,
    p_requested_media_asset_id,
    p_notes,
    v_user_id
  ) RETURNING id INTO v_order_id;

  -- 6. REGISTRAR AUDIT LOG DE SUCESSO
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_REQUEST_CREATED', jsonb_build_object('order_id', v_order_id, 'offer_id', p_offer_id, 'seller_company_id', v_offer.company_id));

  RETURN jsonb_build_object(
    'success', true, 
    'order_id', v_order_id, 
    'approval_status', 'pending_approval',
    'gross_amount_cents', v_offer.price_cents,
    'seller_net_cents', v_offer.seller_net_cents
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. RPC PARA APROVAÇÃO DE SOLICITAÇÃO DE MÍDIA (APPROVE_MARKETPLACE_MEDIA_REQUEST)
CREATE OR REPLACE FUNCTION public.approve_marketplace_media_request(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de mídia não encontrada.');
  END IF;

  -- Verificar se o usuário é Admin da empresa exibidora/vendedora ou Master
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Admins da empresa exibidora ou Master Admin podem aprovar solicitações.');
    END IF;
  END IF;

  -- Atualizar status da solicitação
  UPDATE public.ad_offer_orders
  SET 
    approval_status = 'approved',
    status = 'approved',
    approved_by = v_user_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, v_order.seller_company_id, 'MARKETPLACE_REQUEST_APPROVED', jsonb_build_object('order_id', p_order_id));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. RPC PARA REJEIÇÃO DE SOLICITAÇÃO COM MOTIVO (REJECT_MARKETPLACE_MEDIA_REQUEST)
CREATE OR REPLACE FUNCTION public.reject_marketplace_media_request(
  p_order_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A rejeição de uma solicitação exige obrigatoriamente um motivo.');
  END IF;

  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de mídia não encontrada.');
  END IF;

  -- Verificar se o usuário é Admin da empresa exibidora/vendedora ou Master
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Admins da empresa exibidora ou Master Admin podem rejeitar solicitações.');
    END IF;
  END IF;

  -- Atualizar status da solicitação
  UPDATE public.ad_offer_orders
  SET 
    approval_status = 'rejected',
    status = 'rejected',
    rejected_by = v_user_id,
    rejected_at = NOW(),
    rejection_reason = p_rejection_reason,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, v_order.seller_company_id, 'MARKETPLACE_REQUEST_REJECTED', jsonb_build_object('order_id', p_order_id, 'reason', p_rejection_reason));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. RPC PARA CANCELAMENTO PELA EMPRESA COMPRADORA (CANCEL_MARKETPLACE_MEDIA_REQUEST)
CREATE OR REPLACE FUNCTION public.cancel_marketplace_media_request(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_buyer_member BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de mídia não encontrada.');
  END IF;

  IF v_order.payment_status = 'paid_manual' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitações marcadas como pagas não podem ser canceladas diretamente.');
  END IF;

  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.buyer_company_id AND user_id = v_user_id AND is_active = TRUE
    ) INTO v_is_buyer_member;

    IF NOT v_is_buyer_member THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas membros da empresa compradora ou Master Admin podem cancelar solicitações pendentes.');
    END IF;
  END IF;

  UPDATE public.ad_offer_orders
  SET 
    approval_status = 'cancelled',
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, v_order.buyer_company_id, 'MARKETPLACE_REQUEST_CANCELLED', jsonb_build_object('order_id', p_order_id));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4A: HARDENING DE SOLICITAÇÕES E MARKETPLACE
-- Data: 2026-07-31
-- ============================================================================

-- 1. REESCREVER RPC CREATE_MARKETPLACE_MEDIA_REQUEST COM COMPARAÇÕES UUID PURAS E VALIDAÇÃO COMPLETA
CREATE OR REPLACE FUNCTION public.create_marketplace_media_request(
  p_offer_id UUID,
  p_buyer_company_id UUID,
  p_request_message TEXT DEFAULT NULL,
  p_requested_start_date DATE DEFAULT NULL,
  p_requested_end_date DATE DEFAULT NULL,
  p_requested_media_asset_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_offer RECORD;
  v_prefs RECORD;
  v_media RECORD;
  v_order_id UUID;
  v_user_id UUID;
  v_has_blocked_segment BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  -- 1. Buscar a oferta de mídia
  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = p_offer_id;

  IF v_offer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oferta de mídia não encontrada.');
  END IF;

  -- Validar se a oferta está ACTIVE
  IF v_offer.status != 'active' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_REQUEST_BLOCKED_INACTIVE_OFFER', jsonb_build_object('offer_id', p_offer_id, 'status', v_offer.status));

    RETURN jsonb_build_object('success', false, 'error', 'Apenas ofertas de mídia com status ATIVO podem receber solicitações.');
  END IF;

  -- 2. BLOQUEAR AUTO-COMPRA (buyer_company_id != seller_company_id)
  IF p_buyer_company_id = v_offer.company_id THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_AUTO_PURCHASE_BLOCKED', jsonb_build_object('offer_id', p_offer_id));

    RETURN jsonb_build_object('success', false, 'error', 'Você não pode solicitar veiculação em uma oferta da própria empresa.');
  END IF;

  -- 3. VALIDAR DATAS SOLICITADAS
  IF p_requested_start_date IS NOT NULL AND p_requested_end_date IS NOT NULL THEN
    IF p_requested_end_date < p_requested_start_date THEN
      RETURN jsonb_build_object('success', false, 'error', 'A data final solicitada não pode ser anterior à data inicial.');
    END IF;
  END IF;

  IF v_offer.valid_from IS NOT NULL AND p_requested_start_date IS NOT NULL THEN
    IF p_requested_start_date < v_offer.valid_from::date THEN
      RETURN jsonb_build_object('success', false, 'error', 'A data inicial solicitada é anterior ao início de validade da oferta.');
    END IF;
  END IF;

  IF v_offer.valid_until IS NOT NULL AND p_requested_end_date IS NOT NULL THEN
    IF p_requested_end_date > v_offer.valid_until::date THEN
      RETURN jsonb_build_object('success', false, 'error', 'A data final solicitada excede o limite de validade da oferta.');
    END IF;
  END IF;

  -- 4. VALIDAR PREFERÊNCIAS E BLOQUEIOS DA EMPRESA EXIBIDORA (COMPARAÇÃO UUID PURA)
  SELECT * INTO v_prefs FROM public.company_network_preferences WHERE company_id = v_offer.company_id;

  IF v_prefs.company_id IS NOT NULL THEN
    -- A. Exibidora não aceita anúncios da rede
    IF v_prefs.accepts_network_ads = FALSE THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_SELLER_NO_NETWORK_ADS', jsonb_build_object('seller_company_id', v_offer.company_id));

      RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não está aceitando anúncios da rede no momento.');
    END IF;

    -- B. Empresa compradora bloqueada individualmente (UUID = ANY(UUID[]))
    IF v_prefs.blocked_companies IS NOT NULL AND p_buyer_company_id = ANY(v_prefs.blocked_companies) THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_COMPANY_BLOCKED', jsonb_build_object('seller_company_id', v_offer.company_id, 'buyer_company_id', p_buyer_company_id));

      RETURN jsonb_build_object('success', false, 'error', 'A solicitação foi recusada devido a restrições de concorrência configuradas pela empresa exibidora.');
    END IF;

    -- C. Segmentos da empresa compradora bloqueados (Interseção direta em SQL)
    IF v_prefs.blocked_segments IS NOT NULL AND array_length(v_prefs.blocked_segments, 1) > 0 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.company_segments 
        WHERE company_id = p_buyer_company_id 
          AND segment_id = ANY(v_prefs.blocked_segments)
      ) INTO v_has_blocked_segment;

      IF v_has_blocked_segment THEN
        INSERT INTO public.audit_logs (user_id, company_id, action, details)
        VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_SEGMENT_BLOCKED', jsonb_build_object('seller_company_id', v_offer.company_id, 'buyer_company_id', p_buyer_company_id));

        RETURN jsonb_build_object('success', false, 'error', 'A solicitação foi recusada pois o segmento da sua empresa é considerado concorrente direto pela exibidora.');
      END IF;
    END IF;
  END IF;

  -- 5. VALIDAR MÍDIA SOLICITADA DENTRO DA RPC (DEVE PERTENCER À COMPRADORA E ESTAR APPROVED)
  IF p_requested_media_asset_id IS NOT NULL THEN
    SELECT * INTO v_media FROM public.media_assets WHERE id = p_requested_media_asset_id;

    IF v_media.id IS NULL OR v_media.company_id != p_buyer_company_id OR v_media.status != 'approved' THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_INVALID_MEDIA_BLOCKED', jsonb_build_object('requested_media_id', p_requested_media_asset_id));

      RETURN jsonb_build_object('success', false, 'error', 'A mídia selecionada deve pertencer à sua empresa e estar obrigatoriamente APROVADA.');
    END IF;
  END IF;

  -- 6. CRIAR PEDIDO COM CONGELAMENTO AUTOMÁTICO DOS VALORES
  INSERT INTO public.ad_offer_orders (
    offer_id,
    seller_company_id,
    buyer_company_id,
    gross_amount_cents,
    platform_fee_percentage,
    platform_fee_cents,
    seller_net_cents,
    credits_amount,
    status,
    payment_status,
    approval_status,
    request_message,
    requested_start_date,
    requested_end_date,
    requested_media_asset_id,
    notes,
    created_by
  ) VALUES (
    v_offer.id,
    v_offer.company_id,
    p_buyer_company_id,
    v_offer.price_cents,
    v_offer.platform_fee_percentage,
    v_offer.platform_fee_cents,
    v_offer.seller_net_cents,
    v_offer.credits_amount,
    'requested',
    'pending',
    'pending_approval',
    p_request_message,
    p_requested_start_date,
    p_requested_end_date,
    p_requested_media_asset_id,
    p_notes,
    v_user_id
  ) RETURNING id INTO v_order_id;

  -- 7. REGISTRAR AUDIT LOG DE SUCESSO
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, p_buyer_company_id, 'MARKETPLACE_REQUEST_CREATED', jsonb_build_object('order_id', v_order_id, 'offer_id', p_offer_id, 'seller_company_id', v_offer.company_id));

  RETURN jsonb_build_object(
    'success', true, 
    'order_id', v_order_id, 
    'approval_status', 'pending_approval',
    'gross_amount_cents', v_offer.price_cents,
    'seller_net_cents', v_offer.seller_net_cents
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. REESCREVER RPC DE APROVAÇÃO (VALIDAR STATUS PENDENTE)
CREATE OR REPLACE FUNCTION public.approve_marketplace_media_request(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de mídia não encontrada.');
  END IF;

  -- Impedir re-aprovação de pedidos já encerrados
  IF v_order.approval_status != 'pending_approval' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status pendente (pending_approval) podem ser aprovadas.');
  END IF;

  -- Verificar se o usuário é Admin da empresa exibidora/vendedora ou Master (Comprador NÃO aprova própria solicitação)
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Admins da empresa exibidora ou Master Admin podem aprovar solicitações.');
    END IF;
  END IF;

  UPDATE public.ad_offer_orders
  SET 
    approval_status = 'approved',
    status = 'approved',
    approved_by = v_user_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, v_order.seller_company_id, 'MARKETPLACE_REQUEST_APPROVED', jsonb_build_object('order_id', p_order_id));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. REESCREVER RPC DE REJEIÇÃO (VALIDAR STATUS PENDENTE E MOTIVO)
CREATE OR REPLACE FUNCTION public.reject_marketplace_media_request(
  p_order_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A rejeição de uma solicitação exige obrigatoriamente um motivo.');
  END IF;

  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de mídia não encontrada.');
  END IF;

  IF v_order.approval_status != 'pending_approval' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status pendente (pending_approval) podem ser rejeitadas.');
  END IF;

  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Admins da empresa exibidora ou Master Admin podem rejeitar solicitações.');
    END IF;
  END IF;

  UPDATE public.ad_offer_orders
  SET 
    approval_status = 'rejected',
    status = 'rejected',
    rejected_by = v_user_id,
    rejected_at = NOW(),
    rejection_reason = p_rejection_reason,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, v_order.seller_company_id, 'MARKETPLACE_REQUEST_REJECTED', jsonb_build_object('order_id', p_order_id, 'reason', p_rejection_reason));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. REESCREVER RPC DE CANCELAMENTO (VALIDAR STATUS PENDENTE)
CREATE OR REPLACE FUNCTION public.cancel_marketplace_media_request(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_buyer_member BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de mídia não encontrada.');
  END IF;

  IF v_order.approval_status != 'pending_approval' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status pendente (pending_approval) podem ser canceladas.');
  END IF;

  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.buyer_company_id AND user_id = v_user_id AND is_active = TRUE
    ) INTO v_is_buyer_member;

    IF NOT v_is_buyer_member THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas membros da empresa compradora ou Master Admin podem cancelar solicitações pendentes.');
    END IF;
  END IF;

  UPDATE public.ad_offer_orders
  SET 
    approval_status = 'cancelled',
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (v_user_id, v_order.buyer_company_id, 'MARKETPLACE_REQUEST_CANCELLED', jsonb_build_object('order_id', p_order_id));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4B: CONVERSÃO DE PEDIDO EM CAMPANHA E ENTREGA
-- Data: 2026-07-31
-- ============================================================================

-- 1. AMPLIAR CHECK DE CAMPAIGN_TYPE E ADICIONAR CAMPOS COMERCIAIS EM CAMPAIGNS
ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_campaign_type_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_campaign_type_check 
  CHECK (campaign_type IN ('internal', 'paid', 'exchange', 'external', 'marketplace', 'commercial'));

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS buyer_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ad_offer_order_id UUID REFERENCES public.ad_offer_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credits_contracted NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS credits_delivered NUMERIC(12,2) DEFAULT 0;

-- 2. TABELA LIVRO DE ENTREGA DO PEDIDO PAGO (AD_ORDER_DELIVERY_LEDGER)
CREATE TABLE IF NOT EXISTS public.ad_order_delivery_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.ad_offer_orders(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  buyer_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  credits_contracted NUMERIC(12,2) NOT NULL CHECK (credits_contracted > 0),
  credits_delivered NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credits_delivered >= 0),
  credits_remaining NUMERIC(12,2) NOT NULL CHECK (credits_remaining >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_ledger_order ON public.ad_order_delivery_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_ledger_campaign ON public.ad_order_delivery_ledger(campaign_id);

-- 3. TABELA USO DE ENTREGA POR PROOF OF PLAY (AD_ORDER_DELIVERY_USAGE)
CREATE TABLE IF NOT EXISTS public.ad_order_delivery_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_ledger_id UUID NOT NULL REFERENCES public.ad_order_delivery_ledger(id) ON DELETE CASCADE,
  playback_log_id UUID NOT NULL UNIQUE REFERENCES public.playback_logs(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.ad_offer_orders(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  credits_used NUMERIC(12,2) NOT NULL CHECK (credits_used > 0),
  status TEXT NOT NULL DEFAULT 'used' CHECK (status IN ('used', 'reversed', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_usage_ledger ON public.ad_order_delivery_usage(delivery_ledger_id);
CREATE INDEX IF NOT EXISTS idx_delivery_usage_campaign ON public.ad_order_delivery_usage(campaign_id);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.ad_order_delivery_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_order_delivery_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DeliveryLedger - Leitura por comprador, vendedor ou Master" ON public.ad_order_delivery_ledger;
CREATE POLICY "DeliveryLedger - Leitura por comprador, vendedor ou Master"
  ON public.ad_order_delivery_ledger FOR SELECT TO authenticated
  USING (
    is_master_admin() OR
    seller_company_id IN (SELECT public.get_user_company_ids()) OR
    buyer_company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "DeliveryUsage - Leitura por comprador, vendedor ou Master" ON public.ad_order_delivery_usage;
CREATE POLICY "DeliveryUsage - Leitura por comprador, vendedor ou Master"
  ON public.ad_order_delivery_usage FOR SELECT TO authenticated
  USING (
    is_master_admin() OR
    campaign_id IN (
      SELECT id FROM public.campaigns 
      WHERE buyer_company_id IN (SELECT public.get_user_company_ids()) OR seller_company_id IN (SELECT public.get_user_company_ids())
    )
  );

-- 5. RPC TRANSACIONAL DE CONVERSÃO DE PEDIDO EM CAMPANHA (CONVERT_AD_OFFER_ORDER_TO_CAMPAIGN)
CREATE OR REPLACE FUNCTION public.convert_ad_offer_order_to_campaign(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_offer RECORD;
  v_media RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
  v_campaign_id UUID;
  v_ledger_id UUID;
  v_screen RECORD;
  v_screen_count INTEGER := 0;
BEGIN
  v_user_id := auth.uid();

  -- 1. Buscar pedido
  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido de mídia não encontrado.');
  END IF;

  -- 2. Validar que ainda NÃO foi convertido
  IF v_order.campaign_id IS NOT NULL OR v_order.status = 'converted_to_campaign' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi convertido em campanha comercial anteriormente.');
  END IF;

  -- 3. Validar aprovação e pagamento manual
  IF v_order.approval_status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status APROVADO podem ser convertidas.');
  END IF;

  IF v_order.payment_status != 'paid_manual' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com pagamento manual confirmado (paid_manual) podem ser convertidas.');
  END IF;

  -- 4. Validar permissão (Apenas Admin da exibidora ou Master Admin)
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Admins da empresa exibidora ou Master Admin podem converter o pedido em campanha.');
    END IF;
  END IF;

  -- 5. Validar mídia solicitada
  IF v_order.requested_media_asset_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'O pedido precisa ter uma mídia selecionada para conversão.');
  END IF;

  SELECT * INTO v_media FROM public.media_assets WHERE id = v_order.requested_media_asset_id;

  IF v_media.id IS NULL OR v_media.company_id != v_order.buyer_company_id OR v_media.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A mídia do pedido deve pertencer à empresa compradora e estar APROVADA.');
  END IF;

  -- 6. Validar oferta original
  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = v_order.offer_id;

  IF v_offer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oferta de mídia original não encontrada.');
  END IF;

  -- 7. Validar existência de telas ativas da exibidora
  SELECT COUNT(*) INTO v_screen_count FROM public.screens WHERE company_id = v_order.seller_company_id AND status != 'inactive';

  IF v_screen_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não possui telas ativas cadastradas no momento.');
  END IF;

  -- 8. CRIAR CAMPANHA COMERCIAL EM CAMPAIGNS
  INSERT INTO public.campaigns (
    company_id,
    name,
    description,
    campaign_type,
    status,
    start_date,
    end_date,
    target_insertions,
    buyer_company_id,
    seller_company_id,
    ad_offer_order_id,
    credits_contracted,
    credits_delivered,
    created_by
  ) VALUES (
    v_order.buyer_company_id,
    'Campanha Comercial - ' || v_offer.title,
    'Campanha do Marketplace vinculada ao pedido ' || v_order.id,
    'marketplace',
    'active',
    COALESCE(v_order.requested_start_date, CURRENT_DATE)::text,
    COALESCE(v_order.requested_end_date, CURRENT_DATE + INTERVAL '30 days')::text,
    v_order.credits_amount::integer,
    v_order.buyer_company_id,
    v_order.seller_company_id,
    v_order.id,
    v_order.credits_amount,
    0,
    v_user_id
  ) RETURNING id INTO v_campaign_id;

  -- 9. VINCULAR MÍDIA EM CAMPAIGN_MEDIA
  INSERT INTO public.campaign_media (
    campaign_id,
    media_asset_id,
    playback_duration_seconds,
    is_active
  ) VALUES (
    v_campaign_id,
    v_order.requested_media_asset_id,
    COALESCE(v_media.playback_duration_seconds, 10),
    TRUE
  );

  -- 10. VINCULAR TELAS DA EXIBIDORA EM CAMPAIGN_SCREENS
  FOR v_screen IN SELECT id FROM public.screens WHERE company_id = v_order.seller_company_id AND status != 'inactive' LOOP
    INSERT INTO public.campaign_screens (
      campaign_id,
      screen_id,
      is_active
    ) VALUES (
      v_campaign_id,
      v_screen.id,
      TRUE
    );
  END LOOP;

  -- 11. CRIAR LIVRO DE ENTREGA EM AD_ORDER_DELIVERY_LEDGER
  INSERT INTO public.ad_order_delivery_ledger (
    order_id,
    campaign_id,
    seller_company_id,
    buyer_company_id,
    credits_contracted,
    credits_delivered,
    credits_remaining,
    status
  ) VALUES (
    v_order.id,
    v_campaign_id,
    v_order.seller_company_id,
    v_order.buyer_company_id,
    v_order.credits_amount,
    0,
    v_order.credits_amount,
    'active'
  ) RETURNING id INTO v_ledger_id;

  -- 12. ATUALIZAR STATUS DO PEDIDO
  UPDATE public.ad_offer_orders
  SET 
    campaign_id = v_campaign_id,
    status = 'converted_to_campaign',
    updated_at = NOW()
  WHERE id = p_order_id;

  -- 13. AUDIT LOG
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id, 
    v_order.seller_company_id, 
    'MARKETPLACE_ORDER_CONVERTED_TO_CAMPAIGN', 
    jsonb_build_object('order_id', p_order_id, 'campaign_id', v_campaign_id, 'ledger_id', v_ledger_id, 'credits_contracted', v_order.credits_amount)
  );

  RETURN jsonb_build_object(
    'success', true, 
    'campaign_id', v_campaign_id, 
    'ledger_id', v_ledger_id,
    'credits_contracted', v_order.credits_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. RPC DE PROCESSAMENTO DE ENTREGA POR PROOF OF PLAY (PROCESS_COMMERCIAL_CAMPAIGN_DELIVERY)
CREATE OR REPLACE FUNCTION public.process_commercial_campaign_delivery(
  p_campaign_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_ledger RECORD;
  v_log RECORD;
  v_log_credits NUMERIC(12,2);
  v_processed_count INTEGER := 0;
  v_total_credits_delivered NUMERIC(12,2) := 0;
  v_credit_deducted NUMERIC(12,2);
BEGIN
  -- 1. Trava pessimista no livro de entrega da campanha
  SELECT * INTO v_ledger 
  FROM public.ad_order_delivery_ledger 
  WHERE campaign_id = p_campaign_id AND status = 'active'
  FOR UPDATE;

  IF v_ledger.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Livro de entregas ativo não encontrado para esta campanha.');
  END IF;

  IF v_ledger.credits_remaining <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Os créditos contratados para esta campanha já foram totalmente entregues.', 'credits_remaining', 0);
  END IF;

  -- 2. Loop sobre os playback_logs concluídos da campanha que ainda não foram abatidos
  FOR v_log IN 
    SELECT pl.* 
    FROM public.playback_logs pl
    JOIN public.campaign_media cm ON cm.media_asset_id = pl.media_asset_id AND cm.campaign_id = p_campaign_id
    WHERE pl.status = 'completed'
      AND pl.screen_id IN (SELECT screen_id FROM public.campaign_screens WHERE campaign_id = p_campaign_id)
      AND pl.id NOT IN (SELECT playback_log_id FROM public.ad_order_delivery_usage WHERE campaign_id = p_campaign_id)
    ORDER BY pl.played_at ASC
  LOOP
    -- Se os créditos restantes zeraram, encerra o loop
    IF v_ledger.credits_remaining <= 0 THEN
      EXIT;
    END IF;

    -- Calcular valor dos créditos pela duração (5s=0.5, 10s=1.0, 15s=1.5, 30s=3.0)
    CASE COALESCE(v_log.actual_duration_seconds, v_log.planned_duration_seconds, 10)
      WHEN 5 THEN v_log_credits := 0.5;
      WHEN 15 THEN v_log_credits := 1.5;
      WHEN 30 THEN v_log_credits := 3.0;
      ELSE v_log_credits := 1.0;
    END CASE;

    -- Regra de ajuste se o saldo restante for menor que o valor do log (não deixa saldo negativo)
    IF v_log_credits > v_ledger.credits_remaining THEN
      v_credit_deducted := v_ledger.credits_remaining;
    ELSE
      v_credit_deducted := v_log_credits;
    END IF;

    -- Insere o registro de entrega (UNIQUE playback_log_id)
    INSERT INTO public.ad_order_delivery_usage (
      delivery_ledger_id,
      playback_log_id,
      order_id,
      campaign_id,
      media_asset_id,
      screen_id,
      credits_used,
      status
    ) VALUES (
      v_ledger.id,
      v_log.id,
      v_ledger.order_id,
      p_campaign_id,
      v_log.media_asset_id,
      v_log.screen_id,
      v_credit_deducted,
      'used'
    );

    -- Atualiza variáveis em memória
    v_ledger.credits_delivered := v_ledger.credits_delivered + v_credit_deducted;
    v_ledger.credits_remaining := v_ledger.credits_remaining - v_credit_deducted;
    v_total_credits_delivered := v_total_credits_delivered + v_credit_deducted;
    v_processed_count := v_processed_count + 1;
  END LOOP;

  -- 3. Atualizar o livro de entregas no banco
  UPDATE public.ad_order_delivery_ledger
  SET 
    credits_delivered = v_ledger.credits_delivered,
    credits_remaining = v_ledger.credits_remaining,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END,
    updated_at = NOW()
  WHERE id = v_ledger.id;

  -- 4. Atualizar entrega na campanha
  UPDATE public.campaigns
  SET 
    credits_delivered = v_ledger.credits_delivered,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE status END,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  IF v_ledger.credits_remaining <= 0 THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (
      auth.uid(), 
      v_ledger.seller_company_id, 
      'COMMERCIAL_CAMPAIGN_DELIVERY_COMPLETED', 
      jsonb_build_object('campaign_id', p_campaign_id, 'total_delivered', v_ledger.credits_delivered)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'processed_logs_count', v_processed_count,
    'total_credits_delivered', v_ledger.credits_delivered,
    'credits_remaining', v_ledger.credits_remaining,
    'delivery_status', CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4B: HARDENING DE CONVERSÃO E ENTREGA DE CAMPANHA
-- Data: 2026-07-31
-- ============================================================================

-- 1. REESCREVER RPC CONVERT_AD_OFFER_ORDER_TO_CAMPAIGN COM REVALIDAÇÃO COMPLETA
CREATE OR REPLACE FUNCTION public.convert_ad_offer_order_to_campaign(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_offer RECORD;
  v_media RECORD;
  v_prefs RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
  v_has_blocked_segment BOOLEAN;
  v_campaign_id UUID;
  v_ledger_id UUID;
  v_screen RECORD;
  v_screen_count INTEGER := 0;
  v_duration INTEGER;
BEGIN
  v_user_id := auth.uid();

  -- 1. Trava pessimista no pedido (FOR UPDATE)
  SELECT * INTO v_order 
  FROM public.ad_offer_orders 
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido de mídia não encontrado.');
  END IF;

  -- 2. Validar que ainda NÃO foi convertido (Garantia de conversão única)
  IF v_order.campaign_id IS NOT NULL OR v_order.status = 'converted_to_campaign' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'COMMERCIAL_CONVERSION_DUPLICATE_BLOCKED', jsonb_build_object('order_id', p_order_id, 'campaign_id', v_order.campaign_id));

    RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi convertido em campanha comercial anteriormente.');
  END IF;

  -- 3. Validar aprovação e pagamento manual
  IF v_order.approval_status != 'approved' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'COMMERCIAL_CONVERSION_NOT_APPROVED_BLOCKED', jsonb_build_object('order_id', p_order_id, 'approval_status', v_order.approval_status));

    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status APROVADO podem ser convertidas.');
  END IF;

  IF v_order.payment_status != 'paid_manual' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'COMMERCIAL_CONVERSION_PAYMENT_PENDING_BLOCKED', jsonb_build_object('order_id', p_order_id, 'payment_status', v_order.payment_status));

    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com pagamento manual confirmado (paid_manual) podem ser convertidas.');
  END IF;

  -- 4. Validar permissão (Apenas Admin ativo da exibidora ou Master Admin. Comprador NÃO converte sozinho)
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, v_order.seller_company_id, 'COMMERCIAL_CONVERSION_PERMISSION_DENIED', jsonb_build_object('order_id', p_order_id));

      RETURN jsonb_build_object('success', false, 'error', 'Apenas Admins da empresa exibidora ou Master Admin podem converter o pedido em campanha.');
    END IF;
  END IF;

  -- 5. Validar mídia solicitada (Deve existir, pertencer à compradora e estar APROVADA)
  IF v_order.requested_media_asset_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'O pedido precisa ter uma mídia selecionada para conversão.');
  END IF;

  SELECT * INTO v_media FROM public.media_assets WHERE id = v_order.requested_media_asset_id;

  IF v_media.id IS NULL OR v_media.company_id != v_order.buyer_company_id OR v_media.status != 'approved' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.buyer_company_id, 'COMMERCIAL_CONVERSION_INVALID_MEDIA_BLOCKED', jsonb_build_object('order_id', p_order_id, 'media_id', v_order.requested_media_asset_id));

    RETURN jsonb_build_object('success', false, 'error', 'A mídia do pedido deve pertencer à empresa compradora e estar obrigatoriamente APROVADA.');
  END IF;

  -- 6. Validar oferta original
  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = v_order.offer_id;

  IF v_offer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oferta de mídia original não encontrada.');
  END IF;

  -- 7. REVALIDAR PREFERÊNCIAS E BLOQUEIOS DA EXIBIDORA NA CONVERSÃO
  SELECT * INTO v_prefs FROM public.company_network_preferences WHERE company_id = v_order.seller_company_id;

  IF v_prefs.company_id IS NOT NULL THEN
    IF v_prefs.accepts_network_ads = FALSE THEN
      RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora desativou anúncios de rede.');
    END IF;

    IF v_prefs.blocked_companies IS NOT NULL AND v_order.buyer_company_id = ANY(v_prefs.blocked_companies) THEN
      RETURN jsonb_build_object('success', false, 'error', 'A conversão foi bloqueada pois a empresa compradora foi incluída na lista de concorrentes da exibidora.');
    END IF;

    IF v_prefs.blocked_segments IS NOT NULL AND array_length(v_prefs.blocked_segments, 1) > 0 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.company_segments 
        WHERE company_id = v_order.buyer_company_id 
          AND segment_id = ANY(v_prefs.blocked_segments)
      ) INTO v_has_blocked_segment;

      IF v_has_blocked_segment THEN
        RETURN jsonb_build_object('success', false, 'error', 'A conversão foi bloqueada pois o segmento da compradora cruza com restrições de concorrência da exibidora.');
      END IF;
    END IF;
  END IF;

  -- 8. VALIDAR TELAS ATIVAS DA EXIBIDORA (ABORTAR SE 0 TELAS)
  SELECT COUNT(*) INTO v_screen_count FROM public.screens WHERE company_id = v_order.seller_company_id AND status != 'inactive';

  IF v_screen_count = 0 THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'COMMERCIAL_CONVERSION_NO_SCREENS_BLOCKED', jsonb_build_object('order_id', p_order_id));

    RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não possui telas ativas cadastradas para veicular a campanha.');
  END IF;

  -- Duração da mídia obtida dinamicamente da própria mídia ou da oferta
  v_duration := COALESCE(v_media.playback_duration_seconds, v_offer.duration_seconds, 10);

  -- 9. CRIAR CAMPANHA COMERCIAL EM CAMPAIGNS (TIPO MARKETPLACE)
  INSERT INTO public.campaigns (
    company_id,
    name,
    description,
    campaign_type,
    status,
    start_date,
    end_date,
    target_insertions,
    buyer_company_id,
    seller_company_id,
    ad_offer_order_id,
    credits_contracted,
    credits_delivered,
    created_by
  ) VALUES (
    v_order.buyer_company_id,
    'Campanha Comercial - ' || v_offer.title,
    'Campanha do Marketplace vinculada ao pedido ' || v_order.id,
    'marketplace',
    'active',
    COALESCE(v_order.requested_start_date, CURRENT_DATE)::text,
    COALESCE(v_order.requested_end_date, CURRENT_DATE + INTERVAL '30 days')::text,
    v_order.credits_amount::integer,
    v_order.buyer_company_id,
    v_order.seller_company_id,
    v_order.id,
    v_order.credits_amount,
    0,
    v_user_id
  ) RETURNING id INTO v_campaign_id;

  -- 10. VINCULAR MÍDIA EM CAMPAIGN_MEDIA COM DURAÇÃO DINÂMICA
  INSERT INTO public.campaign_media (
    campaign_id,
    media_asset_id,
    playback_duration_seconds,
    is_active
  ) VALUES (
    v_campaign_id,
    v_order.requested_media_asset_id,
    v_duration,
    TRUE
  );

  -- 11. VINCULAR TELAS ATIVAS DA EXIBIDORA EM CAMPAIGN_SCREENS
  FOR v_screen IN SELECT id FROM public.screens WHERE company_id = v_order.seller_company_id AND status != 'inactive' LOOP
    INSERT INTO public.campaign_screens (
      campaign_id,
      screen_id,
      is_active
    ) VALUES (
      v_campaign_id,
      v_screen.id,
      TRUE
    );
  END LOOP;

  -- 12. CRIAR LIVRO DE ENTREGA EM AD_ORDER_DELIVERY_LEDGER
  INSERT INTO public.ad_order_delivery_ledger (
    order_id,
    campaign_id,
    seller_company_id,
    buyer_company_id,
    credits_contracted,
    credits_delivered,
    credits_remaining,
    status
  ) VALUES (
    v_order.id,
    v_campaign_id,
    v_order.seller_company_id,
    v_order.buyer_company_id,
    v_order.credits_amount,
    0,
    v_order.credits_amount,
    'active'
  ) RETURNING id INTO v_ledger_id;

  -- 13. ATUALIZAR STATUS DO PEDIDO DE FORMA DEFINITIVA
  UPDATE public.ad_offer_orders
  SET 
    campaign_id = v_campaign_id,
    status = 'converted_to_campaign',
    updated_at = NOW()
  WHERE id = p_order_id;

  -- 14. AUDIT LOG DE CONVERSÃO COM SUCESSO
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id, 
    v_order.seller_company_id, 
    'MARKETPLACE_ORDER_CONVERTED_TO_CAMPAIGN', 
    jsonb_build_object('order_id', p_order_id, 'campaign_id', v_campaign_id, 'ledger_id', v_ledger_id, 'credits_contracted', v_order.credits_amount)
  );

  RETURN jsonb_build_object(
    'success', true, 
    'campaign_id', v_campaign_id, 
    'ledger_id', v_ledger_id,
    'credits_contracted', v_order.credits_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. REESCREVER RPC PROCESS_COMMERCIAL_CAMPAIGN_DELIVERY COM RASTREABILIDADE DE DATAS E MÍDIAS
CREATE OR REPLACE FUNCTION public.process_commercial_campaign_delivery(
  p_campaign_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_campaign RECORD;
  v_ledger RECORD;
  v_log RECORD;
  v_log_credits NUMERIC(12,2);
  v_processed_count INTEGER := 0;
  v_total_credits_delivered NUMERIC(12,2) := 0;
  v_credit_deducted NUMERIC(12,2);
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  -- Buscar dados da campanha
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;

  IF v_campaign.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campanha comercial não encontrada.');
  END IF;

  v_start_ts := COALESCE(v_campaign.start_date::timestamptz, '1970-01-01'::timestamptz);
  v_end_ts := COALESCE((v_campaign.end_date::date + 1)::timestamptz, '2099-12-31'::timestamptz);

  -- Trava pessimista no livro de entrega da campanha
  SELECT * INTO v_ledger 
  FROM public.ad_order_delivery_ledger 
  WHERE campaign_id = p_campaign_id AND status = 'active'
  FOR UPDATE;

  IF v_ledger.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Livro de entregas ativo não encontrado para esta campanha.');
  END IF;

  IF v_ledger.credits_remaining <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Os créditos contratados para esta campanha já foram totalmente entregues.', 'credits_remaining', 0);
  END IF;

  -- Loop sobre os playback_logs concluídos estritamente vinculados à mídia e telas da exibidora dentro do período
  FOR v_log IN 
    SELECT pl.* 
    FROM public.playback_logs pl
    JOIN public.campaign_media cm ON cm.media_asset_id = pl.media_asset_id AND cm.campaign_id = p_campaign_id
    WHERE pl.status = 'completed'
      AND pl.screen_id IN (SELECT screen_id FROM public.campaign_screens WHERE campaign_id = p_campaign_id)
      AND pl.played_at >= v_start_ts AND pl.played_at <= v_end_ts
      AND pl.id NOT IN (SELECT playback_log_id FROM public.ad_order_delivery_usage WHERE campaign_id = p_campaign_id)
    ORDER BY pl.played_at ASC
  LOOP
    IF v_ledger.credits_remaining <= 0 THEN
      EXIT;
    END IF;

    -- Calcular valor dos créditos pela duração (5s=0.5, 10s=1.0, 15s=1.5, 30s=3.0)
    CASE COALESCE(v_log.actual_duration_seconds, v_log.planned_duration_seconds, 10)
      WHEN 5 THEN v_log_credits := 0.5;
      WHEN 15 THEN v_log_credits := 1.5;
      WHEN 30 THEN v_log_credits := 3.0;
      ELSE v_log_credits := 1.0;
    END CASE;

    -- Se saldo restante for menor que o valor da próxima exibição, deduz apenas o saldo restante (não deixa negativo)
    IF v_log_credits > v_ledger.credits_remaining THEN
      v_credit_deducted := v_ledger.credits_remaining;
    ELSE
      v_credit_deducted := v_log_credits;
    END IF;

    -- Registrar uso de entrega com trava UNIQUE (playback_log_id)
    INSERT INTO public.ad_order_delivery_usage (
      delivery_ledger_id,
      playback_log_id,
      order_id,
      campaign_id,
      media_asset_id,
      screen_id,
      credits_used,
      status
    ) VALUES (
      v_ledger.id,
      v_log.id,
      v_ledger.order_id,
      p_campaign_id,
      v_log.media_asset_id,
      v_log.screen_id,
      v_credit_deducted,
      'used'
    );

    v_ledger.credits_delivered := v_ledger.credits_delivered + v_credit_deducted;
    v_ledger.credits_remaining := v_ledger.credits_remaining - v_credit_deducted;
    v_total_credits_delivered := v_total_credits_delivered + v_credit_deducted;
    v_processed_count := v_processed_count + 1;
  END LOOP;

  -- Atualizar livro de entregas no banco
  UPDATE public.ad_order_delivery_ledger
  SET 
    credits_delivered = v_ledger.credits_delivered,
    credits_remaining = v_ledger.credits_remaining,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END,
    updated_at = NOW()
  WHERE id = v_ledger.id;

  -- Atualizar entrega na campanha
  UPDATE public.campaigns
  SET 
    credits_delivered = v_ledger.credits_delivered,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE status END,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  IF v_ledger.credits_remaining <= 0 THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (
      auth.uid(), 
      v_ledger.seller_company_id, 
      'COMMERCIAL_CAMPAIGN_DELIVERY_COMPLETED', 
      jsonb_build_object('campaign_id', p_campaign_id, 'total_delivered', v_ledger.credits_delivered)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'processed_logs_count', v_processed_count,
    'total_credits_delivered', v_ledger.credits_delivered,
    'credits_remaining', v_ledger.credits_remaining,
    'delivery_status', CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4C: RELATÓRIOS FINANCEIROS E EXTRATO DO EXIBIDOR
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE LIVRO FINANCEIRO DO EXIBIDOR (SELLER_FINANCIAL_LEDGER)
CREATE TABLE IF NOT EXISTS public.seller_financial_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  buyer_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ad_offer_order_id UUID NOT NULL UNIQUE REFERENCES public.ad_offer_orders(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  gross_amount_cents INTEGER NOT NULL CHECK (gross_amount_cents >= 0),
  platform_fee_cents INTEGER NOT NULL CHECK (platform_fee_cents >= 0),
  seller_net_cents INTEGER NOT NULL CHECK (seller_net_cents >= 0),
  amount_available_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_available_cents >= 0),
  amount_used_for_discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_used_for_discount_cents >= 0),
  amount_pending_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_pending_cents >= 0),
  financial_status TEXT NOT NULL DEFAULT 'pending_delivery' CHECK (financial_status IN ('pending_delivery', 'available', 'partially_used', 'used_for_discount', 'cancelled')),
  delivery_status TEXT NOT NULL DEFAULT 'in_progress' CHECK (delivery_status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_seller_fin_seller ON public.seller_financial_ledger(seller_company_id);
CREATE INDEX IF NOT EXISTS idx_seller_fin_order ON public.seller_financial_ledger(ad_offer_order_id);

-- 2. TABELA DE ABATIMENTOS MANUAIS DE MENSALIDADE (MONTHLY_FEE_DISCOUNTS)
CREATE TABLE IF NOT EXISTS public.monthly_fee_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  financial_ledger_id UUID REFERENCES public.seller_financial_ledger(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  reason TEXT NOT NULL,
  applied_by UUID NOT NULL REFERENCES public.profiles(id),
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'cancelled', 'reversed')),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_discounts_seller ON public.monthly_fee_discounts(seller_company_id);

-- 3. HABILITAR ROW LEVEL SECURITY (RLS) MULTIEMPRESA
ALTER TABLE public.seller_financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_fee_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SellerFinancialLedger - Leitura por exibidora ou Master Admin" ON public.seller_financial_ledger;
CREATE POLICY "SellerFinancialLedger - Leitura por exibidora ou Master Admin"
  ON public.seller_financial_ledger FOR SELECT TO authenticated
  USING (
    is_master_admin() OR
    seller_company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "MonthlyFeeDiscounts - Leitura por exibidora ou Master Admin" ON public.monthly_fee_discounts;
CREATE POLICY "MonthlyFeeDiscounts - Leitura por exibidora ou Master Admin"
  ON public.monthly_fee_discounts FOR SELECT TO authenticated
  USING (
    is_master_admin() OR
    seller_company_id IN (SELECT public.get_user_company_ids())
  );

-- 4. RPC TRANSACIONAL PARA APLICAR ABATIMENTO MANUAL DE MENSALIDADE (MASTER ADMIN)
CREATE OR REPLACE FUNCTION public.apply_seller_monthly_discount(
  p_ledger_id UUID,
  p_amount_cents INTEGER,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_ledger RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_discount_id UUID;
  v_new_available INTEGER;
  v_new_used INTEGER;
  v_new_status TEXT;
BEGIN
  v_user_id := auth.uid();

  -- Validar se o usuário é Master Admin
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (v_user_id, 'MONTHLY_DISCOUNT_UNAUTHORIZED_ATTEMPT', jsonb_build_object('ledger_id', p_ledger_id));

    RETURN jsonb_build_object('success', false, 'error', 'Apenas o Master Admin pode aplicar abatimentos manuais de mensalidade.');
  END IF;

  -- Validar parâmetros
  IF p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor do abatimento deve ser maior que zero.');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'O motivo do abatimento é obrigatório.');
  END IF;

  -- Trava pessimista no registro financeiro
  SELECT * INTO v_ledger 
  FROM public.seller_financial_ledger 
  WHERE id = p_ledger_id 
  FOR UPDATE;

  IF v_ledger.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registro financeiro do exibidor não encontrado.');
  END IF;

  -- Validar que o valor não excede o saldo disponível
  IF p_amount_cents > v_ledger.amount_available_cents THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_ledger.seller_company_id, 'MONTHLY_DISCOUNT_EXCEEDS_BALANCE_BLOCKED', jsonb_build_object('requested_cents', p_amount_cents, 'available_cents', v_ledger.amount_available_cents));

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'O valor do abatimento (R$ ' || (p_amount_cents::numeric / 100)::text || ') excede o saldo disponível do exibidor (R$ ' || (v_ledger.amount_available_cents::numeric / 100)::text || ').'
    );
  END IF;

  v_new_available := v_ledger.amount_available_cents - p_amount_cents;
  v_new_used := v_ledger.amount_used_for_discount_cents + p_amount_cents;

  IF v_new_available = 0 THEN
    v_new_status := 'used_for_discount';
  ELSE
    v_new_status := 'partially_used';
  END IF;

  -- 1. Inserir registro de abatimento
  INSERT INTO public.monthly_fee_discounts (
    seller_company_id,
    financial_ledger_id,
    amount_cents,
    reason,
    applied_by,
    status
  ) VALUES (
    v_ledger.seller_company_id,
    v_ledger.id,
    p_amount_cents,
    p_reason,
    v_user_id,
    'applied'
  ) RETURNING id INTO v_discount_id;

  -- 2. Atualizar o livro financeiro
  UPDATE public.seller_financial_ledger
  SET 
    amount_available_cents = v_new_available,
    amount_used_for_discount_cents = v_new_used,
    financial_status = v_new_status,
    updated_at = NOW()
  WHERE id = v_ledger.id;

  -- 3. Audit Log
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id, 
    v_ledger.seller_company_id, 
    'SELLER_MONTHLY_DISCOUNT_APPLIED', 
    jsonb_build_object(
      'discount_id', v_discount_id,
      'ledger_id', p_ledger_id,
      'amount_cents', p_amount_cents,
      'remaining_available_cents', v_new_available,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'discount_id', v_discount_id,
    'amount_cents', p_amount_cents,
    'remaining_available_cents', v_new_available,
    'financial_status', v_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. ATUALIZAR RPC CONVERT_AD_OFFER_ORDER_TO_CAMPAIGN PARA INCLUIR REGISTRO FINANCEIRO PENDENTE
CREATE OR REPLACE FUNCTION public.convert_ad_offer_order_to_campaign(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_offer RECORD;
  v_media RECORD;
  v_prefs RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
  v_has_blocked_segment BOOLEAN;
  v_campaign_id UUID;
  v_ledger_id UUID;
  v_fin_ledger_id UUID;
  v_screen RECORD;
  v_screen_count INTEGER := 0;
  v_duration INTEGER;
BEGIN
  v_user_id := auth.uid();

  -- Trava pessimista no pedido
  SELECT * INTO v_order 
  FROM public.ad_offer_orders 
  WHERE id = p_order_id 
  FOR UPDATE;

  IF v_order.id IS NULL OR v_order.campaign_id IS NOT NULL OR v_order.status = 'converted_to_campaign' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi convertido em campanha comercial anteriormente.');
  END IF;

  IF v_order.approval_status != 'approved' OR v_order.payment_status != 'paid_manual' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status APROVADO e pagamento manual confirmado podem ser convertidas.');
  END IF;

  -- Permissão do banco (Master ou Admin da Exibidora)
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Admins da empresa exibidora ou Master Admin podem converter o pedido em campanha.');
    END IF;
  END IF;

  -- Validar mídia da compradora
  SELECT * INTO v_media FROM public.media_assets WHERE id = v_order.requested_media_asset_id;
  IF v_media.id IS NULL OR v_media.company_id != v_order.buyer_company_id OR v_media.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A mídia do pedido deve pertencer à empresa compradora e estar obrigatoriamente APROVADA.');
  END IF;

  -- Validar telas ativas
  SELECT COUNT(*) INTO v_screen_count FROM public.screens WHERE company_id = v_order.seller_company_id AND status != 'inactive';
  IF v_screen_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não possui telas ativas cadastradas para veicular a campanha.');
  END IF;

  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = v_order.offer_id;
  v_duration := COALESCE(v_media.playback_duration_seconds, v_offer.duration_seconds, 10);

  -- 1. Criar Campanha Comercial
  INSERT INTO public.campaigns (
    company_id, name, description, campaign_type, status, start_date, end_date,
    target_insertions, buyer_company_id, seller_company_id, ad_offer_order_id,
    credits_contracted, credits_delivered, created_by
  ) VALUES (
    v_order.buyer_company_id, 'Campanha Comercial - ' || v_offer.title,
    'Campanha do Marketplace vinculada ao pedido ' || v_order.id, 'marketplace',
    'active', COALESCE(v_order.requested_start_date, CURRENT_DATE)::text,
    COALESCE(v_order.requested_end_date, CURRENT_DATE + INTERVAL '30 days')::text,
    v_order.credits_amount::integer, v_order.buyer_company_id, v_order.seller_company_id,
    v_order.id, v_order.credits_amount, 0, v_user_id
  ) RETURNING id INTO v_campaign_id;

  -- 2. Vincular mídia e telas
  INSERT INTO public.campaign_media (campaign_id, media_asset_id, playback_duration_seconds, is_active)
  VALUES (v_campaign_id, v_order.requested_media_asset_id, v_duration, TRUE);

  FOR v_screen IN SELECT id FROM public.screens WHERE company_id = v_order.seller_company_id AND status != 'inactive' LOOP
    INSERT INTO public.campaign_screens (campaign_id, screen_id, is_active)
    VALUES (v_campaign_id, v_screen.id, TRUE);
  END LOOP;

  -- 3. Criar Livro de Entrega de Inserções (ad_order_delivery_ledger)
  INSERT INTO public.ad_order_delivery_ledger (
    order_id, campaign_id, seller_company_id, buyer_company_id, credits_contracted,
    credits_delivered, credits_remaining, status
  ) VALUES (
    v_order.id, v_campaign_id, v_order.seller_company_id, v_order.buyer_company_id,
    v_order.credits_amount, 0, v_order.credits_amount, 'active'
  ) RETURNING id INTO v_ledger_id;

  -- 4. CRIAR REGISTRO FINANCEIRO DO EXIBIDOR COM STATUS PENDING_DELIVERY (SELLER_FINANCIAL_LEDGER)
  INSERT INTO public.seller_financial_ledger (
    seller_company_id,
    buyer_company_id,
    ad_offer_order_id,
    campaign_id,
    gross_amount_cents,
    platform_fee_cents,
    seller_net_cents,
    amount_available_cents,
    amount_used_for_discount_cents,
    amount_pending_cents,
    financial_status,
    delivery_status
  ) VALUES (
    v_order.seller_company_id,
    v_order.buyer_company_id,
    v_order.id,
    v_campaign_id,
    v_order.gross_amount_cents,
    v_order.platform_fee_cents,
    v_order.seller_net_cents,
    0, -- Disponível só nasce após entrega concluída
    0,
    v_order.seller_net_cents, -- Todo o líquido nasce pendente de entrega
    'pending_delivery',
    'in_progress'
  ) RETURNING id INTO v_fin_ledger_id;

  -- 5. Atualizar pedido de forma definitiva
  UPDATE public.ad_offer_orders
  SET 
    campaign_id = v_campaign_id,
    status = 'converted_to_campaign',
    updated_at = NOW()
  WHERE id = p_order_id;

  -- 6. Audit Logs
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id, 
    v_order.seller_company_id, 
    'MARKETPLACE_ORDER_CONVERTED_TO_CAMPAIGN', 
    jsonb_build_object('order_id', p_order_id, 'campaign_id', v_campaign_id, 'delivery_ledger_id', v_ledger_id, 'financial_ledger_id', v_fin_ledger_id)
  );

  RETURN jsonb_build_object(
    'success', true, 
    'campaign_id', v_campaign_id, 
    'delivery_ledger_id', v_ledger_id,
    'financial_ledger_id', v_fin_ledger_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. ATUALIZAR PROCESS_COMMERCIAL_CAMPAIGN_DELIVERY PARA PROMOVER SALDO PARA AVAILABLE NA CONCLUSÃO
CREATE OR REPLACE FUNCTION public.process_commercial_campaign_delivery(
  p_campaign_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_campaign RECORD;
  v_ledger RECORD;
  v_log RECORD;
  v_log_credits NUMERIC(12,2);
  v_processed_count INTEGER := 0;
  v_total_credits_delivered NUMERIC(12,2) := 0;
  v_credit_deducted NUMERIC(12,2);
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;

  IF v_campaign.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campanha comercial não encontrada.');
  END IF;

  v_start_ts := COALESCE(v_campaign.start_date::timestamptz, '1970-01-01'::timestamptz);
  v_end_ts := COALESCE((v_campaign.end_date::date + 1)::timestamptz, '2099-12-31'::timestamptz);

  -- Trava pessimista no livro de entrega de inserções
  SELECT * INTO v_ledger 
  FROM public.ad_order_delivery_ledger 
  WHERE campaign_id = p_campaign_id AND status = 'active'
  FOR UPDATE;

  IF v_ledger.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Livro de entregas ativo não encontrado para esta campanha.');
  END IF;

  IF v_ledger.credits_remaining <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Os créditos contratados para esta campanha já foram totalmente entregues.', 'credits_remaining', 0);
  END IF;

  -- Processar logs completed da mídia e telas no período
  FOR v_log IN 
    SELECT pl.* 
    FROM public.playback_logs pl
    JOIN public.campaign_media cm ON cm.media_asset_id = pl.media_asset_id AND cm.campaign_id = p_campaign_id
    WHERE pl.status = 'completed'
      AND pl.screen_id IN (SELECT screen_id FROM public.campaign_screens WHERE campaign_id = p_campaign_id)
      AND pl.played_at >= v_start_ts AND pl.played_at <= v_end_ts
      AND pl.id NOT IN (SELECT playback_log_id FROM public.ad_order_delivery_usage WHERE campaign_id = p_campaign_id)
    ORDER BY pl.played_at ASC
  LOOP
    IF v_ledger.credits_remaining <= 0 THEN
      EXIT;
    END IF;

    CASE COALESCE(v_log.actual_duration_seconds, v_log.planned_duration_seconds, 10)
      WHEN 5 THEN v_log_credits := 0.5;
      WHEN 15 THEN v_log_credits := 1.5;
      WHEN 30 THEN v_log_credits := 3.0;
      ELSE v_log_credits := 1.0;
    END CASE;

    IF v_log_credits > v_ledger.credits_remaining THEN
      v_credit_deducted := v_ledger.credits_remaining;
    ELSE
      v_credit_deducted := v_log_credits;
    END IF;

    INSERT INTO public.ad_order_delivery_usage (
      delivery_ledger_id, playback_log_id, order_id, campaign_id,
      media_asset_id, screen_id, credits_used, status
    ) VALUES (
      v_ledger.id, v_log.id, v_ledger.order_id, p_campaign_id,
      v_log.media_asset_id, v_log.screen_id, v_credit_deducted, 'used'
    );

    v_ledger.credits_delivered := v_ledger.credits_delivered + v_credit_deducted;
    v_ledger.credits_remaining := v_ledger.credits_remaining - v_credit_deducted;
    v_total_credits_delivered := v_total_credits_delivered + v_credit_deducted;
    v_processed_count := v_processed_count + 1;
  END LOOP;

  -- Atualizar livro de entrega
  UPDATE public.ad_order_delivery_ledger
  SET 
    credits_delivered = v_ledger.credits_delivered,
    credits_remaining = v_ledger.credits_remaining,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END,
    updated_at = NOW()
  WHERE id = v_ledger.id;

  -- Atualizar campanha
  UPDATE public.campaigns
  SET 
    credits_delivered = v_ledger.credits_delivered,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE status END,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  -- SE A ENTREGA ATINGIU 100% (STATUS COMPLETED), PROMOVER REGISTRO FINANCEIRO PARA 'AVAILABLE'
  IF v_ledger.credits_remaining <= 0 THEN
    UPDATE public.seller_financial_ledger
    SET 
      financial_status = 'available',
      delivery_status = 'completed',
      amount_available_cents = seller_net_cents - amount_used_for_discount_cents,
      amount_pending_cents = 0,
      updated_at = NOW()
    WHERE campaign_id = p_campaign_id;

    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (
      auth.uid(), 
      v_ledger.seller_company_id, 
      'SELLER_FINANCIAL_STATUS_PROMOTED_AVAILABLE', 
      jsonb_build_object('campaign_id', p_campaign_id, 'order_id', v_ledger.order_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'processed_logs_count', v_processed_count,
    'total_credits_delivered', v_ledger.credits_delivered,
    'credits_remaining', v_ledger.credits_remaining,
    'delivery_status', CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4C: HARDENING FINANCEIRO E ABATIMENTOS
-- Data: 2026-07-31
-- ============================================================================

-- 1. REESCREVER RPC APPLY_SELLER_MONTHLY_DISCOUNT COM TODAS AS TRAVAS DE SEGURANÇA
CREATE OR REPLACE FUNCTION public.apply_seller_monthly_discount(
  p_ledger_id UUID,
  p_amount_cents INTEGER,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_ledger RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_discount_id UUID;
  v_new_available INTEGER;
  v_new_used INTEGER;
  v_new_status TEXT;
BEGIN
  v_user_id := auth.uid();

  -- A. Validar permissão de Master Admin
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (v_user_id, 'MONTHLY_DISCOUNT_UNAUTHORIZED_ATTEMPT', jsonb_build_object('ledger_id', p_ledger_id));

    RETURN jsonb_build_object('success', false, 'error', 'Apenas o Master Admin pode aplicar abatimentos manuais de mensalidade.');
  END IF;

  -- B. Validar motivo obrigatório (não nulo e não vazio)
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (v_user_id, 'MONTHLY_DISCOUNT_EMPTY_REASON_BLOCKED', jsonb_build_object('ledger_id', p_ledger_id));

    RETURN jsonb_build_object('success', false, 'error', 'O motivo do abatimento é obrigatório e deve ter uma justificativa válida.');
  END IF;

  -- C. Validar valor positivo
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor do abatimento deve ser um número positivo de centavos maior que zero.');
  END IF;

  -- D. Trava pessimista no registro financeiro (FOR UPDATE)
  SELECT * INTO v_ledger 
  FROM public.seller_financial_ledger 
  WHERE id = p_ledger_id 
  FOR UPDATE;

  -- E. Validar existência do ledger
  IF v_ledger.id IS NULL THEN
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (v_user_id, 'MONTHLY_DISCOUNT_LEDGER_NOT_FOUND', jsonb_build_object('ledger_id', p_ledger_id));

    RETURN jsonb_build_object('success', false, 'error', 'Registro financeiro do exibidor não encontrado.');
  END IF;

  -- F. Validar status financeiro (Apenas 'available' ou 'partially_used')
  IF v_ledger.financial_status NOT IN ('available', 'partially_used') THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_ledger.seller_company_id, 'MONTHLY_DISCOUNT_INVALID_STATUS_BLOCKED', jsonb_build_object('ledger_id', p_ledger_id, 'current_status', v_ledger.financial_status));

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Abatimentos na mensalidade só podem ser aplicados em registros com saldo liberado e disponível (status available ou partially_used). Status atual: ' || v_ledger.financial_status
    );
  END IF;

  -- G. Validar limite de saldo disponível
  IF p_amount_cents > v_ledger.amount_available_cents THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_ledger.seller_company_id, 'MONTHLY_DISCOUNT_EXCEEDS_BALANCE_BLOCKED', jsonb_build_object('requested_cents', p_amount_cents, 'available_cents', v_ledger.amount_available_cents));

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'O valor do abatimento (R$ ' || (p_amount_cents::numeric / 100)::text || ') excede o saldo disponível do exibidor (R$ ' || (v_ledger.amount_available_cents::numeric / 100)::text || ').'
    );
  END IF;

  -- H. Calcular novos saldos
  v_new_available := v_ledger.amount_available_cents - p_amount_cents;
  v_new_used := v_ledger.amount_used_for_discount_cents + p_amount_cents;

  IF v_new_available = 0 THEN
    v_new_status := 'used_for_discount';
  ELSE
    v_new_status := 'partially_used';
  END IF;

  -- I. Inserir registro de abatimento
  INSERT INTO public.monthly_fee_discounts (
    seller_company_id,
    financial_ledger_id,
    amount_cents,
    reason,
    applied_by,
    status
  ) VALUES (
    v_ledger.seller_company_id,
    v_ledger.id,
    p_amount_cents,
    trim(p_reason),
    v_user_id,
    'applied'
  ) RETURNING id INTO v_discount_id;

  -- J. Atualizar o livro financeiro
  UPDATE public.seller_financial_ledger
  SET 
    amount_available_cents = v_new_available,
    amount_used_for_discount_cents = v_new_used,
    financial_status = v_new_status,
    updated_at = NOW()
  WHERE id = v_ledger.id;

  -- K. Audit Log de Sucesso
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id, 
    v_ledger.seller_company_id, 
    'SELLER_MONTHLY_DISCOUNT_APPLIED', 
    jsonb_build_object(
      'discount_id', v_discount_id,
      'ledger_id', p_ledger_id,
      'amount_cents', p_amount_cents,
      'remaining_available_cents', v_new_available,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'discount_id', v_discount_id,
    'amount_cents', p_amount_cents,
    'remaining_available_cents', v_new_available,
    'financial_status', v_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. REESCREVER PROCESS_COMMERCIAL_CAMPAIGN_DELIVERY GARANTINDO IDEMPOTÊNCIA NA PROMOÇÃO PARA AVAILABLE
CREATE OR REPLACE FUNCTION public.process_commercial_campaign_delivery(
  p_campaign_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_campaign RECORD;
  v_ledger RECORD;
  v_log RECORD;
  v_fin_ledger RECORD;
  v_log_credits NUMERIC(12,2);
  v_processed_count INTEGER := 0;
  v_total_credits_delivered NUMERIC(12,2) := 0;
  v_credit_deducted NUMERIC(12,2);
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;

  IF v_campaign.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campanha comercial não encontrada.');
  END IF;

  v_start_ts := COALESCE(v_campaign.start_date::timestamptz, '1970-01-01'::timestamptz);
  v_end_ts := COALESCE((v_campaign.end_date::date + 1)::timestamptz, '2099-12-31'::timestamptz);

  -- Trava pessimista no livro de entrega de inserções
  SELECT * INTO v_ledger 
  FROM public.ad_order_delivery_ledger 
  WHERE campaign_id = p_campaign_id AND status = 'active'
  FOR UPDATE;

  IF v_ledger.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Livro de entregas ativo não encontrado para esta campanha.');
  END IF;

  IF v_ledger.credits_remaining <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Os créditos contratados para esta campanha já foram totalmente entregues.', 'credits_remaining', 0);
  END IF;

  -- Processar logs completed da mídia e telas no período
  FOR v_log IN 
    SELECT pl.* 
    FROM public.playback_logs pl
    JOIN public.campaign_media cm ON cm.media_asset_id = pl.media_asset_id AND cm.campaign_id = p_campaign_id
    WHERE pl.status = 'completed'
      AND pl.screen_id IN (SELECT screen_id FROM public.campaign_screens WHERE campaign_id = p_campaign_id)
      AND pl.played_at >= v_start_ts AND pl.played_at <= v_end_ts
      AND pl.id NOT IN (SELECT playback_log_id FROM public.ad_order_delivery_usage WHERE campaign_id = p_campaign_id)
    ORDER BY pl.played_at ASC
  LOOP
    IF v_ledger.credits_remaining <= 0 THEN
      EXIT;
    END IF;

    CASE COALESCE(v_log.actual_duration_seconds, v_log.planned_duration_seconds, 10)
      WHEN 5 THEN v_log_credits := 0.5;
      WHEN 15 THEN v_log_credits := 1.5;
      WHEN 30 THEN v_log_credits := 3.0;
      ELSE v_log_credits := 1.0;
    END CASE;

    IF v_log_credits > v_ledger.credits_remaining THEN
      v_credit_deducted := v_ledger.credits_remaining;
    ELSE
      v_credit_deducted := v_log_credits;
    END IF;

    INSERT INTO public.ad_order_delivery_usage (
      delivery_ledger_id, playback_log_id, order_id, campaign_id,
      media_asset_id, screen_id, credits_used, status
    ) VALUES (
      v_ledger.id, v_log.id, v_ledger.order_id, p_campaign_id,
      v_log.media_asset_id, v_log.screen_id, v_credit_deducted, 'used'
    );

    v_ledger.credits_delivered := v_ledger.credits_delivered + v_credit_deducted;
    v_ledger.credits_remaining := v_ledger.credits_remaining - v_credit_deducted;
    v_total_credits_delivered := v_total_credits_delivered + v_credit_deducted;
    v_processed_count := v_processed_count + 1;
  END LOOP;

  -- Atualizar livro de entrega
  UPDATE public.ad_order_delivery_ledger
  SET 
    credits_delivered = v_ledger.credits_delivered,
    credits_remaining = v_ledger.credits_remaining,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END,
    updated_at = NOW()
  WHERE id = v_ledger.id;

  -- Atualizar campanha
  UPDATE public.campaigns
  SET 
    credits_delivered = v_ledger.credits_delivered,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE status END,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  -- PROMOÇÃO IDEMPOTENTE DO REGISTRO FINANCEIRO PARA AVAILABLE
  -- Ocorre APENAS se a entrega zerou E se o registro ainda estiver como 'pending_delivery'
  IF v_ledger.credits_remaining <= 0 THEN
    SELECT * INTO v_fin_ledger 
    FROM public.seller_financial_ledger 
    WHERE campaign_id = p_campaign_id
    FOR UPDATE;

    IF v_fin_ledger.id IS NOT NULL AND v_fin_ledger.financial_status = 'pending_delivery' THEN
      UPDATE public.seller_financial_ledger
      SET 
        financial_status = 'available',
        delivery_status = 'completed',
        amount_available_cents = seller_net_cents - amount_used_for_discount_cents,
        amount_pending_cents = 0,
        updated_at = NOW()
      WHERE id = v_fin_ledger.id;

      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (
        auth.uid(), 
        v_ledger.seller_company_id, 
        'SELLER_FINANCIAL_STATUS_PROMOTED_AVAILABLE', 
        jsonb_build_object('campaign_id', p_campaign_id, 'order_id', v_ledger.order_id)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'processed_logs_count', v_processed_count,
    'total_credits_delivered', v_ledger.credits_delivered,
    'credits_remaining', v_ledger.credits_remaining,
    'delivery_status', CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4D: TERMOS COMERCIAIS E ACEITE
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE TERMOS E CONDIÇÕES DA PLATAFORMA (PLATFORM_TERMS)
CREATE TABLE IF NOT EXISTS public.platform_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_type TEXT NOT NULL CHECK (term_type IN ('general_terms', 'network_participation', 'media_policy', 'advertiser_terms', 'display_partner_terms', 'financial_discount_policy', 'marketplace_terms')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT platform_terms_type_version_unique UNIQUE (term_type, version)
);

CREATE INDEX IF NOT EXISTS idx_platform_terms_type ON public.platform_terms(term_type);

-- 2. TABELA DE REGISTRO HISTÓRICO IMUTÁVEL DE ACEITES POR EMPRESA (COMPANY_TERM_ACCEPTANCES)
CREATE TABLE IF NOT EXISTS public.company_term_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES public.platform_terms(id) ON DELETE CASCADE,
  accepted_by UUID NOT NULL REFERENCES public.profiles(id),
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  acceptance_context TEXT DEFAULT 'onboarding' CHECK (acceptance_context IN ('onboarding', 'network_settings', 'create_ad_offer', 'marketplace_request', 'approve_media_request', 'convert_to_campaign', 'financial_discount')),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT company_term_unique UNIQUE (company_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_acceptances_company ON public.company_term_acceptances(company_id);
CREATE INDEX IF NOT EXISTS idx_acceptances_term ON public.company_term_acceptances(term_id);

-- 3. HABILITAR ROW LEVEL SECURITY (RLS) MULTIEMPRESA
ALTER TABLE public.platform_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_term_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PlatformTerms - Leitura por usuários autenticados" ON public.platform_terms;
CREATE POLICY "PlatformTerms - Leitura por usuários autenticados"
  ON public.platform_terms FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "PlatformTerms - Gestão por Master Admin" ON public.platform_terms;
CREATE POLICY "PlatformTerms - Gestão por Master Admin"
  ON public.platform_terms FOR ALL TO authenticated USING (is_master_admin());

DROP POLICY IF EXISTS "CompanyTermAcceptances - Leitura por empresa ou Master Admin" ON public.company_term_acceptances;
CREATE POLICY "CompanyTermAcceptances - Leitura por empresa ou Master Admin"
  ON public.company_term_acceptances FOR SELECT TO authenticated
  USING (
    is_master_admin() OR
    company_id IN (SELECT public.get_user_company_ids())
  );

-- 4. RPC TRANSACIONAL PARA REGISTRAR ACEITE DE TERMO (ACCEPT_PLATFORM_TERM)
CREATE OR REPLACE FUNCTION public.accept_platform_term(
  p_company_id UUID,
  p_term_id UUID,
  p_acceptance_context TEXT DEFAULT 'onboarding',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_term RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_company_admin BOOLEAN;
  v_acceptance_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- A. Validar se o usuário é Admin da empresa ou Master Admin
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = p_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_company_admin;

    IF NOT v_is_company_admin THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_company_id, 'TERM_ACCEPTANCE_UNAUTHORIZED_ATTEMPT', jsonb_build_object('term_id', p_term_id));

      RETURN jsonb_build_object('success', false, 'error', 'Apenas Administradores da empresa ou Master Admin podem formalizar o aceite de termos.');
    END IF;
  END IF;

  -- B. Validar se o termo existe e está ativo
  SELECT * INTO v_term FROM public.platform_terms WHERE id = p_term_id;
  IF v_term.id IS NULL OR v_term.is_active = FALSE THEN
    RETURN jsonb_build_object('success', false, 'error', 'O termo de uso solicitado não existe ou foi desativado.');
  END IF;

  -- C. Impedir duplicidade de aceite para a mesma versão do termo
  IF EXISTS (SELECT 1 FROM public.company_term_acceptances WHERE company_id = p_company_id AND term_id = p_term_id) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Esta versão do termo já foi aceita anteriormente pela empresa.', 'already_accepted', true);
  END IF;

  -- D. Inserir aceite histórico
  INSERT INTO public.company_term_acceptances (
    company_id,
    term_id,
    accepted_by,
    acceptance_context,
    ip_address,
    user_agent
  ) VALUES (
    p_company_id,
    p_term_id,
    v_user_id,
    COALESCE(p_acceptance_context, 'onboarding'),
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_acceptance_id;

  -- E. Registrar em Audit Logs
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id, 
    p_company_id, 
    'COMPANY_TERM_ACCEPTED', 
    jsonb_build_object(
      'acceptance_id', v_acceptance_id,
      'term_id', p_term_id,
      'term_type', v_term.term_type,
      'version', v_term.version,
      'context', p_acceptance_context
    )
  );

  RETURN jsonb_build_object(
    'success', true, 
    'acceptance_id', v_acceptance_id, 
    'term_type', v_term.term_type,
    'version', v_term.version
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. RPC PARA VERIFICAR TERMOS PENDENTES DE UMA EMPRESA (CHECK_COMPANY_REQUIRED_TERMS)
CREATE OR REPLACE FUNCTION public.check_company_required_terms(
  p_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_pending JSONB;
  v_compliant BOOLEAN;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'term_id', pt.id,
        'term_type', pt.term_type,
        'version', pt.version,
        'title', pt.title,
        'content', pt.content
      )
    ),
    '[]'::jsonb
  ) INTO v_pending
  FROM public.platform_terms pt
  WHERE pt.is_active = TRUE
    AND pt.id NOT IN (
      SELECT term_id FROM public.company_term_acceptances WHERE company_id = p_company_id
    );

  v_compliant := (jsonb_array_length(v_pending) = 0);

  RETURN jsonb_build_object(
    'compliant', v_compliant,
    'pending_terms_count', jsonb_array_length(v_pending),
    'pending_terms', v_pending
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. POPULAR TERMOS ATIVOS INICIAIS PADRÃO (VERSÃO 1)
INSERT INTO public.platform_terms (term_type, version, title, content, is_active)
VALUES
  (
    'general_terms', 1, 
    'Termos Gerais de Uso da Rede Indoor Local', 
    'Esta plataforma destina-se ao gerenciamento de redes de sinalização digital e marketplace interno de mídias entre empresas parceiras. As empresas concordam em agir de boa-fé e respeitar as diretrizes da rede.', 
    TRUE
  ),
  (
    'network_participation', 1, 
    'Regras de Participação na Rede Colaborativa', 
    'As empresas que cedem capacidade de suas TVs para a rede concordam que suas telas veicularão conteúdos de empresas parceiras mediante créditos ou inventários de permuta acordados.', 
    TRUE
  ),
  (
    'media_policy', 1, 
    'Política de Conteúdo e Responsabilidade de Mídia', 
    'A empresa anunciante é 100% responsável pelo conteúdo e pelos direitos autorais das imagens e vídeos enviados. É estritamente proibido conteúdo impróprio, difamatório ou ilegal.', 
    TRUE
  ),
  (
    'marketplace_terms', 1, 
    'Termos Comerciais do Marketplace Interno', 
    'A veiculação de ofertas comerciais e pacotes de mídia entre empresas do marketplace é mensurada via Proof of Play. O saldo gerado pelas entregas concluídas pode ser utilizado para abatimento na mensalidade da plataforma.', 
    TRUE
  )
ON CONFLICT (term_type, version) DO NOTHING;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4D: HARDENING DE TERMOS E CONFORMIDADE
-- Data: 2026-07-31
-- ============================================================================

-- 1. PROTEÇÃO DE PERMISSÃO NA RPC CHECK_COMPANY_REQUIRED_TERMS
CREATE OR REPLACE FUNCTION public.check_company_required_terms(
  p_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_has_access BOOLEAN;
  v_pending JSONB;
  v_compliant BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  -- Validar se o usuário é Master Admin ou pertence à empresa
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = p_company_id AND user_id = v_user_id AND is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_company_id, 'CHECK_REQUIRED_TERMS_UNAUTHORIZED_ATTEMPT', jsonb_build_object('company_id', p_company_id));

      RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado para consultar termos desta empresa.');
    END IF;
  END IF;

  -- Buscar apenas termos ativos vigentes ainda não aceitos pela empresa
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'term_id', pt.id,
        'term_type', pt.term_type,
        'version', pt.version,
        'title', pt.title,
        'content', pt.content
      )
    ),
    '[]'::jsonb
  ) INTO v_pending
  FROM public.platform_terms pt
  WHERE pt.is_active = TRUE
    AND pt.id NOT IN (
      SELECT term_id FROM public.company_term_acceptances WHERE company_id = p_company_id
    );

  v_compliant := (jsonb_array_length(v_pending) = 0);

  RETURN jsonb_build_object(
    'success', true,
    'compliant', v_compliant,
    'pending_terms_count', jsonb_array_length(v_pending),
    'pending_terms', v_pending
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. TRIGGER PARA DESATIVAR VERSÕES ANTERIORES DO MESMO TERM_TYPE AO ATIVAR UM TERMO
CREATE OR REPLACE FUNCTION public.trg_enforce_single_active_term_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE public.platform_terms
    SET is_active = FALSE, updated_at = NOW()
    WHERE term_type = NEW.term_type AND id <> NEW.id AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_single_active_term_version ON public.platform_terms;
CREATE TRIGGER trg_single_active_term_version
  BEFORE INSERT OR UPDATE OF is_active ON public.platform_terms
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE)
  EXECUTE FUNCTION public.trg_enforce_single_active_term_version();

-- 3. TRIGGER DE IMUTABILIDADE REAL EM COMPANY_TERM_ACCEPTANCES (BLOQUEIA UPDATE E DELETE)
CREATE OR REPLACE FUNCTION public.trg_prevent_company_term_acceptances_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Registros de aceite de termos de uso são históricos e imutáveis. Alterações ou exclusões são estritamente proibidas.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_company_term_acceptances_immutable ON public.company_term_acceptances;
CREATE TRIGGER trg_company_term_acceptances_immutable
  BEFORE UPDATE OR DELETE ON public.company_term_acceptances
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_company_term_acceptances_mutation();
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4D: INTEGRAÇÃO E RETENÇÃO DE REGRAS 4A, 4B E 4C
-- Data: 2026-07-31
-- ============================================================================

-- 1. RPC APPROVE_MARKETPLACE_MEDIA_REQUEST (REGRAS 4A + TRAVA DE TERMOS 4D)
CREATE OR REPLACE FUNCTION public.approve_marketplace_media_request(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
  v_compliance JSONB;
BEGIN
  v_user_id := auth.uid();

  -- Trava pessimista no pedido
  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id FOR UPDATE;

  -- Validação 1: Pedido existe
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de mídia não encontrada.');
  END IF;

  -- Validação 2: Pedido está pendente de aprovação
  IF v_order.approval_status <> 'pending_approval' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status pending_approval podem ser aprovadas.');
  END IF;

  -- Validação 3: Usuário é Admin da exibidora ou Master Admin (Impede aprovação pelo comprador)
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, v_order.seller_company_id, 'MEDIA_REQUEST_APPROVAL_UNAUTHORIZED_ATTEMPT', jsonb_build_object('order_id', p_order_id));

      RETURN jsonb_build_object('success', false, 'error', 'Apenas Administradores da empresa exibidora ou Master Admin podem aprovar a solicitação.');
    END IF;
  END IF;

  -- Validação 4: Trava de conformidade de termos da empresa exibidora
  v_compliance := public.check_company_required_terms(v_order.seller_company_id);
  IF (v_compliance->>'compliant')::boolean = FALSE THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'MEDIA_REQUEST_APPROVAL_BLOCKED_PENDING_TERMS', jsonb_build_object('order_id', p_order_id));

    RETURN jsonb_build_object('success', false, 'error', 'Existem termos comerciais pendentes de aceite antes de continuar.');
  END IF;

  -- Atualizar status do pedido para aprovado
  UPDATE public.ad_offer_orders
  SET 
    approval_status = 'approved',
    status = 'approved',
    approved_by = v_user_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Audit log de sucesso
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id, 
    v_order.seller_company_id, 
    'MARKETPLACE_MEDIA_REQUEST_APPROVED', 
    jsonb_build_object('order_id', p_order_id, 'buyer_company_id', v_order.buyer_company_id)
  );

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'approval_status', 'approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. RPC CONVERT_AD_OFFER_ORDER_TO_CAMPAIGN (REGRAS 4B + 4C + TRAVA DE TERMOS 4D)
CREATE OR REPLACE FUNCTION public.convert_ad_offer_order_to_campaign(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
  v_campaign_id UUID;
  v_start_date DATE;
  v_end_date DATE;
  v_media RECORD;
  v_prefs RECORD;
  v_screen_count INTEGER := 0;
  v_seller_compliance JSONB;
  v_buyer_compliance JSONB;
BEGIN
  v_user_id := auth.uid();

  -- Validação 1: Trava pessimista no pedido
  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id FOR UPDATE;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido de oferta não encontrado.');
  END IF;

  -- Validação 2: Usuário deve ser Admin da exibidora ou Master Admin
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Administradores da empresa exibidora ou Master Admin podem converter o pedido em campanha.');
    END IF;
  END IF;

  -- Validação 3: Pedido deve estar pago manualmente e não ter sido convertido anteriormente
  IF v_order.payment_status <> 'paid_manual' AND v_order.status <> 'paid_manual' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas pedidos com pagamento confirmado (paid_manual) podem ser convertidos em campanha comercial.');
  END IF;

  IF v_order.status = 'converted_to_campaign' OR v_order.campaign_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi convertido em uma campanha comercial anteriormente.', 'campaign_id', v_order.campaign_id);
  END IF;

  -- Validação 4: Conformidade de termos da empresa exibidora (Seller)
  v_seller_compliance := public.check_company_required_terms(v_order.seller_company_id);
  IF (v_seller_compliance->>'compliant')::boolean = FALSE THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'CAMPAIGN_CONVERSION_BLOCKED_SELLER_PENDING_TERMS', jsonb_build_object('order_id', p_order_id));

    RETURN jsonb_build_object('success', false, 'error', 'Existem termos comerciais pendentes de aceite antes de continuar.');
  END IF;

  -- Validação 5: Conformidade de termos da empresa anunciante (Buyer)
  IF v_order.buyer_company_id IS NOT NULL THEN
    v_buyer_compliance := public.check_company_required_terms(v_order.buyer_company_id);
    IF (v_buyer_compliance->>'compliant')::boolean = FALSE THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, v_order.buyer_company_id, 'CAMPAIGN_CONVERSION_BLOCKED_BUYER_PENDING_TERMS', jsonb_build_object('order_id', p_order_id));

      RETURN jsonb_build_object('success', false, 'error', 'Existem termos comerciais pendentes de aceite antes de continuar.');
    END IF;
  END IF;

  -- Validação 6: Mídia solicitada existe, pertence à compradora e está aprovada (MVP 4B audit item 1)
  IF v_order.requested_media_asset_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'O pedido não possui uma mídia solicitada vinculada.');
  END IF;

  SELECT * INTO v_media FROM public.media_assets WHERE id = v_order.requested_media_asset_id;
  IF v_media.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A mídia solicitada no pedido não existe.');
  END IF;

  IF v_order.buyer_company_id IS NOT NULL AND v_media.company_id <> v_order.buyer_company_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'A mídia vinculada não pertence à empresa compradora contratante.');
  END IF;

  IF v_media.status <> 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas mídias com status aprovado podem virar campanha comercial. Status atual: ' || v_media.status);
  END IF;

  -- Validação 7: Preferências e bloqueios da exibidora (MVP 4B audit item 4)
  SELECT * INTO v_prefs FROM public.company_network_preferences WHERE company_id = v_order.seller_company_id;
  IF v_prefs.company_id IS NOT NULL THEN
    IF v_prefs.accepts_network_ads = FALSE THEN
      RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora desativou o recebimento de anúncios externos da rede.');
    END IF;

    IF v_order.buyer_company_id IS NOT NULL AND v_prefs.blocked_companies IS NOT NULL AND v_order.buyer_company_id = ANY(v_prefs.blocked_companies) THEN
      RETURN jsonb_build_object('success', false, 'error', 'A empresa compradora está bloqueada na lista de preferências da exibidora.');
    END IF;
  END IF;

  -- Validação 8: Exibidora possui telas ativas
  SELECT COUNT(*) INTO v_screen_count FROM public.screens WHERE company_id = v_order.seller_company_id AND status IN ('online', 'pending_pairing');
  IF v_screen_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não possui telas ativas cadastradas para veicular a campanha.');
  END IF;

  v_start_date := COALESCE(v_order.requested_start_date::date, CURRENT_DATE);
  v_end_date := COALESCE(v_order.requested_end_date::date, CURRENT_DATE + INTERVAL '30 days');

  -- Execução A: Criar a Campanha Comercial
  INSERT INTO public.campaigns (
    company_id,
    name,
    description,
    campaign_type,
    status,
    start_date,
    end_date,
    target_insertions,
    delivered_insertions,
    buyer_company_id,
    seller_company_id,
    ad_offer_order_id,
    credits_contracted,
    credits_delivered,
    created_by
  ) VALUES (
    v_order.seller_company_id,
    'Campanha Marketplace: ' || COALESCE(v_order.buyer_name, 'Anunciante'),
    'Campanha gerada a partir do pedido de oferta ' || v_order.id,
    'commercial',
    'active',
    v_start_date::text,
    v_end_date::text,
    v_order.credits_amount,
    0,
    v_order.buyer_company_id,
    v_order.seller_company_id,
    v_order.id,
    v_order.credits_amount,
    0,
    v_user_id
  ) RETURNING id INTO v_campaign_id;

  -- Execução B: Vincular a Mídia Aprovada
  INSERT INTO public.campaign_media (campaign_id, media_asset_id, playback_duration_seconds, is_active)
  VALUES (v_campaign_id, v_media.id, COALESCE(v_media.playback_duration_seconds, 10), TRUE);

  -- Execução C: Vincular as Telas Ativas da Exibidora
  INSERT INTO public.campaign_screens (campaign_id, screen_id, is_active)
  SELECT v_campaign_id, s.id, TRUE
  FROM public.screens s
  WHERE s.company_id = v_order.seller_company_id AND s.status IN ('online', 'pending_pairing');

  -- Execução D: Criar Livro de Entrega de Inserções (ad_order_delivery_ledger)
  INSERT INTO public.ad_order_delivery_ledger (
    order_id,
    campaign_id,
    seller_company_id,
    buyer_company_id,
    credits_contracted,
    credits_delivered,
    credits_remaining,
    status
  ) VALUES (
    v_order.id,
    v_campaign_id,
    v_order.seller_company_id,
    COALESCE(v_order.buyer_company_id, v_order.seller_company_id),
    v_order.credits_amount,
    0,
    v_order.credits_amount,
    'active'
  );

  -- Execução E: Criar Livro Financeiro do Exibidor (seller_financial_ledger) com status pending_delivery (MVP 4C)
  INSERT INTO public.seller_financial_ledger (
    seller_company_id,
    buyer_company_id,
    ad_offer_order_id,
    campaign_id,
    gross_amount_cents,
    platform_fee_cents,
    seller_net_cents,
    amount_available_cents,
    amount_used_for_discount_cents,
    amount_pending_cents,
    financial_status,
    delivery_status
  ) VALUES (
    v_order.seller_company_id,
    v_order.buyer_company_id,
    v_order.id,
    v_campaign_id,
    v_order.gross_amount_cents,
    v_order.platform_fee_cents,
    v_order.seller_net_cents,
    0,
    0,
    v_order.seller_net_cents,
    'pending_delivery',
    'in_progress'
  )
  ON CONFLICT (ad_offer_order_id) DO NOTHING;

  -- Execução F: Atualizar pedido para status convertido
  UPDATE public.ad_offer_orders
  SET 
    status = 'converted_to_campaign',
    campaign_id = v_campaign_id,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Audit Log de Sucesso
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id,
    v_order.seller_company_id,
    'AD_OFFER_ORDER_CONVERTED_TO_CAMPAIGN',
    jsonb_build_object(
      'order_id', p_order_id,
      'campaign_id', v_campaign_id,
      'buyer_company_id', v_order.buyer_company_id,
      'credits_contracted', v_order.credits_amount,
      'assigned_screens_count', v_screen_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'campaign_id', v_campaign_id,
    'assigned_screens_count', v_screen_count,
    'status', 'converted_to_campaign'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5A: INTEGRAÇÃO ASAAS PARA COBRANÇA E BAIXA
-- Data: 2026-07-31
-- ============================================================================

-- 1. ADICIONAR CAMPOS DE PAGAMENTO E RASTREIO ASAAS EM AD_OFFER_ORDERS
ALTER TABLE public.ad_offer_orders
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_bank_slip_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS asaas_pix_copy_paste TEXT,
  ADD COLUMN IF NOT EXISTS payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_webhook_last_event TEXT,
  ADD COLUMN IF NOT EXISTS payment_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_asaas_payment_id ON public.ad_offer_orders(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_asaas_customer_id ON public.ad_offer_orders(asaas_customer_id);

-- 2. TABELA DE REGISTRO E IDEMPOTÊNCIA DE EVENTOS WEBHOOK ASAAS (ASAAS_PAYMENT_EVENTS)
CREATE TABLE IF NOT EXISTS public.asaas_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_idempotency_key TEXT NOT NULL UNIQUE,
  asaas_event_id TEXT,
  asaas_payment_id TEXT NOT NULL,
  ad_offer_order_id UUID REFERENCES public.ad_offer_orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'processed' CHECK (processing_status IN ('processed', 'duplicate_ignored', 'failed', 'ignored')),
  error_message TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asaas_events_payment_id ON public.asaas_payment_events(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_asaas_events_order_id ON public.asaas_payment_events(ad_offer_order_id);

-- Habilitar RLS em asaas_payment_events
ALTER TABLE public.asaas_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AsaasPaymentEvents - Leitura por Master Admin" ON public.asaas_payment_events;
CREATE POLICY "AsaasPaymentEvents - Leitura por Master Admin"
  ON public.asaas_payment_events FOR SELECT TO authenticated
  USING (is_master_admin());

-- 3. ATUALIZAR CONVERT_AD_OFFER_ORDER_TO_CAMPAIGN ACEITANDO PAID_ASAAS
CREATE OR REPLACE FUNCTION public.convert_ad_offer_order_to_campaign(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
  v_campaign_id UUID;
  v_start_date DATE;
  v_end_date DATE;
  v_media RECORD;
  v_prefs RECORD;
  v_screen_count INTEGER := 0;
  v_seller_compliance JSONB;
  v_buyer_compliance JSONB;
BEGIN
  v_user_id := auth.uid();

  -- Validação 1: Trava pessimista no pedido
  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id FOR UPDATE;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido de oferta não encontrado.');
  END IF;

  -- Validação 2: Usuário deve ser Admin da exibidora ou Master Admin
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Administradores da empresa exibidora ou Master Admin podem converter o pedido em campanha.');
    END IF;
  END IF;

  -- Validação 3: Pedido deve estar pago (paid_manual ou paid_asaas)
  IF v_order.payment_status NOT IN ('paid_manual', 'paid_asaas') AND v_order.status NOT IN ('paid_manual', 'paid_asaas') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas pedidos com pagamento confirmado (paid_manual ou paid_asaas) podem ser convertidos em campanha comercial.');
  END IF;

  IF v_order.status = 'converted_to_campaign' OR v_order.campaign_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi convertido em uma campanha comercial anteriormente.', 'campaign_id', v_order.campaign_id);
  END IF;

  -- Validação 4: Conformidade de termos da empresa exibidora (Seller)
  v_seller_compliance := public.check_company_required_terms(v_order.seller_company_id);
  IF (v_seller_compliance->>'compliant')::boolean = FALSE THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'CAMPAIGN_CONVERSION_BLOCKED_SELLER_PENDING_TERMS', jsonb_build_object('order_id', p_order_id));

    RETURN jsonb_build_object('success', false, 'error', 'Existem termos comerciais pendentes de aceite antes de continuar.');
  END IF;

  -- Validação 5: Conformidade de termos da empresa anunciante (Buyer)
  IF v_order.buyer_company_id IS NOT NULL THEN
    v_buyer_compliance := public.check_company_required_terms(v_order.buyer_company_id);
    IF (v_buyer_compliance->>'compliant')::boolean = FALSE THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, v_order.buyer_company_id, 'CAMPAIGN_CONVERSION_BLOCKED_BUYER_PENDING_TERMS', jsonb_build_object('order_id', p_order_id));

      RETURN jsonb_build_object('success', false, 'error', 'Existem termos comerciais pendentes de aceite antes de continuar.');
    END IF;
  END IF;

  -- Validação 6: Mídia solicitada existe, pertence à compradora e está aprovada
  IF v_order.requested_media_asset_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'O pedido não possui uma mídia solicitada vinculada.');
  END IF;

  SELECT * INTO v_media FROM public.media_assets WHERE id = v_order.requested_media_asset_id;
  IF v_media.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A mídia solicitada no pedido não existe.');
  END IF;

  IF v_order.buyer_company_id IS NOT NULL AND v_media.company_id <> v_order.buyer_company_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'A mídia vinculada não pertence à empresa compradora contratante.');
  END IF;

  IF v_media.status <> 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas mídias com status aprovado podem virar campanha comercial. Status atual: ' || v_media.status);
  END IF;

  -- Validação 7: Preferências e bloqueios da exibidora
  SELECT * INTO v_prefs FROM public.company_network_preferences WHERE company_id = v_order.seller_company_id;
  IF v_prefs.company_id IS NOT NULL THEN
    IF v_prefs.accepts_network_ads = FALSE THEN
      RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora desativou o recebimento de anúncios externos da rede.');
    END IF;

    IF v_order.buyer_company_id IS NOT NULL AND v_prefs.blocked_companies IS NOT NULL AND v_order.buyer_company_id = ANY(v_prefs.blocked_companies) THEN
      RETURN jsonb_build_object('success', false, 'error', 'A empresa compradora está bloqueada na lista de preferências da exibidora.');
    END IF;
  END IF;

  -- Validação 8: Exibidora possui telas ativas
  SELECT COUNT(*) INTO v_screen_count FROM public.screens WHERE company_id = v_order.seller_company_id AND status IN ('online', 'pending_pairing');
  IF v_screen_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não possui telas ativas cadastradas para veicular a campanha.');
  END IF;

  v_start_date := COALESCE(v_order.requested_start_date::date, CURRENT_DATE);
  v_end_date := COALESCE(v_order.requested_end_date::date, CURRENT_DATE + INTERVAL '30 days');

  -- Execução A: Criar a Campanha Comercial
  INSERT INTO public.campaigns (
    company_id,
    name,
    description,
    campaign_type,
    status,
    start_date,
    end_date,
    target_insertions,
    delivered_insertions,
    buyer_company_id,
    seller_company_id,
    ad_offer_order_id,
    credits_contracted,
    credits_delivered,
    created_by
  ) VALUES (
    v_order.seller_company_id,
    'Campanha Marketplace: ' || COALESCE(v_order.buyer_name, 'Anunciante'),
    'Campanha gerada a partir do pedido de oferta ' || v_order.id,
    'commercial',
    'active',
    v_start_date::text,
    v_end_date::text,
    v_order.credits_amount,
    0,
    v_order.buyer_company_id,
    v_order.seller_company_id,
    v_order.id,
    v_order.credits_amount,
    0,
    v_user_id
  ) RETURNING id INTO v_campaign_id;

  -- Execução B: Vincular a Mídia Aprovada
  INSERT INTO public.campaign_media (campaign_id, media_asset_id, playback_duration_seconds, is_active)
  VALUES (v_campaign_id, v_media.id, COALESCE(v_media.playback_duration_seconds, 10), TRUE);

  -- Execução C: Vincular as Telas Ativas da Exibidora
  INSERT INTO public.campaign_screens (campaign_id, screen_id, is_active)
  SELECT v_campaign_id, s.id, TRUE
  FROM public.screens s
  WHERE s.company_id = v_order.seller_company_id AND s.status IN ('online', 'pending_pairing');

  -- Execução D: Criar Livro de Entrega de Inserções (ad_order_delivery_ledger)
  INSERT INTO public.ad_order_delivery_ledger (
    order_id,
    campaign_id,
    seller_company_id,
    buyer_company_id,
    credits_contracted,
    credits_delivered,
    credits_remaining,
    status
  ) VALUES (
    v_order.id,
    v_campaign_id,
    v_order.seller_company_id,
    COALESCE(v_order.buyer_company_id, v_order.seller_company_id),
    v_order.credits_amount,
    0,
    v_order.credits_amount,
    'active'
  );

  -- Execução E: Criar Livro Financeiro do Exibidor (seller_financial_ledger) com status pending_delivery
  INSERT INTO public.seller_financial_ledger (
    seller_company_id,
    buyer_company_id,
    ad_offer_order_id,
    campaign_id,
    gross_amount_cents,
    platform_fee_cents,
    seller_net_cents,
    amount_available_cents,
    amount_used_for_discount_cents,
    amount_pending_cents,
    financial_status,
    delivery_status
  ) VALUES (
    v_order.seller_company_id,
    v_order.buyer_company_id,
    v_order.id,
    v_campaign_id,
    v_order.gross_amount_cents,
    v_order.platform_fee_cents,
    v_order.seller_net_cents,
    0,
    0,
    v_order.seller_net_cents,
    'pending_delivery',
    'in_progress'
  )
  ON CONFLICT (ad_offer_order_id) DO NOTHING;

  -- Execução F: Atualizar pedido para status convertido
  UPDATE public.ad_offer_orders
  SET 
    status = 'converted_to_campaign',
    campaign_id = v_campaign_id,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Audit Log de Sucesso
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id,
    v_order.seller_company_id,
    'AD_OFFER_ORDER_CONVERTED_TO_CAMPAIGN',
    jsonb_build_object(
      'order_id', p_order_id,
      'campaign_id', v_campaign_id,
      'buyer_company_id', v_order.buyer_company_id,
      'credits_contracted', v_order.credits_amount,
      'assigned_screens_count', v_screen_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'campaign_id', v_campaign_id,
    'assigned_screens_count', v_screen_count,
    'status', 'converted_to_campaign'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5A: HARDENING ASAAS E ÍNDICE ÚNICO
-- Data: 2026-07-31
-- ============================================================================

-- 1. ADICIONAR ÍNDICE ÚNICO PARCIAL EM AD_OFFER_ORDERS (ASAAS_PAYMENT_ID)
-- Impede que dois pedidos distintos fiquem associados à mesma cobrança no Asaas
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_asaas_payment_id_unique 
ON public.ad_offer_orders(asaas_payment_id) 
WHERE asaas_payment_id IS NOT NULL;
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5B: REVISÃO E CONCILIAÇÃO ASAAS
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE REVISÕES CONTÁBEIS E ALERTAS (ASAAS_RECONCILIATION_REVIEWS)
CREATE TABLE IF NOT EXISTS public.asaas_reconciliation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_payment_event_id UUID REFERENCES public.asaas_payment_events(id) ON DELETE SET NULL,
  ad_offer_order_id UUID REFERENCES public.ad_offer_orders(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'reviewed', 'ignored', 'resolved')),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconcil_event_id ON public.asaas_reconciliation_reviews(asaas_payment_event_id);
CREATE INDEX IF NOT EXISTS idx_reconcil_order_id ON public.asaas_reconciliation_reviews(ad_offer_order_id);

-- 2. HABILITAR RLS COM ACESSO EXCLUSIVO PARA MASTER ADMIN
ALTER TABLE public.asaas_reconciliation_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AsaasReconciliationReviews - Acesso Exclusivo Master Admin" ON public.asaas_reconciliation_reviews;
CREATE POLICY "AsaasReconciliationReviews - Acesso Exclusivo Master Admin"
  ON public.asaas_reconciliation_reviews FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());
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
DROP POLICY IF EXISTS "SellerProfiles - Master Admin Full Access" ON public.seller_financial_profiles;
CREATE POLICY "SellerProfiles - Master Admin Full Access"
  ON public.seller_financial_profiles FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

-- Politica: Membro da Empresa Leitura dos Próprios Dados
DROP POLICY IF EXISTS "SellerProfiles - Company Member Read" ON public.seller_financial_profiles;
CREATE POLICY "SellerProfiles - Company Member Read"
  ON public.seller_financial_profiles FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids()));

-- Politica: Admin da Empresa Criação do Próprio Perfil
DROP POLICY IF EXISTS "SellerProfiles - Company Admin Insert" ON public.seller_financial_profiles;
CREATE POLICY "SellerProfiles - Company Admin Insert"
  ON public.seller_financial_profiles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_id = seller_financial_profiles.company_id AND user_id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  );

-- Politica: Admin da Empresa Edição do Próprio Perfil
DROP POLICY IF EXISTS "SellerProfiles - Company Admin Update" ON public.seller_financial_profiles;
CREATE POLICY "SellerProfiles - Company Admin Update"
  ON public.seller_financial_profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_id = seller_financial_profiles.company_id AND user_id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  );

-- Politica Logs: Master Admin e Membros da Própria Empresa
DROP POLICY IF EXISTS "SellerProfileLogs - Master Admin & Company Read" ON public.seller_financial_profile_logs;
CREATE POLICY "SellerProfileLogs - Master Admin & Company Read"
  ON public.seller_financial_profile_logs FOR SELECT TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT get_user_company_ids()));
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5C: HARDENING DO GATILHO DE REVISÃO E RLS
-- Data: 2026-07-31
-- ============================================================================

-- 1. ATUALIZAR FUNÇÃO DO GATILHO DE RESET COM IS DISTINCT FROM PARA TRATAMENTO DE NULL
CREATE OR REPLACE FUNCTION public.fn_reset_seller_financial_profile_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.verification_status = 'approved' AND (
    NEW.document_type IS DISTINCT FROM OLD.document_type OR
    NEW.document_number IS DISTINCT FROM OLD.document_number OR
    NEW.legal_name IS DISTINCT FROM OLD.legal_name OR
    NEW.responsible_name IS DISTINCT FROM OLD.responsible_name OR
    NEW.responsible_email IS DISTINCT FROM OLD.responsible_email OR
    NEW.responsible_phone IS DISTINCT FROM OLD.responsible_phone OR
    NEW.bank_code IS DISTINCT FROM OLD.bank_code OR
    NEW.bank_name IS DISTINCT FROM OLD.bank_name OR
    NEW.bank_agency IS DISTINCT FROM OLD.bank_agency OR
    NEW.bank_account IS DISTINCT FROM OLD.bank_account OR
    NEW.bank_account_digit IS DISTINCT FROM OLD.bank_account_digit OR
    NEW.bank_account_type IS DISTINCT FROM OLD.bank_account_type OR
    NEW.pix_key_type IS DISTINCT FROM OLD.pix_key_type OR
    NEW.pix_key IS DISTINCT FROM OLD.pix_key OR
    NEW.asaas_wallet_id IS DISTINCT FROM OLD.asaas_wallet_id OR
    NEW.asaas_account_id IS DISTINCT FROM OLD.asaas_account_id
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
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5D: SIMULAÇÃO E ELEGIBILIDADE DE PAYOUT
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE ELEGIBILIDADE DE PAYOUT POR PEDIDO (SELLER_PAYOUT_ELIGIBILITY)
CREATE TABLE IF NOT EXISTS public.seller_payout_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  buyer_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ad_offer_order_id UUID NOT NULL UNIQUE REFERENCES public.ad_offer_orders(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  seller_financial_ledger_id UUID REFERENCES public.seller_financial_ledger(id) ON DELETE SET NULL,
  asaas_payment_id TEXT,
  gross_amount_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  seller_net_cents INTEGER NOT NULL DEFAULT 0,
  eligible_amount_cents INTEGER NOT NULL DEFAULT 0,
  ineligible_amount_cents INTEGER NOT NULL DEFAULT 0,
  eligibility_status TEXT NOT NULL DEFAULT 'not_eligible' CHECK (eligibility_status IN ('not_eligible', 'pending_delivery', 'pending_financial_profile', 'pending_asaas_wallet', 'eligible', 'blocked', 'cancelled')),
  eligibility_reason TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'in_progress',
  financial_status TEXT NOT NULL DEFAULT 'pending_delivery',
  seller_verification_status TEXT DEFAULT 'draft',
  asaas_status TEXT DEFAULT 'not_created',
  asaas_wallet_id TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_elig_seller_id ON public.seller_payout_eligibility(seller_company_id);
CREATE INDEX IF NOT EXISTS idx_payout_elig_status ON public.seller_payout_eligibility(eligibility_status);

-- 2. TABELA DE SIMULAÇÕES DE LOTE (SELLER_PAYOUT_SIMULATIONS)
CREATE TABLE IF NOT EXISTS public.seller_payout_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_gross_cents INTEGER NOT NULL DEFAULT 0,
  total_platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_seller_net_cents INTEGER NOT NULL DEFAULT 0,
  total_eligible_cents INTEGER NOT NULL DEFAULT 0,
  total_blocked_cents INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_sim_seller_id ON public.seller_payout_simulations(seller_company_id);

-- 3. HABILITAR RLS E SEGURANÇA MULTIEMPRESA
ALTER TABLE public.seller_payout_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payout_simulations ENABLE ROW LEVEL SECURITY;

-- Politicas seller_payout_eligibility
DROP POLICY IF EXISTS "PayoutEligibility - Master Admin Full Access" ON public.seller_payout_eligibility;
CREATE POLICY "PayoutEligibility - Master Admin Full Access"
  ON public.seller_payout_eligibility FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

DROP POLICY IF EXISTS "PayoutEligibility - Seller Company Read" ON public.seller_payout_eligibility;
CREATE POLICY "PayoutEligibility - Seller Company Read"
  ON public.seller_payout_eligibility FOR SELECT TO authenticated
  USING (seller_company_id IN (SELECT get_user_company_ids()));

-- Politicas seller_payout_simulations
DROP POLICY IF EXISTS "PayoutSimulations - Master Admin Full Access" ON public.seller_payout_simulations;
CREATE POLICY "PayoutSimulations - Master Admin Full Access"
  ON public.seller_payout_simulations FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

DROP POLICY IF EXISTS "PayoutSimulations - Seller Company Read" ON public.seller_payout_simulations;
CREATE POLICY "PayoutSimulations - Seller Company Read"
  ON public.seller_payout_simulations FOR SELECT TO authenticated
  USING (seller_company_id IN (SELECT get_user_company_ids()));
-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5E: TRANSFERÊNCIA CONTROLADA PÓS-ENTREGA
-- Data: 2026-07-31
-- ============================================================================

-- 1. ALTERAÇÃO NA TABELA SELLER_FINANCIAL_LEDGER
ALTER TABLE public.seller_financial_ledger
  ADD COLUMN IF NOT EXISTS amount_transferred_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_transfer_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transfer_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (transfer_status IN ('not_requested', 'partially_transferred', 'transferred', 'transfer_failed'));

-- 2. TABELA DE LOTES DE REPASSE (SELLER_PAYOUT_BATCHES)
CREATE TABLE IF NOT EXISTS public.seller_payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'processing', 'completed', 'partially_failed', 'failed', 'cancelled')),
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  executed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON public.seller_payout_batches(status);

-- 3. TABELA DE ITENS DO LOTE (SELLER_PAYOUT_BATCH_ITEMS)
CREATE TABLE IF NOT EXISTS public.seller_payout_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.seller_payout_batches(id) ON DELETE CASCADE,
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ad_offer_order_id UUID NOT NULL REFERENCES public.ad_offer_orders(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  seller_financial_ledger_id UUID REFERENCES public.seller_financial_ledger(id) ON DELETE SET NULL,
  seller_payout_eligibility_id UUID REFERENCES public.seller_payout_eligibility(id) ON DELETE SET NULL,
  asaas_payment_id TEXT,
  asaas_wallet_id TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'processing', 'transferred', 'failed', 'cancelled', 'blocked')),
  asaas_transfer_id TEXT,
  transfer_response JSONB,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_batch_items_batch ON public.seller_payout_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_seller ON public.seller_payout_batch_items(seller_company_id);

-- 4. TABELA DE HISTÓRICO DE TRANSFERÊNCIAS (SELLER_PAYOUT_TRANSFERS)
CREATE TABLE IF NOT EXISTS public.seller_payout_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  batch_item_id UUID REFERENCES public.seller_payout_batch_items(id) ON DELETE SET NULL,
  seller_financial_ledger_id UUID REFERENCES public.seller_financial_ledger(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  asaas_wallet_id TEXT NOT NULL,
  asaas_transfer_id TEXT,
  transfer_status TEXT NOT NULL DEFAULT 'created' CHECK (transfer_status IN ('created', 'processing', 'done', 'failed', 'cancelled', 'reversed')),
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  raw_request JSONB,
  raw_response JSONB,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_transfers_seller ON public.seller_payout_transfers(seller_company_id);
CREATE INDEX IF NOT EXISTS idx_payout_transfers_idempotency ON public.seller_payout_transfers(idempotency_key);

-- 5. HABILITAR RLS E SEGURANÇA MULTIEMPRESA
ALTER TABLE public.seller_payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payout_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payout_transfers ENABLE ROW LEVEL SECURITY;

-- Politicas seller_payout_batches
DROP POLICY IF EXISTS "PayoutBatches - Master Admin Full Access" ON public.seller_payout_batches;
CREATE POLICY "PayoutBatches - Master Admin Full Access"
  ON public.seller_payout_batches FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

DROP POLICY IF EXISTS "PayoutBatches - Company Member Read" ON public.seller_payout_batches;
CREATE POLICY "PayoutBatches - Company Member Read"
  ON public.seller_payout_batches FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.seller_payout_batch_items
    WHERE batch_id = seller_payout_batches.id AND seller_company_id IN (SELECT get_user_company_ids())
  ));

-- Politicas seller_payout_batch_items
DROP POLICY IF EXISTS "PayoutBatchItems - Master Admin Full Access" ON public.seller_payout_batch_items;
CREATE POLICY "PayoutBatchItems - Master Admin Full Access"
  ON public.seller_payout_batch_items FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

DROP POLICY IF EXISTS "PayoutBatchItems - Seller Company Read" ON public.seller_payout_batch_items;
CREATE POLICY "PayoutBatchItems - Seller Company Read"
  ON public.seller_payout_batch_items FOR SELECT TO authenticated
  USING (seller_company_id IN (SELECT get_user_company_ids()));

-- Politicas seller_payout_transfers
DROP POLICY IF EXISTS "PayoutTransfers - Master Admin Full Access" ON public.seller_payout_transfers;
CREATE POLICY "PayoutTransfers - Master Admin Full Access"
  ON public.seller_payout_transfers FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

DROP POLICY IF EXISTS "PayoutTransfers - Seller Company Read" ON public.seller_payout_transfers;
CREATE POLICY "PayoutTransfers - Seller Company Read"
  ON public.seller_payout_transfers FOR SELECT TO authenticated
  USING (seller_company_id IN (SELECT get_user_company_ids()));
