BEGIN;
SET LOCAL request.jwt.claim.role='service_role';

DO $test$
DECLARE
  v_company UUID;
  v_creator_user UUID;
  v_creator UUID;
  v_channel UUID;
  v_rate_card UUID;
  v_quote JSONB;
  v_quote_id UUID;
  v_old_unit NUMERIC;
  v_dyn_price JSONB;
  v_contract UUID;
  v_campaign UUID;
  v_pub UUID;
  v_proof JSONB;
  v_showcase JSONB;
  v_residential_screen UUID;
  v_commercial_screen UUID;
BEGIN
  -- 1. Criação de entidades de teste
  INSERT INTO public.companies(trade_name, city, state, show_in_marketplace, show_on_map)
  VALUES('Empresa Compradora Teste', 'Sinop', 'MT', true, true) RETURNING id INTO v_company;

  INSERT INTO public.profiles(id, full_name, email, role)
  VALUES(gen_random_uuid(), 'Creator Teste Perfil', 'creator_teste@midiapormidia.com.br', 'authenticated')
  RETURNING id INTO v_creator_user;

  INSERT INTO public.creator_profiles(user_id, display_name, city, state, niches, is_public_profile, status, creator_score, media_value_score, tier, slug)
  VALUES(v_creator_user, 'Creator Teste', 'Sinop', 'MT', ARRAY['gastronomia','moda'], true, 'active', 85.0, 90.0, 'pro', 'creator-teste-sinop')
  RETURNING id INTO v_creator;

  -- 2. Teste Dynamic Pricing Engine
  v_dyn_price := public.calculate_creator_dynamic_price(v_creator, 'feed');
  IF (v_dyn_price->>'suggested_price_credits')::numeric <= 0 THEN
    RAISE EXCEPTION 'FAIL: dynamic pricing retornou valor não positivo: %', v_dyn_price;
  END IF;

  -- 3. Teste Rate Card
  v_rate_card := public.set_creator_rate_card(v_creator, NULL, 'feed', 120.00, 48, true);
  IF v_rate_card IS NULL THEN
    RAISE EXCEPTION 'FAIL: falha ao definir rate card do creator';
  END IF;

  -- 4. Teste Cotação com congelamento de preço
  v_quote := public.quote_creator_media(
    v_company, v_creator, 'feed', 2, now(), now() + interval '7 days', 'stage2:quote:1'
  );
  v_quote_id := (v_quote->>'quote_id')::uuid;
  v_old_unit := (v_quote->>'unit_price_credits')::numeric;

  IF v_quote_id IS NULL OR v_old_unit <= 0 THEN
    RAISE EXCEPTION 'FAIL: cotação creator inválida: %', v_quote;
  END IF;

  -- Idempotência de cotação
  IF (public.quote_creator_media(v_company, v_creator, 'feed', 2, now(), now() + interval '7 days', 'stage2:quote:1')->>'quote_id')::uuid <> v_quote_id THEN
    RAISE EXCEPTION 'FAIL: cotação creator não é idempotente';
  END IF;

  -- Alteração posterior de rate card NÃO altera cotação anterior congelada
  PERFORM public.set_creator_rate_card(v_creator, NULL, 'feed', 500.00, 24, true);
  IF (SELECT unit_price_credits FROM public.media_price_quotes WHERE id = v_quote_id) <> v_old_unit THEN
    RAISE EXCEPTION 'FAIL: alteração de rate card alterou cotação congelada antiga';
  END IF;

  -- 5. Teste Telas: Comercial vs Residencial
  INSERT INTO public.screens(company_id, name, orientation, status, venue_type, is_public_screen, show_on_map)
  VALUES(v_company, 'Tela Comercial Padaria', 'horizontal', 'online', 'retail', true, true)
  RETURNING id INTO v_commercial_screen;

  INSERT INTO public.screens(company_id, name, orientation, status, venue_type, is_public_screen, show_on_map)
  VALUES(v_company, 'Tela Residencial Privada', 'horizontal', 'online', 'residential', false, false)
  RETURNING id INTO v_residential_screen;

  -- 6. Teste Vitrine Pública: Não deve expor telas residenciais nem creators privados
  v_showcase := public.get_public_showcase_data();
  IF (v_showcase->'locations') @> jsonb_build_array(jsonb_build_object('id', v_residential_screen)) THEN
    RAISE EXCEPTION 'FAIL: tela residencial privada apareceu na vitrine pública!';
  END IF;

  -- 7. Teste Perfil Público do Creator
  IF (public.get_creator_public_profile('creator-teste-sinop')->>'display_name') <> 'Creator Teste' THEN
    RAISE EXCEPTION 'FAIL: perfil público por slug não retornou creator';
  END IF;

  -- 8. Teste Prova Social e Settlement
  INSERT INTO public.campaigns(company_id, name, status, start_date, end_date)
  VALUES(v_company, 'Campanha Omnichannel Teste', 'active', current_date, current_date + 7)
  RETURNING id INTO v_campaign;

  INSERT INTO public.social_connections(owner_type, owner_id, provider, provider_account_id, status)
  VALUES('creator', v_creator, 'facebook', 'fb-acc-12345', 'active');

  INSERT INTO public.social_channels(
    connection_id, owner_type, owner_id, provider, channel_type, provider_channel_id,
    display_name, participation_enabled, status, feed_publish_capable
  ) VALUES (
    (SELECT id FROM public.social_connections WHERE provider_account_id = 'fb-acc-12345'),
    'creator', v_creator, 'facebook', 'facebook_page', 'fb-page-12345',
    'Página Teste Creator', true, 'active', true
  ) RETURNING id INTO v_channel;

  v_contract := public.create_media_commercial_contract(
    v_quote_id, v_campaign, 'creator', v_creator, 'stage2:contract:1'
  );

  INSERT INTO public.social_publications(
    channel_id, campaign_id, creator_id, format, status, idempotency_key
  ) VALUES (
    v_channel, v_campaign, v_creator, 'feed', 'published', 'stage2:pub:1'
  ) RETURNING id INTO v_pub;

  v_proof := public.submit_social_proof_of_publication(
    v_pub, v_contract, 'meta-post-999',
    jsonb_build_object('permalink', 'https://facebook.com/post/999', 'verified_at', now()),
    'stage2:proof:1'
  );

  IF (v_proof->>'success')::boolean <> true THEN
    RAISE EXCEPTION 'FAIL: submit_social_proof_of_publication falhou: %', v_proof;
  END IF;

  IF (SELECT status FROM public.social_publications WHERE id = v_pub) <> 'validated' THEN
    RAISE EXCEPTION 'FAIL: status da publicação não foi validado';
  END IF;

  -- Verifica se gerou settlement sem criar crédito MPM indevido
  IF NOT EXISTS(SELECT 1 FROM public.settlement_entries WHERE commercial_contract_id = v_contract) THEN
    RAISE EXCEPTION 'FAIL: settlement entry não gerado para publicação';
  END IF;

  -- Garante que não criou créditos indevidos fora das regras
  IF EXISTS(SELECT 1 FROM public.wallet_ledger WHERE source_type = 'social_publication' AND operation_type = 'grant') THEN
    RAISE EXCEPTION 'FAIL: publicação gerou crédito MPM indevido';
  END IF;

END
$test$;

ROLLBACK;
