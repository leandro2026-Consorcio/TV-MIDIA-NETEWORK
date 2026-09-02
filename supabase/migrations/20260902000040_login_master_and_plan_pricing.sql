-- Evita chamadas externas no middleware da tela de login (a parte de aplicação
-- está em src/lib/supabase/middleware.ts) e completa a configuração comercial.

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'subscription_plan_prices_cents',
  '{"1-tv":2990,"2-tvs":4990,"3-tvs":6990,"4-tvs":8990,"5-tvs":9990,"additional-tv":1499}'::jsonb,
  'Preços em centavos dos planos mensais exibidos no site público.'
)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "PlatformSettings - Public read" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Public read"
  ON public.platform_settings FOR SELECT TO anon, authenticated
  USING (key IN (
    'public_trial_signup_enabled',
    'public_trial_days',
    'trial_invites_count',
    'auto_approve_trial_internal_media',
    'public_signup_disabled_message',
    'subscription_plan_prices_cents'
  ));

-- A service role precisa conseguir criar o primeiro Master Admin. Usuários
-- comuns continuam impedidos de promover a si próprios.
CREATE OR REPLACE FUNCTION public.prevent_self_master_admin_elevation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF OLD.is_master_admin IS DISTINCT FROM NEW.is_master_admin
     AND auth.role() <> 'service_role'
     AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas Master Admins existentes podem alterar o status is_master_admin.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_master_admin_by_email(p_email TEXT, p_enabled BOOLEAN DEFAULT TRUE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Operação permitida somente ao serviço administrativo.';
  END IF;

  UPDATE public.profiles
  SET is_master_admin = p_enabled, updated_at = NOW()
  WHERE lower(email) = lower(btrim(p_email))
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado para o e-mail informado.';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (v_user_id, 'MASTER_ADMIN_ACCESS_CHANGED', jsonb_build_object('enabled', p_enabled));

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_master_admin_by_email(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_master_admin_by_email(TEXT, BOOLEAN) TO service_role;
