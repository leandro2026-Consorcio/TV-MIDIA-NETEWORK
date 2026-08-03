-- ============================================================================
-- REDE INDOOR LOCAL - SCRIPT DE AUDITORIA E VERIFICAÇÃO DE BANCO DE DADOS
-- Este script verifica se todas as tabelas, funções, triggers e políticas RLS
-- das Fases 1, 2A, 2B, 2C, 2D, 3A, 3B, 3C, 3D, 4A, 4B, 4C, 4D, 5A, 5B, 5C, 5D e 5E foram criadas.
-- ============================================================================

DO $$
DECLARE
  v_missing_tables TEXT[] := '{}';
  v_table_count INTEGER := 0;
  v_function_count INTEGER := 0;
  v_trigger_count INTEGER := 0;
  v_policy_count INTEGER := 0;
  v_master_count INTEGER := 0;
  v_total_users INTEGER := 0;
  
  t RECORD;
  expected_tables TEXT[] := ARRAY[
    'profiles',
    'companies',
    'company_users',
    'segments',
    'company_segments',
    'wallets',
    'wallet_transactions',
    'audit_logs',
    'screens',
    'pairing_codes',
    'media_assets',
    'playlists',
    'playlist_items',
    'screen_playlists',
    'playback_logs',
    'campaigns',
    'campaign_media',
    'campaign_screens',
    'company_trials',
    'referral_invites',
    'credit_packages',
    'credit_policies',
    'network_preferences',
    'company_ad_offers',
    'ad_offer_orders',
    'ad_order_delivery_ledger',
    'seller_financial_ledger',
    'platform_terms',
    'company_term_acceptances',
    'asaas_payment_events',
    'asaas_reconciliation_reviews',
    'seller_financial_profiles',
    'seller_financial_profile_logs',
    'seller_payout_eligibility',
    'seller_payout_simulations',
    'seller_payout_batches',
    'seller_payout_batch_items',
    'seller_payout_transfers'
  ];
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'INICIANDO AUDITORIA DE ESQUEMA DO SUPABASE (REDE INDOOR LOCAL)';
  RAISE NOTICE '================================================================';

  -- 1. CHECAGEM DE TABELAS
  FOREACH t IN ARRAY expected_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      v_table_count := v_table_count + 1;
    ELSE
      v_missing_tables := array_append(v_missing_tables, t);
    END IF;
  END LOOP;

  -- 2. CHECAGEM DE FUNÇÕES SQL E RPCs
  SELECT COUNT(*) INTO v_function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public';

  -- 3. CHECAGEM DE TRIGGERS
  SELECT COUNT(*) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema = 'public';

  -- 4. CHECAGEM DE POLÍTICAS RLS
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  -- 5. CONTAGEM DE USUÁRIOS E MASTER ADMINS
  SELECT COUNT(*) INTO v_total_users FROM public.profiles;
  SELECT COUNT(*) INTO v_master_count FROM public.profiles WHERE is_master_admin = TRUE;

  -- IMPRESSÃO DOS RESULTADOS
  RAISE NOTICE '1. STATUS DAS TABELAS: % de % tabelas esperadas estão criadas.', v_table_count, array_length(expected_tables, 1);
  IF array_length(v_missing_tables, 1) IS NULL OR array_length(v_missing_tables, 1) = 0 THEN
    RAISE NOTICE '   [SUCCESS] Todas as 38 tabelas do sistema estão presentes no Supabase!';
  ELSE
    RAISE NOTICE '   [WARNING] Tabelas ausentes: %', array_to_string(v_missing_tables, ', ');
  END IF;

  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '2. RECURSOS DO SISTEMA:';
  RAISE NOTICE '   - Funções SQL / RPCs criadas: %', v_function_count;
  RAISE NOTICE '   - Triggers ativos: %', v_trigger_count;
  RAISE NOTICE '   - Políticas de Segurança RLS ativas: %', v_policy_count;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '3. CONTAS E PERMISSÕES:';
  RAISE NOTICE '   - Total de usuários cadastrados: %', v_total_users;
  RAISE NOTICE '   - Usuários com acesso Master Admin: %', v_master_count;
  IF v_master_count = 0 THEN
    RAISE NOTICE '   [ATTENTION] Nenhum usuário foi promovido a Master Admin ainda. Cadastre um usuário e execute: UPDATE public.profiles SET is_master_admin = TRUE WHERE email = ''seu-email'';';
  ELSE
    RAISE NOTICE '   [SUCCESS] Já existe pelo menos 1 Master Admin configurado!';
  END IF;
  RAISE NOTICE '================================================================';
END $$;

-- RETORNAR RESUMO EM FORMATO TABULAR PARA FACILITAR LEITURA NO EDITOR
SELECT 
  'Tabelas Principais' AS item,
  COUNT(*)::TEXT || ' de 38 criadas' AS status,
  CASE WHEN COUNT(*) >= 38 THEN 'OK' ELSE 'PENDENTE' END AS resultado
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'profiles','companies','company_users','segments','company_segments','wallets',
    'wallet_transactions','audit_logs','screens','pairing_codes','media_assets',
    'playlists','playlist_items','screen_playlists','playback_logs','campaigns',
    'campaign_media','campaign_screens','company_trials','referral_invites',
    'credit_packages','credit_policies','network_preferences','company_ad_offers',
    'ad_offer_orders','ad_order_delivery_ledger','seller_financial_ledger',
    'platform_terms','company_term_acceptances','asaas_payment_events',
    'asaas_reconciliation_reviews','seller_financial_profiles','seller_financial_profile_logs',
    'seller_payout_eligibility','seller_payout_simulations','seller_payout_batches',
    'seller_payout_batch_items','seller_payout_transfers'
  )
UNION ALL
SELECT 
  'Políticas RLS' AS item,
  COUNT(*)::TEXT || ' políticas ativas' AS status,
  CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'PENDENTE' END AS resultado
FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 
  'Usuários Registrados' AS item,
  COUNT(*)::TEXT || ' usuário(s)' AS status,
  'INFO' AS resultado
FROM public.profiles
UNION ALL
SELECT 
  'Master Admins' AS item,
  COUNT(*)::TEXT || ' admin(s)' AS status,
  CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'CONFIGURAR MASTER' END AS resultado
FROM public.profiles WHERE is_master_admin = TRUE;
