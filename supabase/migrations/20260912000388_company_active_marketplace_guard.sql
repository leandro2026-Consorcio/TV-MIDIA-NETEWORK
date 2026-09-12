-- Estado canônico mínimo para impedir exposição de inventário de empresa desativada.
-- Preserva todas as empresas existentes como ativas; nenhuma associação é alterada.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_companies_marketplace_active
  ON public.companies (show_in_marketplace, is_active)
  WHERE show_in_marketplace = TRUE AND is_active = TRUE;

COMMENT ON COLUMN public.companies.is_active
IS 'Controla disponibilidade operacional da empresa; empresas inativas não aparecem na projeção do Marketplace.';
