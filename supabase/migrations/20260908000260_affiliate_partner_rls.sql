-- Identidade e isolamento de afiliados/parceiros nos holders genéricos.
CREATE OR REPLACE FUNCTION public.mpm_can_manage_holder(p_holder_type TEXT,p_holder_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
 SELECT auth.role()='service_role' OR public.is_master_admin() OR
   (p_holder_type='company' AND p_holder_id IN (SELECT public.get_user_admin_company_ids())) OR
   (p_holder_type='organic_participant' AND EXISTS(SELECT 1 FROM public.organic_participants WHERE id=p_holder_id AND user_id=auth.uid())) OR
   (p_holder_type='creator' AND EXISTS(SELECT 1 FROM public.creator_profiles WHERE id=p_holder_id AND user_id=auth.uid())) OR
   (p_holder_type='affiliate' AND EXISTS(SELECT 1 FROM public.affiliate_profiles WHERE id=p_holder_id AND (user_id=auth.uid() OR company_id IN (SELECT public.get_user_admin_company_ids())))) OR
   (p_holder_type='partner' AND p_holder_id IN (SELECT public.get_user_admin_company_ids()));
$$;

DROP POLICY IF EXISTS "MPM accounts holder read" ON public.wallet_accounts;
CREATE POLICY "MPM accounts holder read" ON public.wallet_accounts FOR SELECT TO authenticated USING(
 public.mpm_can_manage_holder(holder_type,holder_id) OR
 (holder_type='company' AND holder_id IN (SELECT public.get_user_company_ids()))
);
DROP POLICY IF EXISTS "MPM ledger holder read" ON public.wallet_ledger;
CREATE POLICY "MPM ledger holder read" ON public.wallet_ledger FOR SELECT TO authenticated USING(
 public.mpm_can_manage_holder(holder_type,holder_id) OR
 (holder_type='company' AND holder_id IN (SELECT public.get_user_company_ids()))
);
DROP POLICY IF EXISTS "Commissions beneficiary read" ON public.recurring_commissions;
CREATE POLICY "Commissions beneficiary read" ON public.recurring_commissions FOR SELECT TO authenticated USING(public.mpm_can_manage_holder(beneficiary_type,beneficiary_id));
DROP POLICY IF EXISTS "Attributions holder read" ON public.acquisition_attributions;
CREATE POLICY "Attributions holder read" ON public.acquisition_attributions FOR SELECT TO authenticated USING(public.mpm_can_manage_holder(attributed_holder_type,attributed_holder_id) OR converted_company_id IN (SELECT public.get_user_company_ids()));
DROP POLICY IF EXISTS "Enrollments participant read" ON public.partnership_enrollments;
CREATE POLICY "Enrollments participant read" ON public.partnership_enrollments FOR SELECT TO authenticated USING(public.mpm_can_manage_holder(participant_type,participant_id));
DROP POLICY IF EXISTS "Entitlements beneficiary read" ON public.inventory_entitlements;
CREATE POLICY "Entitlements beneficiary read" ON public.inventory_entitlements FOR SELECT TO authenticated USING(public.mpm_can_manage_holder(beneficiary_type,beneficiary_id));
DROP POLICY IF EXISTS "Payout accounts holder read" ON public.payout_accounts;
CREATE POLICY "Payout accounts holder read" ON public.payout_accounts FOR SELECT TO authenticated USING(public.mpm_can_manage_holder(holder_type,holder_id));
