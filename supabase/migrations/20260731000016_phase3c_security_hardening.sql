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
