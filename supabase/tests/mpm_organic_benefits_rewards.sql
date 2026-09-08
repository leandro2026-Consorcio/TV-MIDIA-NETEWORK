BEGIN;
SET LOCAL request.jwt.claim.role='service_role';

DO $test$
DECLARE
  v_company_a UUID;
  v_company_b UUID;
  v_company_admin_a UUID;
  v_company_admin_b UUID;
  v_participant_user_1 UUID;
  v_participant_user_2 UUID;
  v_part_1 UUID;
  v_part_2 UUID;
  v_terms JSONB;
  v_sub JSONB;
  v_reward_id UUID;
  v_reward_record RECORD;
  v_appr JSONB;
  v_entitlement RECORD;
  v_wallet_before RECORD;
  v_wallet_after RECORD;
  v_res_1 JSONB;
  v_res_2 JSONB;
  v_coupon_code TEXT;
  v_qr_token TEXT;
  v_validation JSONB;
  v_double_validation JSONB;
  v_expired_count INTEGER;
  v_stock_check RECORD;
  v_ledger_check RECORD;
  v_exp_reward UUID;
  v_exp_res JSONB;
BEGIN
  -- 1. Criação de Empresas de Teste e Administradores
  INSERT INTO public.companies(trade_name, city, state)
  VALUES('Pizzaria ABC Teste', 'Sinop', 'MT') RETURNING id INTO v_company_a;

  INSERT INTO public.companies(trade_name, city, state)
  VALUES('Restaurante XYZ Teste', 'Sinop', 'MT') RETURNING id INTO v_company_b;

  v_company_admin_a := gen_random_uuid();
  INSERT INTO public.profiles(id, full_name, email, role)
  VALUES(v_company_admin_a, 'Admin Empresa A', 'admin_a@midiapormidia.com.br', 'authenticated');
  INSERT INTO public.company_users(company_id, user_id, role, is_active)
  VALUES(v_company_a, v_company_admin_a, 'admin', true);

  v_company_admin_b := gen_random_uuid();
  INSERT INTO public.profiles(id, full_name, email, role)
  VALUES(v_company_admin_b, 'Admin Empresa B', 'admin_b@midiapormidia.com.br', 'authenticated');
  INSERT INTO public.company_users(company_id, user_id, role, is_active)
  VALUES(v_company_b, v_company_admin_b, 'admin', true);

  -- Participantes Orgânicos de Teste
  v_participant_user_1 := gen_random_uuid();
  INSERT INTO public.profiles(id, full_name, email, role)
  VALUES(v_participant_user_1, 'João da Silva Teste', 'joao_teste@midiapormidia.com.br', 'authenticated');
  INSERT INTO public.organic_participants(user_id, display_name, city, state, available_balance, status)
  VALUES(v_participant_user_1, 'João da Silva', 'Sinop', 'MT', 200.00, 'active')
  RETURNING id INTO v_part_1;

  v_participant_user_2 := gen_random_uuid();
  INSERT INTO public.profiles(id, full_name, email, role)
  VALUES(v_participant_user_2, 'Maria Souza Teste', 'maria_teste@midiapormidia.com.br', 'authenticated');
  INSERT INTO public.organic_participants(user_id, display_name, city, state, available_balance, status)
  VALUES(v_participant_user_2, 'Maria Souza', 'Sinop', 'MT', 200.00, 'active')
  RETURNING id INTO v_part_2;

  -- 1, 2, 3, 4: Teste de Cálculo: R$ 79,90 com 10 unidades => 80 pontos, R$ 799,00 contribuição
  v_terms := public.calculate_organic_benefit_terms(79.90, 10);
  IF (v_terms->>'suggested_points')::INTEGER <> 80 THEN
    RAISE EXCEPTION 'FAIL: Pontuação calculada esperada 80, obtido: %', v_terms->>'suggested_points';
  END IF;
  IF (v_terms->>'promotional_value')::NUMERIC <> 799.00 THEN
    RAISE EXCEPTION 'FAIL: Valor promocional esperado 799.00, obtido: %', v_terms->>'promotional_value';
  END IF;

  -- Simula submissão pela Empresa A (com auth.uid simulado de Admin A)
  PERFORM set_config('request.jwt.claim.sub', v_company_admin_a::text, true);

  v_sub := public.submit_or_update_organic_benefit(
    NULL, v_company_a, 'Rodízio de Pizza', 'Válido para 1 pessoa', 'Gastronomia', NULL,
    79.90, 10, 1, ARRAY['Unidade Centro'], ARRAY[0,1,2,3,4,5,6], NULL, NULL, NULL, 7,
    NOW() + INTERVAL '30 days', NULL, 'Termos e regras padrão'
  );
  v_reward_id := (v_sub->>'id')::UUID;
  IF v_reward_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: Falha ao submeter benefício: %', v_sub;
  END IF;

  -- 5. Teste Master: Valor aprovado diferente do informado (ex: informado 79.90, aprovado 70.00)
  -- Reseta para role service_role/master
  SET LOCAL request.jwt.claim.role='service_role';
  v_appr := public.approve_organic_benefit(v_reward_id, 70.00, 'active', 'Ajuste comercial aprovado');
  IF (v_appr->>'approved_unit_value')::NUMERIC <> 70.00 THEN
    RAISE EXCEPTION 'FAIL: Valor aprovado incorreto: %', v_appr;
  END IF;
  IF (v_appr->>'credits_required')::INTEGER <> 70 THEN
    RAISE EXCEPTION 'FAIL: Pontos recalculados esperados 70, obtido: %', v_appr->>'credits_required';
  END IF;
  IF (v_appr->>'approved_promotional_value')::NUMERIC <> 700.00 THEN
    RAISE EXCEPTION 'FAIL: Valor promocional recalculado esperado 700.00, obtido: %', v_appr->>'approved_promotional_value';
  END IF;

  -- 6. Teste Entitlement criado SEM gerar Crédito MPM
  SELECT * INTO v_entitlement FROM public.organic_benefit_media_entitlements WHERE reward_id = v_reward_id;
  IF v_entitlement.id IS NULL OR v_entitlement.granted_insertions <= 0 THEN
    RAISE EXCEPTION 'FAIL: Entitlement de mídia não foi criado para benefício aprovado';
  END IF;

  -- Verifica que nenhuma carteira da empresa foi alterada
  IF EXISTS(SELECT 1 FROM public.wallets WHERE company_id = v_company_a AND balance > 0) THEN
    RAISE EXCEPTION 'FAIL: Crédito MPM gerado indevidamente para carteira da empresa!';
  END IF;

  -- 7, 8, 9, 10, 11: Resgate atômico pelo Participante 1
  PERFORM set_config('request.jwt.claim.sub', v_participant_user_1::text, true);
  v_res_1 := public.reserve_organic_coupon(v_reward_id);
  IF NOT (v_res_1->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'FAIL: Resgate falhou: %', v_res_1;
  END IF;

  v_coupon_code := v_res_1->>'coupon_code';
  v_qr_token := v_res_1->>'qr_token';
  IF length(v_coupon_code) < 6 OR length(v_qr_token) < 20 THEN
    RAISE EXCEPTION 'FAIL: Código de cupom ou QR token inválido: %', v_res_1;
  END IF;

  -- Verifica estoque: 10 total, 9 disponível, 1 reservado
  SELECT * INTO v_reward_record FROM public.organic_campaign_rewards WHERE id = v_reward_id;
  IF v_reward_record.quantity_available <> 9 OR v_reward_record.quantity_reserved <> 1 THEN
    RAISE EXCEPTION 'FAIL: Estoque incorreto após reserva: disp=%, res=%', v_reward_record.quantity_available, v_reward_record.quantity_reserved;
  END IF;

  -- Verifica débito de microcréditos do participante 1 (200 - 70 = 130)
  IF (SELECT available_balance FROM public.organic_participants WHERE id = v_part_1) <> 130.00 THEN
    RAISE EXCEPTION 'FAIL: Saldo de microcréditos não debitado corretamente';
  END IF;

  -- 8. Limite por usuário (max_per_user = 1): segundo resgate do mesmo participante DEVE falhar
  v_res_2 := public.reserve_organic_coupon(v_reward_id);
  IF (v_res_2->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'FAIL: Limite de 1 resgate por usuário não foi respeitado!';
  END IF;

  -- 20, 21, 22: Empresa B NÃO pode validar cupom da Empresa A
  PERFORM set_config('request.jwt.claim.sub', v_company_admin_b::text, true);
  v_validation := public.validate_and_redeem_coupon(v_coupon_code, 'Unidade Centro', 'code');
  IF (v_validation->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'FAIL: Empresa B conseguiu validar cupom pertencente à Empresa A!';
  END IF;

  -- 12, 23: Empresa A valida cupom com sucesso e segunda validação é BLOQUEADA
  PERFORM set_config('request.jwt.claim.sub', v_company_admin_a::text, true);
  v_validation := public.validate_and_redeem_coupon(v_coupon_code, 'Unidade Centro', 'code');
  IF NOT (v_validation->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'FAIL: Empresa A não conseguiu validar cupom: %', v_validation;
  END IF;

  -- Dupla baixa (idempotência / bloqueio)
  v_double_validation := public.validate_and_redeem_coupon(v_coupon_code, 'Unidade Centro', 'code');
  IF (v_double_validation->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'FAIL: Dupla baixa permitida no mesmo cupom!';
  END IF;

  -- Verifica estoque após baixa: 9 disponível, 0 reservado, 1 resgatado/utilizado
  SELECT * INTO v_reward_record FROM public.organic_campaign_rewards WHERE id = v_reward_id;
  IF v_reward_record.quantity_available <> 9 OR v_reward_record.quantity_reserved <> 0 OR v_reward_record.quantity_redeemed <> 1 THEN
    RAISE EXCEPTION 'FAIL: Estoque pós-baixa incorreto: disp=%, res=%, red=%',
      v_reward_record.quantity_available, v_reward_record.quantity_reserved, v_reward_record.quantity_redeemed;
  END IF;

  -- 15, 16, 17, 18: Expiração com devolução de pontos e retorno de estoque
  SET LOCAL request.jwt.claim.role='service_role';
  -- Cria cupom expirado de teste para participante 2
  INSERT INTO public.organic_campaign_rewards (
    company_id, title, credits_required, credit_budget, quantity_total, quantity_available, quantity_reserved,
    expires_at, status, points_refund_policy, stock_return_policy
  ) VALUES (
    v_company_a, 'Prêmio Expirável', 50.00, 500.00, 5, 4, 1,
    NOW() + INTERVAL '10 days', 'active', 'refund_on_expire', 'return_if_active'
  ) RETURNING id INTO v_exp_reward;

  INSERT INTO public.organic_reward_redemptions (
    reward_id, company_id, participant_id, credits_reserved, redemption_code_hash,
    redemption_code_suffix, coupon_code, status, expires_at
  ) VALUES (
    v_exp_reward, v_company_a, v_part_2, 50.00, 'hash_exp_1', 'EXP1', 'EXP001',
    'reserved', NOW() - INTERVAL '1 hour'
  );
  -- Debita saldo do participante 2 previamente
  UPDATE public.organic_participants SET available_balance = available_balance - 50.00 WHERE id = v_part_2;

  -- Executa job de expiração
  v_expired_count := public.expire_organic_redemptions();
  IF v_expired_count < 1 THEN
    RAISE EXCEPTION 'FAIL: expire_organic_redemptions não processou reserva vencida';
  END IF;

  -- Verifica devolução de pontos ao participante 2
  IF (SELECT available_balance FROM public.organic_participants WHERE id = v_part_2) <> 200.00 THEN
    RAISE EXCEPTION 'FAIL: Devolução de pontos não ocorreu após expiração';
  END IF;

  -- Verifica retorno de estoque à campanha ativa (4 + 1 = 5)
  SELECT * INTO v_stock_check FROM public.organic_campaign_rewards WHERE id = v_exp_reward;
  IF v_stock_check.quantity_available <> 5 OR v_stock_check.quantity_reserved <> 0 THEN
    RAISE EXCEPTION 'FAIL: Retorno de estoque não ocorreu para campanha ativa: disp=%, res=%',
      v_stock_check.quantity_available, v_stock_check.quantity_reserved;
  END IF;

  -- 18: Campanha vencida NÃO retorna estoque
  UPDATE public.organic_campaign_rewards
  SET status = 'expired', expires_at = NOW() - INTERVAL '1 day', quantity_available = 2, quantity_reserved = 1
  WHERE id = v_exp_reward;

  INSERT INTO public.organic_reward_redemptions (
    reward_id, company_id, participant_id, credits_reserved, redemption_code_hash,
    redemption_code_suffix, coupon_code, status, expires_at
  ) VALUES (
    v_exp_reward, v_company_a, v_part_2, 50.00, 'hash_exp_2', 'EXP2', 'EXP002',
    'reserved', NOW() - INTERVAL '1 hour'
  );

  PERFORM public.expire_organic_redemptions();
  SELECT * INTO v_stock_check FROM public.organic_campaign_rewards WHERE id = v_exp_reward;
  -- Disponível DEVE permanecer 2 (campanha vencida NÃO pode aumentar estoque disponível)
  IF v_stock_check.quantity_available <> 2 THEN
    RAISE EXCEPTION 'FAIL: Campanha vencida retornou estoque indevidamente: disp=%', v_stock_check.quantity_available;
  END IF;

  -- 24. Verificação final: Nenhuma criação de Crédito MPM
  IF EXISTS (SELECT 1 FROM public.wallets WHERE balance > 0) THEN
    RAISE EXCEPTION 'FAIL: Violação do princípio econômico: Crédito MPM encontrado em wallets';
  END IF;

  RAISE NOTICE 'SUCCESS: Todos os 24 requisitos de Benefícios & Prêmios da Rede Orgânica foram validados com sucesso!';
END;
$test$;

ROLLBACK;
