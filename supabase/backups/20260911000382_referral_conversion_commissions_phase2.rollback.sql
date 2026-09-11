-- Rollback emergencial da Fase 2. Não executar após operação real sem exportar os ledgers.
BEGIN;
DROP FUNCTION IF EXISTS public.get_my_referral_funnel();
DROP FUNCTION IF EXISTS public.consume_integration_rate_limit(UUID,INTEGER);
DROP FUNCTION IF EXISTS public.simulate_commission_receipt(UUID,TEXT);
DROP FUNCTION IF EXISTS public.create_commission_closing(UUID,DATE,DATE,TEXT,BOOLEAN);
DROP FUNCTION IF EXISTS public.apply_conversion_event(UUID,TEXT,TEXT,JSONB,TEXT);
DROP FUNCTION IF EXISTS public.calculate_conversion_commission(UUID,NUMERIC);
DROP FUNCTION IF EXISTS public.capture_referral_lead(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT);
DROP FUNCTION IF EXISTS public.ensure_campaign_referral(UUID,TEXT);
DROP FUNCTION IF EXISTS public.generate_referral_public_code();
DROP TABLE IF EXISTS public.integration_outbox,public.integration_request_windows,public.integration_events,public.integration_credentials,public.integration_partners;
DROP TABLE IF EXISTS public.creator_payables,public.conversion_commission_ledger,public.commission_disputes,public.commission_closing_items,public.commission_closings,public.commission_receivables;
DROP TABLE IF EXISTS public.conversion_commissions,public.conversion_commission_rule_versions,public.conversion_sales,public.lead_lifecycle_events,public.referral_leads,public.referral_clicks,public.campaign_referrals,public.campaign_referral_settings,public.referral_attribution_rule_versions;
DROP TABLE IF EXISTS public.franchises,public.franchise_networks;
DELETE FROM public.platform_settings WHERE key IN('creator_referral_leads_enabled','external_lead_api_enabled','conversion_commissions_enabled','commission_billing_enabled','creator_cash_payout_enabled');
COMMIT;
