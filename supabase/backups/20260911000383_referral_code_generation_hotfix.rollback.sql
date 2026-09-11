-- Rollback técnico da 383: restaura a definição originalmente publicada pela 382.
CREATE OR REPLACE FUNCTION public.generate_referral_public_code() RETURNS TEXT
LANGUAGE plpgsql VOLATILE SET search_path=public,pg_temp AS $$
DECLARE code TEXT;
BEGIN LOOP code:=upper(substr(encode(gen_random_bytes(12),'hex'),1,12)); EXIT WHEN NOT EXISTS(SELECT 1 FROM public.campaign_referrals WHERE public_code=code); END LOOP; RETURN code; END $$;
