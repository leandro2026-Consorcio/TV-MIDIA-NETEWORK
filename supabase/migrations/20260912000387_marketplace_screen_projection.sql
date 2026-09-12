-- Projeção segura do Marketplace de TVs. Não altera ownership nem políticas privadas.
CREATE OR REPLACE FUNCTION public.get_marketplace_screens(
  p_viewer_company_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_venue_category TEXT DEFAULT NULL,
  p_orientation TEXT DEFAULT NULL,
  p_online_only BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_viewer_company_id IS NOT NULL AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Empresa visualizadora exige usuário autenticado.';
  END IF;

  IF p_viewer_company_id IS NOT NULL
     AND NOT (public.is_master_admin() OR p_viewer_company_id IN (SELECT public.get_user_company_ids())) THEN
    RAISE EXCEPTION 'Empresa visualizadora não autorizada.';
  END IF;

  WITH eligible AS (
    SELECT
      s.id,
      s.name,
      s.orientation,
      s.status,
      s.venue_type,
      COALESCE(NULLIF(s.venue_category, ''), seg.name, 'Comércio Local') AS venue_category,
      s.indicative_price_credits,
      s.public_address_masked,
      s.show_on_map AND c.show_on_map AND c.map_privacy_level <> 'hidden' AS map_enabled,
      c.id AS company_id,
      CASE WHEN c.show_name_publicly THEN c.trade_name ELSE 'Empresa Parceira' END AS company_name,
      CASE WHEN c.show_location_publicly THEN c.city ELSE NULL END AS city,
      CASE WHEN c.show_location_publicly THEN c.state ELSE NULL END AS state,
      (p_viewer_company_id IS NOT NULL AND c.id = p_viewer_company_id) AS is_own,
      cap.has_period,
      COALESCE(cap.available_capacity, 0) AS available_capacity
    FROM public.screens s
    JOIN public.companies c ON c.id = s.company_id
    LEFT JOIN public.company_network_preferences np ON np.company_id = c.id
    LEFT JOIN LATERAL (
      SELECT sg.name
      FROM public.company_segments cs
      JOIN public.segments sg ON sg.id = cs.segment_id
      WHERE cs.company_id = c.id
      ORDER BY cs.is_primary DESC NULLS LAST, sg.name
      LIMIT 1
    ) seg ON TRUE
    LEFT JOIN public.media_inventory mi
      ON mi.source_type = 'company_screen' AND mi.source_id = s.id AND mi.status = 'active'
    LEFT JOIN LATERAL (
      SELECT TRUE AS has_period, SUM(icp.available_capacity)::BIGINT AS available_capacity
      FROM public.inventory_capacity_periods icp
      WHERE icp.media_inventory_id = mi.id
        AND icp.status = 'active'
        AND CURRENT_DATE BETWEEN icp.period_start AND icp.period_end
      HAVING COUNT(*) > 0
    ) cap ON TRUE
    WHERE s.is_public_screen = TRUE
      AND s.venue_type <> 'residential'
      AND s.status = 'online'
      AND c.is_active = TRUE
      AND c.show_in_marketplace = TRUE
      AND COALESCE(np.accepts_network_ads, TRUE) = TRUE
  ), filtered AS (
    SELECT *,
      CASE WHEN has_period AND available_capacity <= 0
        THEN 'temporarily_unavailable' ELSE 'available' END AS availability
    FROM eligible e
    WHERE (p_search IS NULL OR btrim(p_search) = '' OR
      e.name ILIKE '%' || p_search || '%' OR e.company_name ILIKE '%' || p_search || '%' OR
      COALESCE(e.city, '') ILIKE '%' || p_search || '%' OR e.venue_category ILIKE '%' || p_search || '%')
      AND (p_city IS NULL OR btrim(p_city) = '' OR e.city = p_city)
      AND (p_venue_category IS NULL OR btrim(p_venue_category) = '' OR e.venue_category = p_venue_category)
      AND (p_orientation IS NULL OR btrim(p_orientation) = '' OR e.orientation = p_orientation)
      AND (NOT p_online_only OR e.status = 'online')
  )
  SELECT jsonb_build_object(
    'screens', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'orientation', orientation, 'status', status,
      'venueType', venue_type, 'venueCategory', venue_category,
      'indicativePriceCredits', indicative_price_credits,
      'publicAddressMasked', public_address_masked, 'mapEnabled', map_enabled,
      'companyId', company_id, 'companyName', company_name, 'city', city, 'state', state,
      'isOwn', is_own, 'availability', availability, 'availableCapacity', available_capacity
    ) ORDER BY city NULLS LAST, company_name, name), '[]'::jsonb),
    'cities', COALESCE((SELECT jsonb_agg(city ORDER BY city) FROM (SELECT DISTINCT city FROM eligible WHERE city IS NOT NULL) x), '[]'::jsonb),
    'categories', COALESCE((SELECT jsonb_agg(venue_category ORDER BY venue_category) FROM (SELECT DISTINCT venue_category FROM eligible) x), '[]'::jsonb)
  ) INTO v_result
  FROM filtered;

  RETURN COALESCE(v_result, jsonb_build_object('screens', '[]'::jsonb, 'cities', '[]'::jsonb, 'categories', '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.get_marketplace_screens(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketplace_screens(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_marketplace_screens(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN)
IS 'Projeção comercial segura: somente telas públicas, não residenciais, online, de empresas ativas e opt-in na rede.';
