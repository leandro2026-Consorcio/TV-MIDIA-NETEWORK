-- Hotfix técnico: pgcrypto está em schema de extensão no Production.
-- Usa gen_random_uuid (disponível no pg_catalog) e preserva o contrato de 12 caracteres.
CREATE OR REPLACE FUNCTION public.generate_referral_public_code() RETURNS TEXT
LANGUAGE plpgsql VOLATILE SET search_path=public,pg_temp AS $$
DECLARE code TEXT;
BEGIN
 LOOP
  code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  EXIT WHEN NOT EXISTS(SELECT 1 FROM public.campaign_referrals WHERE public_code=code);
 END LOOP;
 RETURN code;
END $$;
