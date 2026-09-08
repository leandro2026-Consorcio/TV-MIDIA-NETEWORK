-- A RPC de inventário já era concedida ao service_role, mas o helper não o
-- reconhecia. O papel pode operar; triggers de ownership/capacidade continuam
-- validando invariantes e impedindo overbooking.
CREATE OR REPLACE FUNCTION public.can_access_media_inventory(p_inventory_id UUID, p_require_admin BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_inventory public.media_inventory%ROWTYPE;
BEGIN
  IF auth.role() = 'service_role' OR public.is_master_admin() THEN RETURN TRUE; END IF;
  SELECT * INTO v_inventory FROM public.media_inventory WHERE id = p_inventory_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_inventory.owner_type = 'company' THEN
    IF p_require_admin THEN RETURN v_inventory.owner_id IN (SELECT public.get_user_admin_company_ids()); END IF;
    RETURN v_inventory.owner_id IN (SELECT public.get_user_company_ids());
  END IF;
  IF v_inventory.owner_type = 'organic_participant' AND NOT p_require_admin THEN
    RETURN EXISTS (SELECT 1 FROM public.organic_participants WHERE id=v_inventory.owner_id AND user_id=auth.uid());
  END IF;
  RETURN FALSE;
END;
$$;
