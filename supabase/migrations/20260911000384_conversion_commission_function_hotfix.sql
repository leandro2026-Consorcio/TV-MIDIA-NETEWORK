-- Hotfix técnico para a função já instalada pela 382.
-- Mantém a migration idempotente em bancos novos, onde a 382 já contém a correção.
DO $hotfix$
DECLARE definition TEXT;
BEGIN
 SELECT pg_get_functiondef('public.apply_conversion_event(uuid,text,text,jsonb,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'calculate_conversion_commission(rule,','calculate_conversion_commission(rule.id,');
 definition:=replace(definition,'commission_id UUID; gross','v_commission_id UUID; gross');
 definition:=replace(definition,'INTO commission_id','INTO v_commission_id');
 definition:=replace(definition,'IF commission_id IS NULL','IF v_commission_id IS NULL');
 definition:=replace(definition,'VALUES(commission_id,l.creator_id','VALUES(v_commission_id,l.creator_id');
 definition:=replace(definition,'id=commission_id AND','id=v_commission_id AND');
 definition:=replace(definition,'VALUES(commission_id,sale_id','VALUES(v_commission_id,sale_id');
 definition:=replace(definition,'''forecast:''||commission_id::text','''forecast:''||v_commission_id::text');
 definition:=replace(definition,'''eligible:''||commission_id::text','''eligible:''||v_commission_id::text');
 definition:=replace(definition,'''commission_id'',commission_id','''commission_id'',v_commission_id');
 EXECUTE definition;
END $hotfix$;
