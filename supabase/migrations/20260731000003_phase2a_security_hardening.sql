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

CREATE POLICY "PairingCodes - Leitura Master Admin"
  ON public.screen_pairing_codes FOR SELECT
  TO authenticated
  USING (is_master_admin());

-- Nenhuma política de INSERT/UPDATE para o cliente. Acesso 100% isolado via Server Actions.
