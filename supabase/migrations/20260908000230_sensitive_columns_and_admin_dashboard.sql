-- Restringe material criptografado e o dashboard global ao servidor/Master.
REVOKE SELECT ON public.social_connections FROM authenticated,anon;
GRANT SELECT(id,owner_type,owner_id,provider,provider_account_id,token_key_version,scopes,status,connected_by,connected_at,expires_at,metadata,created_at,updated_at)
ON public.social_connections TO authenticated;
REVOKE SELECT ON public.payout_methods FROM authenticated,anon;
GRANT SELECT(id,payout_account_id,method_type,key_version,fingerprint,status,is_default,created_at)
ON public.payout_methods TO authenticated;
REVOKE SELECT ON public.mpm_admin_dashboard FROM authenticated,anon;

CREATE OR REPLACE FUNCTION public.get_mpm_admin_dashboard()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
DECLARE result JSONB;
BEGIN
 IF NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso exclusivo do Master Admin.'; END IF;
 SELECT to_jsonb(d) INTO result FROM public.mpm_admin_dashboard d;
 RETURN COALESCE(result,'{}'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.get_mpm_admin_dashboard() TO authenticated;
