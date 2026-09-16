-- Gestão canônica de usuários e acessos por empresa.
-- Reutiliza company_users, preserva Master global e mantém roles legadas
-- somente para compatibilidade com registros históricos.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.company_users
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.company_users
SET accepted_at = COALESCE(accepted_at, created_at), updated_at = COALESCE(updated_at, created_at)
WHERE accepted_at IS NULL;

CREATE OR REPLACE FUNCTION public.fill_company_user_access_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.accepted_at := COALESCE(NEW.accepted_at, NOW());
  NEW.updated_at := COALESCE(NEW.updated_at, NOW());
  NEW.created_by := COALESCE(
    NEW.created_by,
    CASE WHEN NEW.role = 'admin' AND NOT EXISTS (
      SELECT 1 FROM public.company_users WHERE company_id = NEW.company_id
    ) THEN NEW.user_id ELSE auth.uid() END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_company_user_access_metadata ON public.company_users;
CREATE TRIGGER trg_fill_company_user_access_metadata
BEFORE INSERT ON public.company_users
FOR EACH ROW EXECUTE FUNCTION public.fill_company_user_access_metadata();

ALTER TABLE public.company_users DROP CONSTRAINT IF EXISTS company_users_role_check;
ALTER TABLE public.company_users
  ADD CONSTRAINT company_users_role_check
  CHECK (role IN ('admin', 'marketing', 'operator', 'external'));

CREATE TABLE IF NOT EXISTS public.company_user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'marketing')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  provisioned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_user_invites_company ON public.company_user_invites(company_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_user_invites_pending_email
  ON public.company_user_invites(company_id, lower(email)) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.is_company_admin(
  p_company_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_master_admin() OR EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id AND user_id = p_user_id
      AND role = 'admin' AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.invite_company_user(
  p_company_id UUID,
  p_email TEXT,
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_email TEXT := lower(btrim(COALESCE(p_email, '')));
  v_token TEXT;
  v_invite public.company_user_invites%ROWTYPE;
  v_existing_user UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_company_admin(p_company_id, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas ADMIN da empresa ou MASTER pode convidar usuários.';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'E-mail inválido.';
  END IF;
  IF p_role NOT IN ('admin', 'marketing') THEN
    RAISE EXCEPTION 'Perfil inválido.';
  END IF;

  SELECT id INTO v_existing_user FROM public.profiles WHERE lower(email) = v_email LIMIT 1;
  IF v_existing_user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id AND user_id = v_existing_user AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Este usuário já possui acesso ativo à empresa.';
  END IF;

  UPDATE public.company_user_invites
  SET status = 'expired', updated_at = NOW()
  WHERE company_id = p_company_id AND lower(email) = v_email
    AND status = 'pending' AND expires_at <= NOW();

  IF EXISTS (
    SELECT 1 FROM public.company_user_invites
    WHERE company_id = p_company_id AND lower(email) = v_email
      AND status = 'pending' AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Já existe um convite pendente para este e-mail.';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.company_user_invites (
    company_id, email, role, token_hash, invited_by
  ) VALUES (
    p_company_id, v_email, p_role,
    encode(digest(v_token, 'sha256'), 'hex'), auth.uid()
  ) RETURNING * INTO v_invite;

  INSERT INTO public.audit_logs(user_id, company_id, action, details)
  VALUES (auth.uid(), p_company_id, 'USER_INVITED', jsonb_build_object(
    'invite_id', v_invite.id, 'target_user_id', v_existing_user,
    'role', p_role, 'email', v_email
  ));

  RETURN jsonb_build_object(
    'id', v_invite.id, 'token', v_token, 'expires_at', v_invite.expires_at,
    'user_exists', v_existing_user IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_company_user_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_invite public.company_user_invites%ROWTYPE;
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para aceitar o convite.'; END IF;
  SELECT lower(email) INTO v_email FROM public.profiles WHERE id = auth.uid();

  SELECT * INTO v_invite FROM public.company_user_invites
  WHERE token_hash = encode(digest(btrim(p_token), 'sha256'), 'hex')
  FOR UPDATE;
  IF NOT FOUND OR v_invite.status <> 'pending' THEN RAISE EXCEPTION 'Convite inválido ou já utilizado.'; END IF;
  IF v_invite.expires_at <= NOW() THEN
    UPDATE public.company_user_invites SET status = 'expired', updated_at = NOW() WHERE id = v_invite.id;
    RAISE EXCEPTION 'Convite expirado.';
  END IF;
  IF v_email IS NULL OR v_email <> lower(v_invite.email) THEN
    RAISE EXCEPTION 'Entre com a conta correspondente ao e-mail convidado.';
  END IF;

  INSERT INTO public.company_users(company_id, user_id, role, is_active, created_by, accepted_at, updated_at)
  VALUES (v_invite.company_id, auth.uid(), v_invite.role, TRUE, v_invite.invited_by, NOW(), NOW())
  ON CONFLICT (company_id, user_id) DO UPDATE SET
    role = EXCLUDED.role, is_active = TRUE, created_by = EXCLUDED.created_by,
    accepted_at = NOW(), updated_at = NOW();

  UPDATE public.company_user_invites SET
    status = 'accepted', accepted_at = NOW(), accepted_user_id = auth.uid(), updated_at = NOW()
  WHERE id = v_invite.id;

  INSERT INTO public.audit_logs(user_id, company_id, action, details)
  VALUES (auth.uid(), v_invite.company_id, 'USER_JOINED', jsonb_build_object(
    'invite_id', v_invite.id, 'target_user_id', auth.uid(), 'role', v_invite.role
  ));
  RETURN jsonb_build_object('company_id', v_invite.company_id, 'role', v_invite.role);
END;
$$;

CREATE OR REPLACE FUNCTION public.change_company_user_role(
  p_company_id UUID,
  p_target_user_id UUID,
  p_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE v_old_role TEXT; v_active BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_company_admin(p_company_id, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas ADMIN da empresa ou MASTER pode alterar perfis.';
  END IF;
  IF p_role NOT IN ('admin', 'marketing') THEN RAISE EXCEPTION 'Perfil inválido.'; END IF;
  -- Serializa alterações administrativas da mesma empresa. Assim duas sessões
  -- não conseguem rebaixar simultaneamente os dois últimos ADMINs.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id::TEXT, 0));
  SELECT role, is_active INTO v_old_role, v_active FROM public.company_users
  WHERE company_id = p_company_id AND user_id = p_target_user_id FOR UPDATE;
  IF NOT FOUND OR NOT v_active THEN RAISE EXCEPTION 'Usuário ativo não encontrado nesta empresa.'; END IF;
  IF v_old_role = 'admin' AND p_role <> 'admin' AND (
    SELECT count(*) FROM public.company_users
    WHERE company_id = p_company_id AND role = 'admin' AND is_active = TRUE
  ) <= 1 THEN RAISE EXCEPTION 'A empresa precisa manter pelo menos um ADMIN ativo.'; END IF;

  UPDATE public.company_users SET role = p_role, updated_at = NOW()
  WHERE company_id = p_company_id AND user_id = p_target_user_id;
  INSERT INTO public.audit_logs(user_id, company_id, action, details)
  VALUES (auth.uid(), p_company_id, 'ROLE_CHANGED', jsonb_build_object(
    'target_user_id', p_target_user_id, 'old_role', v_old_role, 'new_role', p_role
  ));
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_company_user(
  p_company_id UUID,
  p_target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE v_role TEXT; v_active BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_company_admin(p_company_id, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas ADMIN da empresa ou MASTER pode remover usuários.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id::TEXT, 0));
  SELECT role, is_active INTO v_role, v_active FROM public.company_users
  WHERE company_id = p_company_id AND user_id = p_target_user_id FOR UPDATE;
  IF NOT FOUND OR NOT v_active THEN RAISE EXCEPTION 'Usuário ativo não encontrado nesta empresa.'; END IF;
  IF v_role = 'admin' AND (
    SELECT count(*) FROM public.company_users
    WHERE company_id = p_company_id AND role = 'admin' AND is_active = TRUE
  ) <= 1 THEN RAISE EXCEPTION 'A empresa precisa manter pelo menos um ADMIN ativo.'; END IF;

  UPDATE public.company_users SET is_active = FALSE, updated_at = NOW()
  WHERE company_id = p_company_id AND user_id = p_target_user_id;
  INSERT INTO public.audit_logs(user_id, company_id, action, details)
  VALUES (auth.uid(), p_company_id, 'USER_REMOVED', jsonb_build_object(
    'target_user_id', p_target_user_id, 'old_role', v_role
  ));
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_company_user_access(p_company_id UUID)
RETURNS TABLE(
  membership_id UUID, user_id UUID, full_name TEXT, email TEXT, role TEXT,
  is_active BOOLEAN, created_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_company_admin(p_company_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado à gestão de usuários.';
  END IF;
  RETURN QUERY SELECT cu.id, cu.user_id, p.full_name, p.email, cu.role, cu.is_active,
    cu.created_at, cu.accepted_at, au.last_sign_in_at
  FROM public.company_users cu
  JOIN public.profiles p ON p.id = cu.user_id
  LEFT JOIN auth.users au ON au.id = cu.user_id
  WHERE cu.company_id = p_company_id
  ORDER BY cu.is_active DESC, p.full_name NULLS LAST, p.email;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_company_user_invites(p_company_id UUID)
RETURNS TABLE(
  id UUID, email TEXT, role TEXT, status TEXT, invited_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_company_admin(p_company_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado à gestão de convites.';
  END IF;
  RETURN QUERY SELECT i.id, i.email, i.role, i.status, i.invited_at, i.expires_at, i.accepted_at
  FROM public.company_user_invites i WHERE i.company_id = p_company_id
  ORDER BY i.invited_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_last_company_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.is_active = TRUE THEN
    IF TG_OP = 'DELETE' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.company_users
        WHERE company_id = OLD.company_id AND role = 'admin' AND is_active = TRUE
          AND user_id <> OLD.user_id
      ) THEN
        RAISE EXCEPTION 'A empresa precisa manter pelo menos um ADMIN ativo.';
      END IF;
      RETURN OLD;
    END IF;

    IF (NEW.role <> 'admin' OR NEW.is_active = FALSE) AND NOT EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_id = OLD.company_id AND role = 'admin' AND is_active = TRUE
        AND user_id <> OLD.user_id
    ) THEN
      RAISE EXCEPTION 'A empresa precisa manter pelo menos um ADMIN ativo.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_last_company_admin ON public.company_users;
CREATE TRIGGER trg_protect_last_company_admin
BEFORE UPDATE OF role, is_active OR DELETE ON public.company_users
FOR EACH ROW EXECUTE FUNCTION public.protect_last_company_admin();

ALTER TABLE public.company_user_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CompanyUsers - Master Admin vê todos, Usuários vêem de suas empresas" ON public.company_users;
DROP POLICY IF EXISTS "CompanyUsers - Master Admin e Admins gerenciam membros" ON public.company_users;
CREATE POLICY "CompanyUsers - próprio vínculo, admins da empresa ou Master"
  ON public.company_users FOR SELECT TO authenticated
  USING (public.is_master_admin() OR user_id = auth.uid() OR public.is_company_admin(company_id, auth.uid()));

CREATE POLICY "CompanyInvites - admins da empresa ou Master leem"
  ON public.company_user_invites FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id, auth.uid()));

REVOKE ALL ON FUNCTION public.invite_company_user(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_company_user_invite(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_company_user_role(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_company_user(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_company_user_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_company_user_invites(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_company_user(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_company_user_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_company_user_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_company_user(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_company_user_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_company_user_invites(UUID) TO authenticated;

-- Diagnóstico seguro: não corrige empresas existentes por suposição. O resultado
-- pode ser consultado pelo Master e casos ambíguos permanecem para revisão.
CREATE OR REPLACE FUNCTION public.companies_without_active_admin()
RETURNS TABLE(company_id UUID, trade_name TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT c.id, c.trade_name, c.created_at FROM public.companies c
  WHERE public.is_master_admin() AND NOT EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = c.id AND cu.role = 'admin' AND cu.is_active = TRUE
  ) ORDER BY c.created_at;
$$;
REVOKE ALL ON FUNCTION public.companies_without_active_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.companies_without_active_admin() TO authenticated;
