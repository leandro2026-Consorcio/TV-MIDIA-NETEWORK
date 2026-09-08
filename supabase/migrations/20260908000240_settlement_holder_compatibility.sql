-- Preenche o titular genérico para settlements indoor legados.
CREATE OR REPLACE FUNCTION public.sync_settlement_supplier_holder()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.supplier_holder_id IS NULL AND NEW.seller_company_id IS NOT NULL THEN
  NEW.supplier_holder_type:='company'; NEW.supplier_holder_id:=NEW.seller_company_id;
 END IF;
 IF NEW.supplier_holder_id IS NULL THEN RAISE EXCEPTION 'Titular fornecedor do settlement é obrigatório.'; END IF;
 IF NEW.supplier_holder_type='company' AND NEW.seller_company_id IS DISTINCT FROM NEW.supplier_holder_id THEN RAISE EXCEPTION 'Empresa exibidora diverge do titular fornecedor.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_sync_settlement_supplier_holder BEFORE INSERT OR UPDATE OF seller_company_id,supplier_holder_type,supplier_holder_id
ON public.settlement_entries FOR EACH ROW EXECUTE FUNCTION public.sync_settlement_supplier_holder();
