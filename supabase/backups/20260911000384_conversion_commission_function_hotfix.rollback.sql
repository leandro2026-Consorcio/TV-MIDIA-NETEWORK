-- Rollback da 384: restaura a assinatura interna anterior da função.
DO $rollback$
DECLARE definition TEXT;
BEGIN
 SELECT pg_get_functiondef('public.apply_conversion_event(uuid,text,text,jsonb,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'calculate_conversion_commission(rule.id,','calculate_conversion_commission(rule,');
 definition:=replace(definition,'v_commission_id UUID; gross','commission_id UUID; gross');
 definition:=replace(definition,'INTO v_commission_id','INTO commission_id');
 definition:=replace(definition,'IF v_commission_id IS NULL','IF commission_id IS NULL');
 definition:=replace(definition,'VALUES(v_commission_id,l.creator_id','VALUES(commission_id,l.creator_id');
 definition:=replace(definition,'id=v_commission_id AND','id=commission_id AND');
 definition:=replace(definition,'VALUES(v_commission_id,sale_id','VALUES(commission_id,sale_id');
 definition:=replace(definition,'''forecast:''||v_commission_id::text','''forecast:''||commission_id::text');
 definition:=replace(definition,'''eligible:''||v_commission_id::text','''eligible:''||commission_id::text');
 definition:=replace(definition,'''commission_id'',v_commission_id','''commission_id'',commission_id');
 EXECUTE definition;
END $rollback$;
