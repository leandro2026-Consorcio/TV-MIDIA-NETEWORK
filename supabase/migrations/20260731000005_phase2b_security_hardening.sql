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
