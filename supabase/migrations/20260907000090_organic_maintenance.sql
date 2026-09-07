-- Manutencao transacional da Rede Organica: libera creditos e devolve
-- automaticamente estoque/creditos de reservas que venceram sem uso.
CREATE OR REPLACE FUNCTION public.expire_organic_redemptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT r.id, r.participant_id, r.reward_id, r.credits_reserved
    FROM public.organic_reward_redemptions r
    WHERE r.status = 'reserved' AND r.expires_at <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.organic_reward_redemptions
      SET status = 'expired'
      WHERE id = v_row.id AND status = 'reserved';
    IF FOUND THEN
      UPDATE public.organic_participants
        SET available_balance = available_balance + v_row.credits_reserved, updated_at = NOW()
        WHERE id = v_row.participant_id;
      UPDATE public.organic_campaign_rewards
        SET quantity_reserved = GREATEST(0, quantity_reserved - 1),
            quantity_available = quantity_available + 1,
            updated_at = NOW()
        WHERE id = v_row.reward_id;
      INSERT INTO public.organic_credit_ledger(participant_id,reward_id,type,amount,balance_bucket,description,metadata)
      VALUES(v_row.participant_id,v_row.reward_id,'refund',v_row.credits_reserved,'available','Estorno automatico de reserva expirada',jsonb_build_object('redemption_id',v_row.id));
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_organic_redemptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_organic_redemptions() TO service_role;

CREATE OR REPLACE FUNCTION public.run_organic_maintenance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released INTEGER;
  v_expired INTEGER;
BEGIN
  SELECT public.release_organic_pending_credits() INTO v_released;
  SELECT public.expire_organic_redemptions() INTO v_expired;
  UPDATE public.organic_campaign_rewards SET status='expired', updated_at=NOW()
    WHERE status IN ('active','paused') AND expires_at <= NOW();
  UPDATE public.organic_screens SET status='offline', updated_at=NOW()
    WHERE status='online' AND (last_ping_at IS NULL OR last_ping_at < NOW() - INTERVAL '3 minutes');
  RETURN jsonb_build_object('released_participants',v_released,'expired_redemptions',v_expired);
END;
$$;

REVOKE ALL ON FUNCTION public.run_organic_maintenance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_organic_maintenance() TO service_role;
