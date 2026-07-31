-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 1: CORREÇÕES DE AUDITORIA E SEGURANÇA (AUDIT FIXES)
-- Data: 2026-07-31
-- ============================================================================

-- 1. PROTEÇÃO CONTRA AUTO-ELEVAÇÃO DE PERFIL (IS_MASTER_ADMIN)
-- Impede que um usuário comum envie UPDATE profiles SET is_master_admin = true
CREATE OR REPLACE FUNCTION public.prevent_self_master_admin_elevation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_master_admin IS DISTINCT FROM NEW.is_master_admin THEN
    -- Se quem está tentando mudar NÃO era Master Admin previamente
    IF NOT public.is_master_admin() THEN
      RAISE EXCEPTION 'Acesso negado: Apenas Master Admins existentes podem alterar o status is_master_admin.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_profile_master_admin_elevation ON public.profiles;
CREATE TRIGGER check_profile_master_admin_elevation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_master_admin_elevation();


-- 2. CORREÇÃO DE SEGURANÇA NA RPC PROCESS_CREDIT_TRANSACTION
-- Valida obrigatoriamente se o auth.uid() é Master Admin ou Admin da empresa que possui a carteira
CREATE OR REPLACE FUNCTION public.process_credit_transaction(
  p_company_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_source TEXT,
  p_description TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id UUID;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- 2.1 VALIDAÇÃO RIGOROSA DE PERMISSÃO DO CHAMADOR
  IF NOT (
    public.is_master_admin() OR 
    EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = p_company_id 
        AND user_id = v_caller_id 
        AND role = 'admin' 
        AND is_active = TRUE
    )
  ) THEN
    RAISE EXCEPTION 'Acesso Negado: Você não possui permissão de Administrador para movimentar créditos da empresa %', p_company_id;
  END IF;

  -- 2.2 VALIDAÇÃO DOS PARÂMETROS
  IF p_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'Tipo de transação inválido: %. Deve ser credit ou debit.', p_type;
  END IF;

  IF p_source NOT IN ('manual_grant', 'purchase', 'exchange_earn', 'campaign_spend', 'refund', 'system_bonus') THEN
    RAISE EXCEPTION 'Origem de transação inválida: %', p_source;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor da transação deve ser estritamente positivo. Valor informado: %', p_amount;
  END IF;

  -- 2.3 TRAVA PESSIMISTA (FOR UPDATE) NA CARTEIRA
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM public.wallets
  WHERE company_id = p_company_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Carteira não encontrada para a empresa %', p_company_id;
  END IF;

  -- 2.4 CÁLCULO E PROTEÇÃO CONTRA SALDO NEGATIVO
  IF p_type = 'credit' THEN
    v_new_balance := v_current_balance + ABS(p_amount);
  ELSE
    IF v_current_balance < ABS(p_amount) THEN
      RAISE EXCEPTION 'Saldo insuficiente na carteira. Saldo atual: %, Valor solicitado: %', v_current_balance, ABS(p_amount);
    END IF;
    v_new_balance := v_current_balance - ABS(p_amount);
  END IF;

  -- 2.5 ATUALIZAÇÃO DA CARTEIRA
  UPDATE public.wallets
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  -- 2.6 INSERÇÃO ATÔMICA NO EXTRATO IMUTÁVEL
  INSERT INTO public.wallet_transactions (
    wallet_id,
    company_id,
    previous_balance,
    amount,
    new_balance,
    type,
    source,
    description,
    user_id
  ) VALUES (
    v_wallet_id,
    p_company_id,
    v_current_balance,
    CASE WHEN p_type = 'credit' THEN ABS(p_amount) ELSE -ABS(p_amount) END,
    v_new_balance,
    p_type,
    p_source,
    p_description,
    COALESCE(p_user_id, v_caller_id)
  )
  RETURNING id INTO v_transaction_id;

  -- 2.7 AUDITORIA DO EVENTO
  PERFORM public.log_audit_event(
    COALESCE(p_user_id, v_caller_id),
    p_company_id,
    'CREDIT_TRANSACTION_PROCESSED',
    jsonb_build_object(
      'wallet_id', v_wallet_id,
      'previous_balance', v_current_balance,
      'amount', p_amount,
      'new_balance', v_new_balance,
      'type', p_type,
      'source', p_source,
      'description', p_description
    )
  );

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. AJUSTE DE RLS EM AUDIT_LOGS (PERMITIR INSERÇÃO APENAS PARA AÇÕES PRÓPRIAS)
DROP POLICY IF EXISTS "AuditLogs - Leitura para Master Admin ou Admins da empresa" ON public.audit_logs;

CREATE POLICY "AuditLogs - Leitura para Master Admin ou Admins da empresa"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

CREATE POLICY "AuditLogs - Inserção de eventos autorizados"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR is_master_admin()
  );
