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
    company_id IN (SELECT public.get_user_admin_company_ids())
  );

DROP POLICY IF EXISTS "Screens - Edição por Admins da Empresa ou Master Admin" ON public.screens;
CREATE POLICY "Screens - Edição por Admins da Empresa ou Master Admin"
  ON public.screens FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_admin_company_ids())
  );

DROP POLICY IF EXISTS "Screens - Exclusão restrita a Admins da Empresa ou Master Admin" ON public.screens;
CREATE POLICY "Screens - Exclusão restrita a Admins da Empresa ou Master Admin"
  ON public.screens FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_admin_company_ids())
  );

-- 5. POLÍTICAS RLS - SCREEN_PAIRING_CODES
DROP POLICY IF EXISTS "PairingCodes - Leitura Master Admin" ON public.screen_pairing_codes;
CREATE POLICY "PairingCodes - Leitura Master Admin"
  ON public.screen_pairing_codes FOR SELECT
  TO authenticated
  USING (is_master_admin());
