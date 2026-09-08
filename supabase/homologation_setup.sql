-- ============================================================================
-- SCRIPT DE HOMOLOGAÇÃO CONTROLADA POR PERFIL — MÍDIA POR MÍDIA
-- ============================================================================
-- Objetivo: Criar e vincular os 5 perfis de teste de homologação sem gerar cobrança
-- financeira real, sem ativar cashout e com identificação inequívoca: "HOMOLOGAÇÃO MPM".
--
-- Emails fornecidos:
-- 1. MASTER:      homolog.master@msdeducacao.com.br
-- 2. EMPRESA:     homolog.empresa@msdeducacao.com.br
-- 3. CREATOR:     homolog.creator@msdeducacao.com.br
-- 4. LÍDER:       homolog.lider@msdeducacao.com.br
-- 5. ORGÂNICO/PF: homolog.org@msdeducacao.com.br
-- ============================================================================

DO $$
DECLARE
  v_master_id UUID;
  v_empresa_user_id UUID;
  v_creator_user_id UUID;
  v_lider_user_id UUID;
  v_org_user_id UUID;

  v_company_id UUID;
  v_wallet_id UUID;
  v_leader_affiliate_id UUID;
  v_creator_affiliate_id UUID;
  v_creator_profile_id UUID;
  v_organic_participant_id UUID;

  v_plan_id UUID;
  v_plan_version_id UUID;
  v_rule_version_id UUID;
  v_subscription_id UUID;

  v_screen_1_id UUID;
  v_screen_2_id UUID;
  v_screen_3_id UUID;
  v_screen_res_id UUID;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1. IDENTIFICAÇÃO OU CRIAÇÃO DOS USUÁRIOS NO AUTH.USERS (IDEMPOTENTE)
  -- --------------------------------------------------------------------------

  -- Master
  SELECT id INTO v_master_id FROM auth.users WHERE lower(email) = 'homolog.master@msdeducacao.com.br';
  IF v_master_id IS NULL THEN
    v_master_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (v_master_id, '00000000-0000-0000-0000-000000000000', 'homolog.master@msdeducacao.com.br', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"HOMOLOGAÇÃO MPM — Master Admin"}', now(), now(), 'authenticated', 'authenticated');
  END IF;

  -- Empresa User
  SELECT id INTO v_empresa_user_id FROM auth.users WHERE lower(email) = 'homolog.empresa@msdeducacao.com.br';
  IF v_empresa_user_id IS NULL THEN
    v_empresa_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (v_empresa_user_id, '00000000-0000-0000-0000-000000000000', 'homolog.empresa@msdeducacao.com.br', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"HOMOLOGAÇÃO MPM — Empresa Teste"}', now(), now(), 'authenticated', 'authenticated');
  END IF;

  -- Creator User
  SELECT id INTO v_creator_user_id FROM auth.users WHERE lower(email) = 'homolog.creator@msdeducacao.com.br';
  IF v_creator_user_id IS NULL THEN
    v_creator_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (v_creator_user_id, '00000000-0000-0000-0000-000000000000', 'homolog.creator@msdeducacao.com.br', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"HOMOLOGAÇÃO MPM — Creator Teste"}', now(), now(), 'authenticated', 'authenticated');
  END IF;

  -- Líder User
  SELECT id INTO v_lider_user_id FROM auth.users WHERE lower(email) = 'homolog.lider@msdeducacao.com.br';
  IF v_lider_user_id IS NULL THEN
    v_lider_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (v_lider_user_id, '00000000-0000-0000-0000-000000000000', 'homolog.lider@msdeducacao.com.br', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"HOMOLOGAÇÃO MPM — Líder Teste"}', now(), now(), 'authenticated', 'authenticated');
  END IF;

  -- Orgânico / PF User
  SELECT id INTO v_org_user_id FROM auth.users WHERE lower(email) = 'homolog.org@msdeducacao.com.br';
  IF v_org_user_id IS NULL THEN
    v_org_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (v_org_user_id, '00000000-0000-0000-0000-000000000000', 'homolog.org@msdeducacao.com.br', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"HOMOLOGAÇÃO MPM — Orgânico Teste"}', now(), now(), 'authenticated', 'authenticated');
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. GARANTIR PROFILES PÚBLICOS
  -- --------------------------------------------------------------------------
  INSERT INTO public.profiles (id, email, full_name, is_master_admin)
  VALUES (v_master_id, 'homolog.master@msdeducacao.com.br', 'HOMOLOGAÇÃO MPM — Master Admin', true)
  ON CONFLICT (id) DO UPDATE SET is_master_admin = true, full_name = EXCLUDED.full_name;

  INSERT INTO public.profiles (id, email, full_name, is_master_admin)
  VALUES (v_empresa_user_id, 'homolog.empresa@msdeducacao.com.br', 'HOMOLOGAÇÃO MPM — Empresa Teste', false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.profiles (id, email, full_name, is_master_admin)
  VALUES (v_creator_user_id, 'homolog.creator@msdeducacao.com.br', 'HOMOLOGAÇÃO MPM — Creator Teste', false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.profiles (id, email, full_name, is_master_admin)
  VALUES (v_lider_user_id, 'homolog.lider@msdeducacao.com.br', 'HOMOLOGAÇÃO MPM — Líder Teste', false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.profiles (id, email, full_name, is_master_admin)
  VALUES (v_org_user_id, 'homolog.org@msdeducacao.com.br', 'HOMOLOGAÇÃO MPM — Orgânico Teste', false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- --------------------------------------------------------------------------
  -- 3. PERFIL DO LÍDER (affiliate_profiles)
  -- --------------------------------------------------------------------------
  SELECT id INTO v_leader_affiliate_id FROM public.affiliate_profiles WHERE attribution_code = 'LIDER-HOMOLOG';
  IF v_leader_affiliate_id IS NULL THEN
    INSERT INTO public.affiliate_profiles (user_id, affiliate_type, display_name, attribution_code, status, metadata)
    VALUES (v_lider_user_id, 'partners', 'HOMOLOGAÇÃO MPM — Líder Teste', 'LIDER-HOMOLOG', 'active', '{"role":"leader","env":"homologation"}'::jsonb)
    RETURNING id INTO v_leader_affiliate_id;
  ELSE
    UPDATE public.affiliate_profiles
    SET user_id = v_lider_user_id, affiliate_type = 'partners', display_name = 'HOMOLOGAÇÃO MPM — Líder Teste', status = 'active', metadata = metadata || '{"role":"leader","env":"homologation"}'::jsonb
    WHERE id = v_leader_affiliate_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- 4. PERFIL DO CREATOR (affiliate_profiles + creator_profiles)
  -- --------------------------------------------------------------------------
  SELECT id INTO v_creator_affiliate_id FROM public.affiliate_profiles WHERE attribution_code = 'CREATOR-HOMOLOG';
  IF v_creator_affiliate_id IS NULL THEN
    INSERT INTO public.affiliate_profiles (user_id, affiliate_type, display_name, attribution_code, status, metadata)
    VALUES (v_creator_user_id, 'creators', 'HOMOLOGAÇÃO MPM — Creator Teste', 'CREATOR-HOMOLOG', 'active', '{"role":"creator","env":"homologation"}'::jsonb)
    RETURNING id INTO v_creator_affiliate_id;
  ELSE
    UPDATE public.affiliate_profiles
    SET user_id = v_creator_user_id, affiliate_type = 'creators', display_name = 'HOMOLOGAÇÃO MPM — Creator Teste', status = 'active', metadata = metadata || '{"role":"creator","env":"homologation"}'::jsonb
    WHERE id = v_creator_affiliate_id;
  END IF;

  SELECT id INTO v_creator_profile_id FROM public.creator_profiles WHERE user_id = v_creator_user_id;
  IF v_creator_profile_id IS NULL THEN
    INSERT INTO public.creator_profiles (
      user_id, display_name, slug, bio, city, state, niches,
      is_public_profile, show_followers_publicly, show_scores_publicly, show_pricing_publicly,
      is_verified, pricing_mode, status, creator_score, media_value_score, tier
    )
    VALUES (
      v_creator_user_id, 'HOMOLOGAÇÃO MPM — Creator Teste', 'creator-teste-homologacao',
      'Perfil oficial de homologação controlada da rede Mídia por Mídia.', 'Cuiabá', 'MT', ARRAY['Lifestyle', 'Varejo'],
      true, true, true, true,
      true, 'dynamic', 'active', 88.5, 95.0, 'tier_b'
    )
    RETURNING id INTO v_creator_profile_id;
  ELSE
    UPDATE public.creator_profiles
    SET display_name = 'HOMOLOGAÇÃO MPM — Creator Teste',
        slug = 'creator-teste-homologacao',
        niches = ARRAY['Lifestyle', 'Varejo'],
        is_public_profile = true,
        show_followers_publicly = true,
        show_scores_publicly = true,
        show_pricing_publicly = true,
        is_verified = true,
        pricing_mode = 'dynamic',
        status = 'active',
        creator_score = 88.5,
        media_value_score = 95.0,
        tier = 'tier_b'
    WHERE id = v_creator_profile_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- 5. VÍNCULO HIERÁRQUICO LÍDER -> CREATOR (affiliate_relationships)
  -- --------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.affiliate_relationships
    WHERE leader_affiliate_id = v_leader_affiliate_id AND creator_affiliate_id = v_creator_affiliate_id AND status = 'active'
  ) THEN
    INSERT INTO public.affiliate_relationships (leader_affiliate_id, creator_affiliate_id, status, metadata)
    VALUES (v_leader_affiliate_id, v_creator_affiliate_id, 'active', '{"env":"homologation"}'::jsonb);
  END IF;

  -- --------------------------------------------------------------------------
  -- 6. EMPRESA TESTE (companies + company_users + wallet)
  -- --------------------------------------------------------------------------
  SELECT id INTO v_company_id FROM public.companies WHERE trade_name = 'HOMOLOGAÇÃO MPM — Empresa Teste';
  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (
      trade_name, corporate_name, cnpj, city, state, is_active,
      show_name_publicly, show_in_marketplace, show_on_map, allow_automatic_campaigns
    )
    VALUES (
      'HOMOLOGAÇÃO MPM — Empresa Teste', 'HOMOLOGAÇÃO MPM — Empresa Teste LTDA',
      '11222333000199', 'Cuiabá', 'MT', true,
      true, true, true, false
    )
    RETURNING id INTO v_company_id;
  ELSE
    UPDATE public.companies
    SET show_name_publicly = true, show_in_marketplace = true, show_on_map = true, is_active = true
    WHERE id = v_company_id;
  END IF;

  -- Associação Empresa <-> Usuário Empresa
  IF NOT EXISTS (SELECT 1 FROM public.company_users WHERE company_id = v_company_id AND user_id = v_empresa_user_id) THEN
    INSERT INTO public.company_users (company_id, user_id, role, is_active)
    VALUES (v_company_id, v_empresa_user_id, 'admin', true);
  END IF;

  -- Carteira zerada
  IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE company_id = v_company_id) THEN
    INSERT INTO public.wallets (company_id, balance) VALUES (v_company_id, 0.00);
  END IF;

  -- --------------------------------------------------------------------------
  -- 7. TELAS DE TV INDOOR COMERCIAIS (3 Telas da Empresa)
  -- --------------------------------------------------------------------------
  SELECT id INTO v_screen_1_id FROM public.screens WHERE company_id = v_company_id AND name = 'HOMOLOGAÇÃO MPM — TV Recepção';
  IF v_screen_1_id IS NULL THEN
    INSERT INTO public.screens (company_id, name, venue_type, venue_category, city, state, orientation, is_active, is_public_screen, show_on_map, indicative_price_credits)
    VALUES (v_company_id, 'HOMOLOGAÇÃO MPM — TV Recepção', 'commercial', 'Recepção Comercial', 'Cuiabá', 'MT', 'horizontal', true, true, true, 45)
    RETURNING id INTO v_screen_1_id;
  END IF;

  SELECT id INTO v_screen_2_id FROM public.screens WHERE company_id = v_company_id AND name = 'HOMOLOGAÇÃO MPM — TV Salão Principal';
  IF v_screen_2_id IS NULL THEN
    INSERT INTO public.screens (company_id, name, venue_type, venue_category, city, state, orientation, is_active, is_public_screen, show_on_map, indicative_price_credits)
    VALUES (v_company_id, 'HOMOLOGAÇÃO MPM — TV Salão Principal', 'commercial', 'Salão de Atendimento', 'Cuiabá', 'MT', 'horizontal', true, true, true, 60)
    RETURNING id INTO v_screen_2_id;
  END IF;

  SELECT id INTO v_screen_3_id FROM public.screens WHERE company_id = v_company_id AND name = 'HOMOLOGAÇÃO MPM — TV Vitrine';
  IF v_screen_3_id IS NULL THEN
    INSERT INTO public.screens (company_id, name, venue_type, venue_category, city, state, orientation, is_active, is_public_screen, show_on_map, indicative_price_credits)
    VALUES (v_company_id, 'HOMOLOGAÇÃO MPM — TV Vitrine', 'commercial', 'Vitrine Externa', 'Cuiabá', 'MT', 'vertical', true, true, true, 75)
    RETURNING id INTO v_screen_3_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- 8. PLANO 3 TVs E VÍNCULO DE EXPANSÃO (LÍDER -> CREATOR -> EMPRESA -> 3 TVs)
  -- --------------------------------------------------------------------------
  -- Garantir Plano 3 TVs
  SELECT id INTO v_plan_id FROM public.expansion_plans WHERE code = 'expansion-3-tvs';
  IF v_plan_id IS NULL THEN
    INSERT INTO public.expansion_plans (code, name, description, status, public_available, display_order)
    VALUES ('expansion-3-tvs', 'Plano 3 TVs', 'Plano de expansão com 3 telas indoor comerciais.', 'active', true, 2)
    RETURNING id INTO v_plan_id;
  END IF;

  SELECT id INTO v_plan_version_id FROM public.expansion_plan_versions WHERE plan_id = v_plan_id AND effective_to IS NULL;
  IF v_plan_version_id IS NULL THEN
    INSERT INTO public.expansion_plan_versions (
      plan_id, version, included_screens, monthly_price_cents, extra_screen_price_cents,
      days_until_second_charge, recurring_interval_months, commission_release_policy
    )
    VALUES (v_plan_id, 1, 3, 29900, 5900, 60, 1, 'proportional_to_activated_screens')
    RETURNING id INTO v_plan_version_id;
  END IF;

  -- Garantir Versão de Regra de Comissão
  SELECT id INTO v_rule_version_id FROM public.expansion_commission_rule_versions WHERE effective_to IS NULL LIMIT 1;
  IF v_rule_version_id IS NULL THEN
    INSERT INTO public.expansion_commission_rule_versions (
      version, name, first_platform_percent, first_creator_percent, first_leader_percent,
      recurring_platform_percent, recurring_creator_percent, recurring_leader_percent
    )
    VALUES (1, 'Regra Padrão Expansão', 10.0, 67.1141, 22.8859, 73.1544, 16.7785, 10.0671)
    RETURNING id INTO v_rule_version_id;
  END IF;

  -- Criar Assinatura do Plano 3 TVs (Simulada, sem cobrança Asaas)
  SELECT id INTO v_subscription_id FROM public.company_plan_subscriptions WHERE company_id = v_company_id;
  IF v_subscription_id IS NULL THEN
    INSERT INTO public.company_plan_subscriptions (
      company_id, plan_id, plan_version_id, commission_rule_version_id,
      origin_creator_affiliate_id, origin_leader_affiliate_id,
      requested_screens, contracted_amount_cents, status,
      frozen_snapshot, idempotency_key, created_by
    )
    VALUES (
      v_company_id, v_plan_id, v_plan_version_id, v_rule_version_id,
      v_creator_affiliate_id, v_leader_affiliate_id,
      3, 29900, 'active',
      '{"plan_code":"expansion-3-tvs","included_screens":3,"monthly_price_cents":29900,"simulated":true}'::jsonb,
      'homolog-subscription-3-tvs', v_master_id
    )
    RETURNING id INTO v_subscription_id;
  ELSE
    UPDATE public.company_plan_subscriptions
    SET origin_creator_affiliate_id = v_creator_affiliate_id,
        origin_leader_affiliate_id = v_leader_affiliate_id,
        status = 'active'
    WHERE id = v_subscription_id;
  END IF;

  -- 3 Slots de Tela Vinculados
  DELETE FROM public.subscription_screen_slots WHERE subscription_id = v_subscription_id;

  INSERT INTO public.subscription_screen_slots (subscription_id, slot_index, slot_type, economic_weight_cents, screen_id, status, creator_affiliate_id, leader_affiliate_id, activated_at)
  VALUES
    (v_subscription_id, 1, 'included', 9967, v_screen_1_id, 'active', v_creator_affiliate_id, v_leader_affiliate_id, now()),
    (v_subscription_id, 2, 'included', 9967, v_screen_2_id, 'active', v_creator_affiliate_id, v_leader_affiliate_id, now()),
    (v_subscription_id, 3, 'included', 9966, v_screen_3_id, 'active', v_creator_affiliate_id, v_leader_affiliate_id, now());

  -- --------------------------------------------------------------------------
  -- 9. PESSOA FÍSICA / REDE ORGÂNICA (1 Tela Residencial Protegida)
  -- --------------------------------------------------------------------------
  SELECT id INTO v_organic_participant_id FROM public.organic_participants WHERE user_id = v_org_user_id;
  IF v_organic_participant_id IS NULL THEN
    INSERT INTO public.organic_participants (user_id, display_name, city, state, status)
    VALUES (v_org_user_id, 'HOMOLOGAÇÃO MPM — Orgânico Teste', 'Cuiabá', 'MT', 'active')
    RETURNING id INTO v_organic_participant_id;
  ELSE
    UPDATE public.organic_participants
    SET display_name = 'HOMOLOGAÇÃO MPM — Orgânico Teste', city = 'Cuiabá', state = 'MT', status = 'active'
    WHERE id = v_organic_participant_id;
  END IF;

  SELECT id INTO v_screen_res_id FROM public.organic_screens WHERE participant_id = v_organic_participant_id AND name = 'HOMOLOGAÇÃO MPM — Tela Residencial Sala';
  IF v_screen_res_id IS NULL THEN
    INSERT INTO public.organic_screens (
      participant_id, name, device_type, orientation, status
    )
    VALUES (
      v_organic_participant_id, 'HOMOLOGAÇÃO MPM — Tela Residencial Sala', 'organic_tv', 'horizontal', 'online'
    )
    RETURNING id INTO v_screen_res_id;
  ELSE
    UPDATE public.organic_screens
    SET device_type = 'organic_tv', orientation = 'horizontal', status = 'online'
    WHERE id = v_screen_res_id;
  END IF;

  RAISE NOTICE 'Homologação configurada com sucesso!';
END $$;
