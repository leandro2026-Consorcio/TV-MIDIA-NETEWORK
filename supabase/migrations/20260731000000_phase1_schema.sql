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


-- 3.2.1 Retorna os IDs das empresas onde o usuário é Admin ativo (SECURITY DEFINER sem recursão)
CREATE OR REPLACE FUNCTION public.get_user_admin_company_ids()
RETURNS SETOF UUID AS $
BEGIN
  RETURN QUERY
  SELECT company_id 
  FROM public.company_users 
  WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE;
END;
$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

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

-- 5.3 RLS - COMPANY_USERS (SEM RECURSÃO VIA SECURITY DEFINER)
DROP POLICY IF EXISTS "CompanyUsers - Master Admin vê todos, Usuários vêem de suas empresas" ON public.company_users;
CREATE POLICY "CompanyUsers - Master Admin vê todos, Usuários vêem de suas empresas"
  ON public.company_users FOR SELECT
  TO authenticated
  USING (is_master_admin() OR user_id = auth.uid() OR company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "CompanyUsers - Master Admin e Admins gerenciam membros" ON public.company_users;
CREATE POLICY "CompanyUsers - Master Admin e Admins gerenciam membros"
  ON public.company_users FOR ALL
  TO authenticated
  USING (
    is_master_admin() OR company_id IN (SELECT public.get_user_admin_company_ids())
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
    company_id IN (SELECT public.get_user_admin_company_ids())
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
