-- ============================================================================
-- REDE INDOOR LOCAL - SCRIPT DE AUDITORIA E VERIFICAÇÃO DO SUPABASE
-- ============================================================================

WITH expected_tables AS (
  SELECT unnest(ARRAY[
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
  ]) AS table_name
),
created_tables AS (
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public'
)
SELECT 
  'Tabelas Criadas' AS item,
  (SELECT COUNT(*) FROM created_tables WHERE table_name IN (SELECT table_name FROM expected_tables))::TEXT || ' de 38 tabelas esperadas' AS detalhe,
  CASE WHEN (SELECT COUNT(*) FROM created_tables WHERE table_name IN (SELECT table_name FROM expected_tables)) >= 38 THEN 'OK (100% COMPLETO)' ELSE 'ATENÇÃO: TABELAS FALTANDO' END AS resultado
UNION ALL
SELECT 
  'Políticas RLS Ativas' AS item,
  COUNT(*)::TEXT || ' políticas configuradas' AS detalhe,
  CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'PENDENTE' END AS resultado
FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 
  'Triggers Ativos' AS item,
  COUNT(*)::TEXT || ' triggers no banco' AS detalhe,
  CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'PENDENTE' END AS resultado
FROM information_schema.triggers WHERE trigger_schema = 'public'
UNION ALL
SELECT 
  'Usuários Cadastrados' AS item,
  COUNT(*)::TEXT || ' usuário(s)' AS detalhe,
  'INFO' AS resultado
FROM public.profiles
UNION ALL
SELECT 
  'Master Admins' AS item,
  COUNT(*)::TEXT || ' admin(s) promovido(s)' AS detalhe,
  CASE WHEN COUNT(*) > 0 THEN 'OK (PRONTO PARA TESTE)' ELSE 'CADASTRAR E PROMOVER MASTER' END AS resultado
FROM public.profiles WHERE is_master_admin = TRUE;
