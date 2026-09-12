DROP FUNCTION IF EXISTS public.screen_capacity_status(UUID);
DROP FUNCTION IF EXISTS public.calculate_screen_planned_minutes(UUID,DATE,DATE);
DROP TABLE IF EXISTS public.partner_activation_coupons;
DROP TABLE IF EXISTS public.screen_capacity_preferences;
DROP TABLE IF EXISTS public.screen_capacity_certifications;
DROP TABLE IF EXISTS public.screen_capacity_daily;
DROP TABLE IF EXISTS public.screen_schedule_exceptions;
DROP TABLE IF EXISTS public.screen_operating_schedules;
ALTER TABLE public.inventory_capacity_periods DROP CONSTRAINT IF EXISTS capacity_rights_within_target, DROP CONSTRAINT IF EXISTS capacity_sold_within_commercial,
 DROP COLUMN IF EXISTS plan_snapshot, DROP COLUMN IF EXISTS cycle_number, DROP COLUMN IF EXISTS rights_released, DROP COLUMN IF EXISTS rights_target,
 DROP COLUMN IF EXISTS sold_inventory, DROP COLUMN IF EXISTS commercial_inventory, DROP COLUMN IF EXISTS sponsor_reserve, DROP COLUMN IF EXISTS mpm_reserve,
 DROP COLUMN IF EXISTS own_inventory, DROP COLUMN IF EXISTS certified_capacity, DROP COLUMN IF EXISTS available_minutes, DROP COLUMN IF EXISTS planned_minutes, DROP COLUMN IF EXISTS plan_version_id;
DELETE FROM public.screen_capacity_plan_versions WHERE code IN('mpm_standard','racon_partner_free','racon_partner_additional');
DROP TABLE IF EXISTS public.screen_capacity_plan_versions;
DELETE FROM public.partner_programs p WHERE p.code='racon-homologacao' AND NOT EXISTS(SELECT 1 FROM public.partnership_enrollments e WHERE e.program_id=p.id);
DELETE FROM public.platform_settings WHERE key IN('dynamic_screen_capacity_enabled','screen_capacity_certification_enabled','screen_commercial_inventory_enabled','screen_inventory_sales_enabled','partner_sponsor_inventory_enabled','racon_partner_program_enabled','capacity_based_media_release_enabled','real_inventory_billing_enabled','real_inventory_payout_enabled','screen_capacity_defaults');
