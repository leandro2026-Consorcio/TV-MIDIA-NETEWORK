-- Estorno de compra MPM: devolve apenas a parcela ainda não entregue.
CREATE OR REPLACE FUNCTION public.mpm_cancel_media_purchase(p_order_id UUID,p_reason TEXT,p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_order public.ad_offer_orders%ROWTYPE;
  v_res public.wallet_reservations%ROWTYPE;
  v_delivery public.ad_order_delivery_ledger%ROWTYPE;
  v_line RECORD;
  v_fraction NUMERIC(18,8);
  v_refund NUMERIC(18,4);
  v_total NUMERIC(18,4):=0;
BEGIN
  IF NULLIF(trim(p_reason),'') IS NULL OR NULLIF(trim(p_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'Motivo e chave de idempotência são obrigatórios.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mpm-cancel-order:'||p_order_id::text,0));
  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id=p_order_id FOR UPDATE;
  IF v_order.id IS NULL OR v_order.payment_method<>'mpm_credits' OR NOT public.mpm_can_manage_company(v_order.buyer_company_id) THEN
    RAISE EXCEPTION 'Compra MPM inválida ou acesso negado.';
  END IF;
  IF v_order.status='cancelled' THEN
    SELECT COALESCE(sum(amount),0) INTO v_total FROM public.wallet_ledger
    WHERE source_type='reversal' AND idempotency_key LIKE p_idempotency_key||':%';
    RETURN jsonb_build_object('success',true,'deduplicated',true,'refunded_credits',v_total);
  END IF;
  SELECT * INTO v_res FROM public.wallet_reservations WHERE id=v_order.wallet_reservation_id FOR UPDATE;
  SELECT * INTO v_delivery FROM public.ad_order_delivery_ledger WHERE order_id=v_order.id FOR UPDATE;
  IF v_res.id IS NULL OR v_res.status<>'consumed' OR v_delivery.id IS NULL THEN RAISE EXCEPTION 'Reserva capturada ou delivery ledger não encontrado.'; END IF;
  IF v_delivery.credits_contracted<=0 OR v_delivery.credits_remaining<=0 THEN RAISE EXCEPTION 'Não há parcela não entregue para estorno.'; END IF;
  v_fraction:=v_delivery.credits_remaining/v_delivery.credits_contracted;
  FOR v_line IN
    SELECT l.*,a.credit_class FROM public.wallet_reservation_lines l JOIN public.wallet_accounts a ON a.id=l.account_id
    WHERE l.reservation_id=v_res.id ORDER BY a.credit_class
  LOOP
    v_refund:=round(v_line.amount*v_fraction,4);
    IF v_refund>0 THEN
      IF v_line.consumed_ledger_id IS NULL THEN RAISE EXCEPTION 'Linha de reserva sem débito capturado.'; END IF;
      PERFORM public._mpm_post_entry(v_line.account_id,'reversal','credit',v_refund,v_refund,0,0,'reversal',v_line.consumed_ledger_id,
        p_idempotency_key||':'||v_line.credit_class,v_order.campaign_id,NULL,NULL,v_line.consumed_ledger_id,
        jsonb_build_object('reason',p_reason,'order_id',v_order.id,'undelivered_fraction',v_fraction));
      v_total:=v_total+v_refund;
    END IF;
  END LOOP;
  UPDATE public.wallet_reservations SET status='cancelled',metadata=metadata||jsonb_build_object('cancellation_reason',p_reason,'refunded_credits',v_total),updated_at=now() WHERE id=v_res.id;
  UPDATE public.inventory_allocations SET status='cancelled',release_policy=release_policy||jsonb_build_object('cancellation_reason',p_reason),updated_at=now()
    WHERE campaign_id=v_order.campaign_id AND status NOT IN ('cancelled','released','expired');
  UPDATE public.ad_order_delivery_ledger SET status='cancelled',updated_at=now() WHERE id=v_delivery.id;
  UPDATE public.campaigns SET status='cancelled',updated_at=now() WHERE id=v_order.campaign_id;
  UPDATE public.ad_offer_orders SET status='cancelled',payment_status='refunded',payment_metadata=COALESCE(payment_metadata,'{}'::jsonb)||jsonb_build_object('mpm_refunded_credits',v_total,'reason',p_reason),updated_at=now() WHERE id=v_order.id;
  RETURN jsonb_build_object('success',true,'refunded_credits',v_total,'delivered_credits',v_delivery.credits_delivered,'undelivered_credits',v_delivery.credits_remaining);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mpm_cancel_media_purchase(UUID,TEXT,TEXT) TO authenticated,service_role;
