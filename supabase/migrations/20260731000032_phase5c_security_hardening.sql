-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5C: HARDENING DO GATILHO DE REVISÃO E RLS
-- Data: 2026-07-31
-- ============================================================================

-- 1. ATUALIZAR FUNÇÃO DO GATILHO DE RESET COM IS DISTINCT FROM PARA TRATAMENTO DE NULL
CREATE OR REPLACE FUNCTION public.fn_reset_seller_financial_profile_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.verification_status = 'approved' AND (
    NEW.document_type IS DISTINCT FROM OLD.document_type OR
    NEW.document_number IS DISTINCT FROM OLD.document_number OR
    NEW.legal_name IS DISTINCT FROM OLD.legal_name OR
    NEW.responsible_name IS DISTINCT FROM OLD.responsible_name OR
    NEW.responsible_email IS DISTINCT FROM OLD.responsible_email OR
    NEW.responsible_phone IS DISTINCT FROM OLD.responsible_phone OR
    NEW.bank_code IS DISTINCT FROM OLD.bank_code OR
    NEW.bank_name IS DISTINCT FROM OLD.bank_name OR
    NEW.bank_agency IS DISTINCT FROM OLD.bank_agency OR
    NEW.bank_account IS DISTINCT FROM OLD.bank_account OR
    NEW.bank_account_digit IS DISTINCT FROM OLD.bank_account_digit OR
    NEW.bank_account_type IS DISTINCT FROM OLD.bank_account_type OR
    NEW.pix_key_type IS DISTINCT FROM OLD.pix_key_type OR
    NEW.pix_key IS DISTINCT FROM OLD.pix_key OR
    NEW.asaas_wallet_id IS DISTINCT FROM OLD.asaas_wallet_id OR
    NEW.asaas_account_id IS DISTINCT FROM OLD.asaas_account_id
  ) THEN
    NEW.verification_status := 'pending_review';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seller_financial_profile_reset_review ON public.seller_financial_profiles;

CREATE TRIGGER trg_seller_financial_profile_reset_review
  BEFORE UPDATE ON public.seller_financial_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_reset_seller_financial_profile_status();
