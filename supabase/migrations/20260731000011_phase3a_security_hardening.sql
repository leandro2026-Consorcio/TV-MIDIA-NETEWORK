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
