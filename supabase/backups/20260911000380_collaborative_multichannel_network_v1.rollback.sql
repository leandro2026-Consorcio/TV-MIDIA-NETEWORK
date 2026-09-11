-- Rollback de emergência da Rede Colaborativa V1.
-- Não executa automaticamente. Preserva campanhas/ledgers existentes e só deve ser usado
-- antes do piloto, após auditoria de dependências e backup do banco.
BEGIN;
DROP TRIGGER IF EXISTS trg_prevent_collaborative_self_reward ON public.offer_acceptances;
DROP FUNCTION IF EXISTS public.prevent_collaborative_self_reward();
DROP TRIGGER IF EXISTS trg_validate_collaborative_channel_owner ON public.collaborative_channel_settings;
DROP FUNCTION IF EXISTS public.validate_collaborative_channel_owner();
DROP VIEW IF EXISTS public.collaborative_campaign_budget_summary;
DROP FUNCTION IF EXISTS public.finalize_collaborative_publication(UUID,UUID,JSONB,TEXT);
DROP FUNCTION IF EXISTS public.release_campaign_acceptance(UUID,TEXT,TEXT);
DROP FUNCTION IF EXISTS public.accept_campaign_offer(UUID,TEXT,UUID,UUID,INTEGER,TEXT);
DROP FUNCTION IF EXISTS public._post_media_right_entry(UUID,UUID,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,UUID,TEXT,TIMESTAMPTZ,JSONB);
DROP FUNCTION IF EXISTS public.create_collaborative_campaign(UUID,TEXT,TEXT,DATE,DATE,TEXT,NUMERIC,JSONB,TEXT);
DROP TABLE IF EXISTS public.business_media_score_snapshots;
DROP TABLE IF EXISTS public.business_media_score_rules;
DROP TABLE IF EXISTS public.collaborative_settlements;
DROP TABLE IF EXISTS public.campaign_budget_reservations;
DROP TABLE IF EXISTS public.media_right_ledger;
DROP TABLE IF EXISTS public.media_right_accounts;
DROP TABLE IF EXISTS public.offer_acceptances;
DROP TABLE IF EXISTS public.campaign_offers;
DROP TABLE IF EXISTS public.collaborative_inventory;
DROP TABLE IF EXISTS public.collaborative_channel_settings;
DROP TABLE IF EXISTS public.campaign_distribution_rules;
DROP TABLE IF EXISTS public.playlist_campaign_items;
DELETE FROM public.platform_settings WHERE key IN(
 'collaborative_media_network_enabled','collaborative_creator_offers_enabled',
 'collaborative_business_channels_enabled','collaborative_campaign_rewards_enabled'
);
-- Colunas aditivas ficam preservadas para evitar perda de dados em rollback emergencial.
COMMIT;
