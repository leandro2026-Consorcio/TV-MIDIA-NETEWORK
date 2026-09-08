-- Etapa 1: planos versionados, rede Lider > Creator, slots, comissoes e onboarding.
-- Aditiva: preserva carteira MPM, inventario, matching, Asaas e Rede Organica.

INSERT INTO public.platform_settings(key,value,description) VALUES
 ('expansion_program_v1','false'::jsonb,'Programa de expansao MPM; ativar somente apos homologacao.'),
 ('expansion_public_base_url','"https://midiapormidia.com.br"'::jsonb,'URL publica usada nos links de atribuicao.')
ON CONFLICT(key) DO UPDATE SET description=EXCLUDED.description;

DROP POLICY IF EXISTS "PlatformSettings - Public read" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Public read" ON public.platform_settings FOR SELECT TO anon,authenticated USING (key IN (
 'public_trial_signup_enabled','public_trial_days','trial_invites_count','auto_approve_trial_internal_media','public_signup_disabled_message',
 'plan_price_monthly_cents','plan_price_annual_cents','media_inventory_v2','inventory_capacity_v2','inventory_allocations_v2',
 'inventory_preferred_limit','inventory_growth_enabled','inventory_v2','wallet_mpm_v2','settlement_v2','matching_v2','partner_programs_v2',
 'social_v2','creator_v2','events_v2','payout_v2','dynamic_pricing_v2','inventory_growth_monthly_limit','mpm_default_unit_price',
 'expansion_program_v1','expansion_public_base_url'
));

CREATE TABLE public.expansion_plans (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','paused','archived')),
 public_available BOOLEAN NOT NULL DEFAULT true, display_order INTEGER NOT NULL DEFAULT 0,
 featured BOOLEAN NOT NULL DEFAULT false, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expansion_plan_versions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), plan_id UUID NOT NULL REFERENCES public.expansion_plans(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL CHECK(version>0), included_screens INTEGER NOT NULL CHECK(included_screens>0),
 monthly_price_cents BIGINT NOT NULL CHECK(monthly_price_cents>=0), annual_price_cents BIGINT CHECK(annual_price_cents IS NULL OR annual_price_cents>=0),
 extra_screen_price_cents BIGINT NOT NULL DEFAULT 5900 CHECK(extra_screen_price_cents>=0), max_screens INTEGER CHECK(max_screens IS NULL OR max_screens>=included_screens),
 first_charge_cents BIGINT CHECK(first_charge_cents IS NULL OR first_charge_cents>=0), first_charge_timing TEXT NOT NULL DEFAULT 'immediate' CHECK(first_charge_timing IN ('immediate','configured_date')),
 days_until_second_charge INTEGER NOT NULL DEFAULT 60 CHECK(days_until_second_charge>=0), recurring_interval_months INTEGER NOT NULL DEFAULT 1 CHECK(recurring_interval_months>0),
 payment_methods TEXT[] NOT NULL DEFAULT ARRAY['PIX','BOLETO'], grace_days INTEGER NOT NULL DEFAULT 0 CHECK(grace_days>=0),
 suspend_when_overdue BOOLEAN NOT NULL DEFAULT true, commission_release_policy TEXT NOT NULL DEFAULT 'proportional_to_activated_screens' CHECK(commission_release_policy IN ('on_payment','proportional_to_activated_screens')),
 company_included_insertions BIGINT CHECK(company_included_insertions IS NULL OR company_included_insertions>=0),
 company_insertions_scope TEXT NOT NULL DEFAULT 'plan' CHECK(company_insertions_scope IN ('plan','screen','custom')),
 creator_insertions_per_screen BIGINT CHECK(creator_insertions_per_screen IS NULL OR creator_insertions_per_screen>=0),
 creator_entitlement_months INTEGER NOT NULL DEFAULT 12 CHECK(creator_entitlement_months>0), creator_entitlement_requires_active BOOLEAN NOT NULL DEFAULT true,
 creator_entitlement_requires_current BOOLEAN NOT NULL DEFAULT true, unused_insertions_policy TEXT NOT NULL DEFAULT 'return_to_pool' CHECK(unused_insertions_policy IN ('expire','return_to_pool','carry_forward')),
 preferred_location_limit INTEGER NOT NULL DEFAULT 3 CHECK(preferred_location_limit>=0), entitlement_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
 effective_from TIMESTAMPTZ NOT NULL DEFAULT now(), effective_to TIMESTAMPTZ, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(plan_id,version), CHECK(effective_to IS NULL OR effective_to>effective_from)
);
CREATE UNIQUE INDEX uq_expansion_plan_current_version ON public.expansion_plan_versions(plan_id) WHERE effective_to IS NULL;

CREATE TABLE public.expansion_commission_rule_versions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), version INTEGER NOT NULL UNIQUE CHECK(version>0),
 calculation_mode TEXT NOT NULL DEFAULT 'percentage' CHECK(calculation_mode IN ('percentage','fixed','combined')),
 first_platform_percent NUMERIC(9,6) NOT NULL, first_creator_percent NUMERIC(9,6) NOT NULL, first_leader_percent NUMERIC(9,6) NOT NULL,
 recurring_platform_percent NUMERIC(9,6) NOT NULL, recurring_creator_percent NUMERIC(9,6) NOT NULL, recurring_leader_percent NUMERIC(9,6) NOT NULL,
 first_creator_fixed_cents BIGINT, first_leader_fixed_cents BIGINT, recurring_creator_fixed_cents BIGINT, recurring_leader_fixed_cents BIGINT,
 duration_months INTEGER NOT NULL DEFAULT 12 CHECK(duration_months>0), conditions JSONB NOT NULL DEFAULT '{"requires_paid":true,"requires_active_subscription":true,"requires_active_screen":true}'::jsonb,
 effective_from TIMESTAMPTZ NOT NULL DEFAULT now(), effective_to TIMESTAMPTZ, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(first_platform_percent>=0 AND first_creator_percent>=0 AND first_leader_percent>=0 AND first_platform_percent+first_creator_percent+first_leader_percent<=100.000001),
 CHECK(recurring_platform_percent>=0 AND recurring_creator_percent>=0 AND recurring_leader_percent>=0 AND recurring_platform_percent+recurring_creator_percent+recurring_leader_percent<=100.000001),
 CHECK(effective_to IS NULL OR effective_to>effective_from)
);
CREATE UNIQUE INDEX uq_expansion_commission_current ON public.expansion_commission_rule_versions((true)) WHERE effective_to IS NULL;

CREATE TABLE public.affiliate_relationships (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), leader_affiliate_id UUID NOT NULL REFERENCES public.affiliate_profiles(id) ON DELETE RESTRICT,
 creator_affiliate_id UUID NOT NULL REFERENCES public.affiliate_profiles(id) ON DELETE RESTRICT,
 starts_at TIMESTAMPTZ NOT NULL DEFAULT now(), ends_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending','active','ended','cancelled')),
 created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(leader_affiliate_id<>creator_affiliate_id), CHECK(ends_at IS NULL OR ends_at>starts_at)
);
CREATE UNIQUE INDEX uq_creator_active_leader ON public.affiliate_relationships(creator_affiliate_id) WHERE status='active' AND ends_at IS NULL;

CREATE TABLE public.company_plan_subscriptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
 plan_id UUID NOT NULL REFERENCES public.expansion_plans(id) ON DELETE RESTRICT, plan_version_id UUID NOT NULL REFERENCES public.expansion_plan_versions(id) ON DELETE RESTRICT,
 commission_rule_version_id UUID NOT NULL REFERENCES public.expansion_commission_rule_versions(id) ON DELETE RESTRICT,
 attribution_id UUID REFERENCES public.acquisition_attributions(id) ON DELETE RESTRICT,
 origin_creator_affiliate_id UUID REFERENCES public.affiliate_profiles(id) ON DELETE RESTRICT,
 origin_leader_affiliate_id UUID REFERENCES public.affiliate_profiles(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment','active','past_due','suspended','cancelled','ended')),
 billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','annual')),
 requested_screens INTEGER NOT NULL CHECK(requested_screens>0), contracted_amount_cents BIGINT NOT NULL CHECK(contracted_amount_cents>=0),
 first_paid_at TIMESTAMPTZ, next_charge_at TIMESTAMPTZ, commission_ends_at TIMESTAMPTZ,
 payment_provider TEXT NOT NULL DEFAULT 'asaas', asaas_customer_id TEXT, asaas_subscription_id TEXT,
 frozen_snapshot JSONB NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_company_active_expansion_subscription ON public.company_plan_subscriptions(company_id) WHERE status IN ('pending_payment','active','past_due','suspended');

CREATE TABLE public.subscription_screen_slots (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id UUID NOT NULL REFERENCES public.company_plan_subscriptions(id) ON DELETE RESTRICT,
 slot_index INTEGER NOT NULL CHECK(slot_index>0), slot_type TEXT NOT NULL CHECK(slot_type IN ('included','additional')),
 screen_id UUID REFERENCES public.screens(id) ON DELETE RESTRICT, economic_weight_cents BIGINT NOT NULL CHECK(economic_weight_cents>=0),
 creator_affiliate_id UUID REFERENCES public.affiliate_profiles(id) ON DELETE RESTRICT,
 leader_affiliate_id UUID REFERENCES public.affiliate_profiles(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','installation','active','offline','suspended','cancelled')),
 attribution_frozen_at TIMESTAMPTZ, activated_at TIMESTAMPTZ, suspended_at TIMESTAMPTZ,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(subscription_id,slot_index), UNIQUE(screen_id)
);

CREATE TABLE public.expansion_payments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id UUID NOT NULL REFERENCES public.company_plan_subscriptions(id) ON DELETE RESTRICT,
 payment_kind TEXT NOT NULL CHECK(payment_kind IN ('first','recurring','addon')), period_reference TEXT NOT NULL,
 amount_cents BIGINT NOT NULL CHECK(amount_cents>0), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','overdue','cancelled','refunded','chargeback')),
 provider TEXT NOT NULL DEFAULT 'asaas', provider_payment_id TEXT, provider_event_id TEXT, paid_at TIMESTAMPTZ,
 idempotency_key TEXT NOT NULL UNIQUE, raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_expansion_provider_payment ON public.expansion_payments(provider,provider_payment_id) WHERE provider_payment_id IS NOT NULL;

CREATE TABLE public.expansion_commission_entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), payment_id UUID NOT NULL REFERENCES public.expansion_payments(id) ON DELETE RESTRICT,
 subscription_id UUID NOT NULL REFERENCES public.company_plan_subscriptions(id) ON DELETE RESTRICT,
 slot_id UUID REFERENCES public.subscription_screen_slots(id) ON DELETE RESTRICT, beneficiary_affiliate_id UUID REFERENCES public.affiliate_profiles(id) ON DELETE RESTRICT,
 beneficiary_role TEXT NOT NULL CHECK(beneficiary_role IN ('platform','creator','leader')),
 entry_kind TEXT NOT NULL CHECK(entry_kind IN ('first','recurring','addon','reversal','adjustment')),
 amount_cents BIGINT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending_activation','available_pending_transfer','paid','reversed','cancelled','receivable_adjustment')),
 rule_version_id UUID NOT NULL REFERENCES public.expansion_commission_rule_versions(id) ON DELETE RESTRICT,
 original_entry_id UUID REFERENCES public.expansion_commission_entries(id) ON DELETE RESTRICT,
 idempotency_key TEXT NOT NULL UNIQUE, available_at TIMESTAMPTZ, transferred_at TIMESTAMPTZ,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK((entry_kind='reversal' AND amount_cents<=0) OR (entry_kind<>'reversal' AND amount_cents>=0))
);

CREATE TABLE public.expansion_preferred_locations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id UUID NOT NULL REFERENCES public.company_plan_subscriptions(id) ON DELETE CASCADE,
 inventory_id UUID NOT NULL REFERENCES public.media_inventory(id) ON DELETE RESTRICT, priority SMALLINT NOT NULL CHECK(priority>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(subscription_id,inventory_id), UNIQUE(subscription_id,priority)
);

CREATE TABLE public.onboarding_flows (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT NOT NULL UNIQUE, audience TEXT NOT NULL CHECK(audience IN ('company','creator','leader','organic','master')),
 name TEXT NOT NULL, feature_flag TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','paused')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.onboarding_steps (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), flow_id UUID NOT NULL REFERENCES public.onboarding_flows(id) ON DELETE CASCADE,
 code TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, display_order INTEGER NOT NULL,
 completion_signal TEXT NOT NULL, action_href TEXT, required_feature_flag TEXT, is_required BOOLEAN NOT NULL DEFAULT true,
 UNIQUE(flow_id,code), UNIQUE(flow_id,display_order)
);
CREATE TABLE public.user_onboarding_progress (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 step_id UUID NOT NULL REFERENCES public.onboarding_steps(id) ON DELETE CASCADE, completed_at TIMESTAMPTZ, skipped_at TIMESTAMPTZ,
 source TEXT NOT NULL DEFAULT 'state' CHECK(source IN ('state','event','manual')), metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE(user_id,step_id)
);
CREATE TABLE public.help_articles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, audience TEXT NOT NULL CHECK(audience IN ('company','creator','leader','support','master')),
 title TEXT NOT NULL, objective TEXT NOT NULL, prerequisites TEXT[] NOT NULL DEFAULT '{}', steps JSONB NOT NULL DEFAULT '[]'::jsonb,
 expected_result TEXT NOT NULL, action_label TEXT, action_href TEXT, common_errors TEXT[] NOT NULL DEFAULT '{}', media_url TEXT,
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')), display_order INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.product_help_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL, event_name TEXT NOT NULL CHECK(event_name IN (
  'tour_started','tour_step_completed','tour_skipped','setup_completed','referral_opened','company_referred','plan_selected','first_payment_paid',
  'screen_slot_created','screen_paired','screen_activated','first_media_uploaded','preferred_locations_saved','first_campaign_created','first_pod_received',
  'commission_created','commission_released','help_article_opened')),
 subject_type TEXT, subject_id UUID, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, idempotency_key TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Programa e configuracao comercial inicial.
INSERT INTO public.partner_programs(code,name,program_type,attribution_window_days,reward_type,reward_value,recurring_months,status,terms)
VALUES('mpm-expansion-v1','Programa de Expansao MPM','affiliate',90,'benefit',0,12,'active','{"levels":["leader","creator"],"cashout":false}'::jsonb)
ON CONFLICT(code) DO NOTHING;

INSERT INTO public.expansion_commission_rule_versions(version,first_platform_percent,first_creator_percent,first_leader_percent,recurring_platform_percent,recurring_creator_percent,recurring_leader_percent,duration_months)
VALUES(1,10,67.1141,22.8859,73.1544,16.7785,10.0671,12) ON CONFLICT(version) DO NOTHING;

INSERT INTO public.expansion_plans(code,name,description,display_order,featured) VALUES
 ('mpm-1-tv','Plano 1 TV','Comece sua rede com uma tela.',1,false),
 ('mpm-2-tvs','Plano 2 TVs','Mais cobertura com desconto progressivo.',2,false),
 ('mpm-3-tvs','Plano 3 TVs','Equilibrio entre alcance e economia.',3,true),
 ('mpm-4-tvs','Plano 4 TVs','Expansao para operacoes maiores.',4,false),
 ('mpm-5-tvs','Plano 5 TVs','Maior alcance e melhor valor por tela.',5,false)
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.expansion_plan_versions(plan_id,version,included_screens,monthly_price_cents,extra_screen_price_cents,max_screens)
SELECT p.id,1,x.screens,x.price,5900,NULL FROM (VALUES('mpm-1-tv',1,14900),('mpm-2-tvs',2,22900),('mpm-3-tvs',3,29900),('mpm-4-tvs',4,39900),('mpm-5-tvs',5,44900)) x(code,screens,price)
JOIN public.expansion_plans p ON p.code=x.code ON CONFLICT(plan_id,version) DO NOTHING;

-- Artigos curtos, operacionais e editaveis pelo Master.
INSERT INTO public.help_articles(slug,audience,title,objective,steps,expected_result,action_label,action_href,display_order) VALUES
 ('empresa-contratar-plano','company','Como contratar um plano','Escolher o pacote correto de TVs.','["Abra Planos","Compare TVs e valores","Selecione o plano","Confirme a cobranca"]','Plano aguardando ou com pagamento confirmado.','Ver planos','/plans',10),
 ('empresa-cadastrar-tv','company','Como cadastrar uma TV','Criar uma tela no painel.','["Abra TVs e Telas","Clique em Cadastrar Nova TV","Informe nome e orientacao","Salve"]','TV criada e pronta para pareamento.','Cadastrar TV','/screens',20),
 ('empresa-parear-tv','company','Como parear a TV','Vincular o player ao cadastro.','["Abra /player na TV","Copie o codigo de 6 caracteres","Abra os detalhes da TV","Informe o codigo"]','TV com status online.','Abrir TVs','/screens',30),
 ('empresa-enviar-midia','company','Como enviar uma midia','Adicionar sua propaganda aprovada.','["Abra Biblioteca de Midias","Envie imagem ou video","Confira orientacao","Aguarde aprovacao"]','Midia aprovada disponivel na empresa correta.','Enviar midia','/media',40),
 ('empresa-preferenciais','company','Como escolher locais preferenciais','Priorizar locais dentro do limite do plano.','["Abra seu plano","Escolha Locais preferenciais","Ordene as prioridades","Salve"]','Preferencias registradas; o restante usa distribuicao automatica.','Abrir planos','/plans',50),
 ('empresa-rede-mpm','company','Como funciona a Rede MPM','Entender a distribuicao de midia.','["Preferenciais sao considerados primeiro","Capacidade e categoria sao validadas","O matching distribui o restante","A entrega gera comprovantes"]','Campanhas distribuidas sem sorteio puro.','Abrir Ecossistema','/ecosystem',60),
 ('empresa-creditos','company','Como funcionam Creditos MPM','Distinguir creditos de insercoes.','["Abra Carteira e Creditos","Confira saldo e origem","Use saldo elegivel","Acompanhe movimentacoes"]','Credito e quota entendidos separadamente.','Abrir carteira','/wallet',70),
 ('empresa-comprar-midia','company','Como comprar midia','Reservar inventario da rede.','["Abra Marketplace","Escolha a oferta","Confirme periodo e insercoes","Conclua o pagamento"]','Pedido criado sem overbooking.','Abrir Marketplace','/marketplace',80),
 ('empresa-proof','company','Como acompanhar Proof of Delivery','Conferir exibicoes entregues.','["Abra Proof of Play","Filtre a campanha","Confira TV e horario"]','Entrega rastreavel no painel.','Ver entregas','/playback-logs',90),
 ('creator-programa','creator','Como funciona o Programa Creator Parceiro','Entender indicacao, ativacao e comissao.','["Compartilhe seu codigo","Ajude a empresa a contratar","Ative as TVs","Acompanhe a liberacao proporcional"]','Comissoes vinculadas a clientes reais e ativos.','Abrir Minha expansao','/creator',110),
 ('creator-codigo','creator','Como usar meu codigo','Registrar corretamente a origem da empresa.','["Copie seu Codigo do Parceiro","Compartilhe link ou QR","Peca para a empresa manter o codigo no cadastro"]','Indicacao preservada no contrato.','Ver meu codigo','/creator',120),
 ('creator-cadastrar-empresa','creator','Como cadastrar uma empresa','Acompanhar a entrada de uma indicada.','["Compartilhe seu link","A empresa completa o cadastro","Confira a indicacao no painel"]','Empresa associada ao seu codigo.','Abrir painel','/creator',130),
 ('creator-instalar-tv','creator','Como ajudar na instalacao da TV','Ativar um slot contratado.','["Confirme o slot","Cadastre a tela","Abra o player","Pareie e valide online"]','TV ativa e attribution congelada.','Ver pendencias','/creator',140),
 ('creator-comissao','creator','Como acompanhar comissao','Entender valores previstos e liberados.','["Abra Comissao","Confira pagamento","Confira TVs ativas","Cadastre conta de recebimento"]','Comissao pronta para transferencia quando elegivel.','Ver comissoes','/creator',150),
 ('creator-midia-gratuita','creator','Como usar minha midia gratuita','Usar o direito conquistado sem criar creditos.','["Abra Minha midia","Escolha uma TV elegivel","Envie para aprovacao","Crie a campanha normal"]','Insercoes consumidas do entitlement correto.','Ver minha midia','/creator',160),
 ('creator-campanha','creator','Como criar campanha','Enviar conteudo pelo fluxo aprovado.','["Escolha o entitlement","Selecione midia aprovada","Defina periodo","Envie para distribuicao"]','Campanha sujeita a formato e capacidade.','Criar campanha','/campaigns',170),
 ('leader-convidar','leader','Como convidar Creator','Adicionar um Creator a sua equipe.','["Abra Minha equipe","Clique em Convidar Creator","Compartilhe codigo ou link","Acompanhe o aceite"]','Creator vinculado em apenas dois niveis.','Abrir equipe','/leader',210),
 ('leader-equipe','leader','Como acompanhar equipe','Ver producao sem expor dados sensiveis.','["Abra Minha equipe","Filtre pendencias","Acompanhe empresas e TVs"]','Gargalos de ativacao identificados.','Abrir equipe','/leader',220),
 ('leader-tvs','leader','Como acompanhar TVs pendentes','Ajudar a concluir ativacoes.','["Veja TVs previstas","Identifique slots pendentes","Acione o Creator","Confirme a ativacao"]','Mais TVs elegiveis ativas.','Ver TVs','/leader',230),
 ('leader-comissao','leader','Como funciona minha comissao','Entender a parcela ligada a producao da equipe.','["Empresa paga","Creator ativa a TV","Parcela proporcional e liberada","Transferencia depende do cadastro financeiro"]','Comissao rastreavel por contrato e TV.','Ver comissoes','/leader',240),
 ('suporte-tv-offline','support','TV offline','Restabelecer uma tela sem sinal.','["Confira internet e energia","Reabra o player","Valide o pareamento","Confira o ultimo ping"]','TV volta ao status online.',NULL,NULL,310),
 ('suporte-pagamento','support','Pagamento pendente','Conferir uma cobranca ainda nao confirmada.','["Abra o link da cobranca","Confira vencimento","Aguarde confirmacao do Asaas","Se pago, acione suporte com comprovante"]','Status conciliado sem duplicidade.',NULL,NULL,320),
 ('suporte-comissao','support','Comissao pendente','Entender por que uma comissao nao foi liberada.','["Confira pagamento","Confira assinatura","Confira TV ativa","Confira cadastro financeiro"]','Pendencia objetiva identificada.',NULL,NULL,330),
 ('suporte-entrega','support','Campanha sem entrega','Diagnosticar uma campanha.','["Confira periodo","Confira TV online","Confira capacidade","Confira aprovacao e categoria"]','Campanha corrigida ou motivo identificado.',NULL,NULL,340)
ON CONFLICT(slug) DO NOTHING;

-- Fluxos configuraveis; conclusao pode ser recalculada pelos sinais registrados.
INSERT INTO public.onboarding_flows(code,audience,name,feature_flag) VALUES
 ('company-expansion','company','Ative sua empresa','expansion_program_v1'),('creator-expansion','creator','Comece como Creator','expansion_program_v1'),
 ('leader-expansion','leader','Lidere sua equipe','expansion_program_v1'),('organic-basic','organic','Rede Organica',NULL),('master-expansion','master','Gestao da expansao','expansion_program_v1')
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.onboarding_steps(flow_id,code,title,description,display_order,completion_signal,action_href,required_feature_flag)
SELECT f.id,x.code,x.title,x.description,x.ord,x.signal,x.href,x.flag FROM public.onboarding_flows f JOIN (VALUES
 ('company-expansion','profile','Complete o cadastro','Confirme os dados da empresa.',1,'company_profile_complete','/companies',NULL),
 ('company-expansion','plan','Escolha o plano','Selecione quantas TVs sua empresa precisa.',2,'subscription_created','/plans','expansion_program_v1'),
 ('company-expansion','payment','Pague a primeira cobranca','Use PIX, boleto ou opcao disponivel.',3,'first_payment_paid','/plans','expansion_program_v1'),
 ('company-expansion','screen','Cadastre e pareie as TVs','Ative cada slot contratado.',4,'all_slots_active','/screens',NULL),
 ('company-expansion','media','Envie a primeira midia','Publique sua propaganda pelo fluxo normal.',5,'first_media_uploaded','/media',NULL),
 ('company-expansion','campaign','Ative a primeira campanha','Vincule a midia a programacao.',6,'first_campaign_created','/campaigns',NULL),
 ('creator-expansion','profile','Complete seu perfil','Prepare sua identificacao de parceiro.',1,'creator_profile_complete','/creator',NULL),
 ('creator-expansion','code','Compartilhe seu codigo','Use link ou QR para preservar a origem.',2,'referral_opened','/creator','expansion_program_v1'),
 ('creator-expansion','company','Ative sua primeira empresa','Ajude no plano e instalacao.',3,'company_referred','/creator','expansion_program_v1'),
 ('creator-expansion','commission','Acompanhe sua comissao','Veja pendencias e liberacoes.',4,'commission_created','/creator','expansion_program_v1'),
 ('leader-expansion','invite','Convide um Creator','Crie sua equipe de dois niveis.',1,'creator_invited','/leader','expansion_program_v1'),
 ('leader-expansion','activation','Acompanhe ativacoes','Ajude a eliminar TVs pendentes.',2,'screen_activated','/leader','expansion_program_v1'),
 ('organic-basic','pair','Pareie seu monitor','Ative a Rede Organica.',1,'organic_screen_paired','/organic',NULL),
 ('master-expansion','plans','Revise os planos','Confira regras comerciais versionadas.',1,'plans_reviewed','/admin/mpm/expansion','expansion_program_v1')
) x(flow,code,title,description,ord,signal,href,flag) ON f.code=x.flow ON CONFLICT(flow_id,code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_creator_expansion_affiliate() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE base_code TEXT;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.affiliate_profiles WHERE user_id=NEW.user_id) THEN
  base_code:=upper(regexp_replace(NEW.display_name,'[^a-zA-Z0-9]+','-','g'))||'-'||upper(substr(NEW.id::text,1,6));
  INSERT INTO public.affiliate_profiles(user_id,display_name,affiliate_type,status,attribution_code,metadata)
  VALUES(NEW.user_id,NEW.display_name,'general',CASE WHEN NEW.status='active' THEN 'active' ELSE 'pending' END,base_code,jsonb_build_object('role','creator','creator_profile_id',NEW.id));
 ELSE
  UPDATE public.affiliate_profiles SET display_name=NEW.display_name,updated_at=now(),metadata=metadata||jsonb_build_object('role',COALESCE(metadata->>'role','creator'),'creator_profile_id',NEW.id)
  WHERE user_id=NEW.user_id;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_sync_creator_expansion_affiliate AFTER INSERT OR UPDATE OF display_name,status ON public.creator_profiles FOR EACH ROW EXECUTE FUNCTION public.sync_creator_expansion_affiliate();
INSERT INTO public.affiliate_profiles(user_id,display_name,affiliate_type,status,attribution_code,metadata)
SELECT c.user_id,c.display_name,'general',CASE WHEN c.status='active' THEN 'active' ELSE 'pending' END,
 upper(regexp_replace(c.display_name,'[^a-zA-Z0-9]+','-','g'))||'-'||upper(substr(c.id::text,1,6)),jsonb_build_object('role','creator','creator_profile_id',c.id)
FROM public.creator_profiles c WHERE NOT EXISTS(SELECT 1 FROM public.affiliate_profiles a WHERE a.user_id=c.user_id)
ON CONFLICT(attribution_code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.expansion_is_affiliate_owner(p_affiliate UUID) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.is_master_admin() OR EXISTS(SELECT 1 FROM public.affiliate_profiles a WHERE a.id=p_affiliate AND (a.user_id=auth.uid() OR a.company_id IN (SELECT public.get_user_admin_company_ids())))
$$;

CREATE OR REPLACE FUNCTION public.get_my_expansion_onboarding()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid UUID:=auth.uid(); company_ids UUID[]; affiliate UUID; creator_profile UUID; audience TEXT:='company'; completed INTEGER:=0; total INTEGER:=0; details JSONB:='{}';
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria.'; END IF;
 SELECT array_agg(company_id) INTO company_ids FROM public.company_users WHERE user_id=uid AND is_active;
 SELECT id INTO creator_profile FROM public.creator_profiles WHERE user_id=uid;
 SELECT id INTO affiliate FROM public.affiliate_profiles WHERE user_id=uid AND status='active' ORDER BY created_at LIMIT 1;
 IF public.is_master_admin() THEN audience:='master';
 ELSIF affiliate IS NOT NULL AND EXISTS(SELECT 1 FROM public.affiliate_relationships WHERE leader_affiliate_id=affiliate AND status='active') THEN audience:='leader';
 ELSIF creator_profile IS NOT NULL THEN audience:='creator'; END IF;
 SELECT count(*) INTO total FROM public.onboarding_steps s JOIN public.onboarding_flows f ON f.id=s.flow_id WHERE f.audience=audience AND f.status='active';
 IF audience='company' THEN
  details:=jsonb_build_object('profile',cardinality(COALESCE(company_ids,'{}'))>0,
   'subscription',EXISTS(SELECT 1 FROM public.company_plan_subscriptions WHERE company_id=ANY(COALESCE(company_ids,'{}'))),
   'payment',EXISTS(SELECT 1 FROM public.expansion_payments p JOIN public.company_plan_subscriptions s ON s.id=p.subscription_id WHERE s.company_id=ANY(COALESCE(company_ids,'{}')) AND p.status='paid'),
   'screens',EXISTS(SELECT 1 FROM public.screens WHERE company_id=ANY(COALESCE(company_ids,'{}')) AND status='online'),
   'media',EXISTS(SELECT 1 FROM public.media_assets WHERE company_id=ANY(COALESCE(company_ids,'{}'))),
   'campaign',EXISTS(SELECT 1 FROM public.campaigns WHERE company_id=ANY(COALESCE(company_ids,'{}'))));
 ELSIF audience='creator' THEN details:=jsonb_build_object('profile',creator_profile IS NOT NULL,'code',affiliate IS NOT NULL,
   'company',EXISTS(SELECT 1 FROM public.company_plan_subscriptions WHERE origin_creator_affiliate_id=affiliate),
   'commission',EXISTS(SELECT 1 FROM public.expansion_commission_entries WHERE beneficiary_affiliate_id=affiliate));
 ELSIF audience='leader' THEN details:=jsonb_build_object('invite',EXISTS(SELECT 1 FROM public.affiliate_relationships WHERE leader_affiliate_id=affiliate),
   'activation',EXISTS(SELECT 1 FROM public.subscription_screen_slots WHERE leader_affiliate_id=affiliate AND status='active'));
 ELSE details:='{"plans":true}'::jsonb; END IF;
 SELECT count(*) INTO completed FROM jsonb_each(details) WHERE value='true'::jsonb;
 RETURN jsonb_build_object('audience',audience,'completed',completed,'total',GREATEST(total,jsonb_object_length(details)),'percent',CASE WHEN GREATEST(total,jsonb_object_length(details))=0 THEN 0 ELSE round(completed*100.0/GREATEST(total,jsonb_object_length(details))) END,'signals',details);
END $$;

CREATE OR REPLACE FUNCTION public.set_expansion_affiliate_relationship(p_leader UUID,p_creator UUID,p_idempotency_key TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE rid UUID;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() AND NOT public.expansion_is_affiliate_owner(p_leader) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF p_leader=p_creator THEN RAISE EXCEPTION 'Lider e Creator devem ser diferentes.'; END IF;
 IF EXISTS(SELECT 1 FROM public.affiliate_relationships WHERE status='active' AND ends_at IS NULL AND creator_affiliate_id=p_leader) THEN RAISE EXCEPTION 'Terceiro nivel comercial nao permitido.'; END IF;
 IF EXISTS(SELECT 1 FROM public.affiliate_relationships WHERE status='active' AND ends_at IS NULL AND leader_affiliate_id=p_creator) THEN RAISE EXCEPTION 'Ciclo ou terceiro nivel nao permitido.'; END IF;
 INSERT INTO public.affiliate_relationships(leader_affiliate_id,creator_affiliate_id,created_by,metadata)
 VALUES(p_leader,p_creator,auth.uid(),jsonb_build_object('idempotency_key',p_idempotency_key)) RETURNING id INTO rid;
 RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.create_expansion_subscription(p_company UUID,p_plan_code TEXT,p_requested_screens INTEGER,p_attribution_code TEXT,p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.expansion_plans%ROWTYPE; v public.expansion_plan_versions%ROWTYPE; r public.expansion_commission_rule_versions%ROWTYPE;
 creator UUID; leader UUID; attr UUID; subid UUID; amount BIGINT; base_weight BIGINT; remainder BIGINT; i INTEGER; program UUID;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() AND p_company NOT IN (SELECT public.get_user_admin_company_ids()) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('expansion-subscription:'||p_idempotency_key,0));
 SELECT id INTO subid FROM public.company_plan_subscriptions WHERE idempotency_key=p_idempotency_key; IF subid IS NOT NULL THEN RETURN subid; END IF;
 SELECT * INTO p FROM public.expansion_plans WHERE code=p_plan_code AND status='active' FOR SHARE;
 SELECT * INTO v FROM public.expansion_plan_versions WHERE plan_id=p.id AND effective_from<=now() AND effective_to IS NULL FOR SHARE;
 SELECT * INTO r FROM public.expansion_commission_rule_versions WHERE effective_from<=now() AND effective_to IS NULL FOR SHARE;
 IF p.id IS NULL OR v.id IS NULL OR r.id IS NULL THEN RAISE EXCEPTION 'Plano ou regra economica indisponivel.'; END IF;
 IF p_requested_screens<v.included_screens OR (v.max_screens IS NOT NULL AND p_requested_screens>v.max_screens) THEN RAISE EXCEPTION 'Quantidade de TVs invalida.'; END IF;
 SELECT id INTO creator FROM public.affiliate_profiles WHERE upper(attribution_code)=upper(p_attribution_code) AND status='active';
 IF creator IS NOT NULL THEN SELECT leader_affiliate_id INTO leader FROM public.affiliate_relationships WHERE creator_affiliate_id=creator AND status='active' AND starts_at<=now() AND ends_at IS NULL; END IF;
 SELECT id INTO program FROM public.partner_programs WHERE code='mpm-expansion-v1';
 IF creator IS NOT NULL THEN
  INSERT INTO public.acquisition_attributions(program_id,source_type,source_code,attributed_holder_type,attributed_holder_id,converted_company_id,converted_at,idempotency_key,metadata)
  VALUES(program,'code',p_attribution_code,'affiliate',creator,p_company,now(),'expansion:'||p_idempotency_key,jsonb_build_object('locked',true)) RETURNING id INTO attr;
 END IF;
 amount:=v.monthly_price_cents+GREATEST(0,p_requested_screens-v.included_screens)*v.extra_screen_price_cents;
 INSERT INTO public.company_plan_subscriptions(company_id,plan_id,plan_version_id,commission_rule_version_id,attribution_id,origin_creator_affiliate_id,origin_leader_affiliate_id,
  requested_screens,contracted_amount_cents,frozen_snapshot,idempotency_key,created_by)
 VALUES(p_company,p.id,v.id,r.id,attr,creator,leader,p_requested_screens,amount,
  jsonb_build_object('plan_code',p.code,'plan_version',v.version,'included_screens',v.included_screens,'monthly_price_cents',v.monthly_price_cents,'extra_screen_price_cents',v.extra_screen_price_cents,
   'days_until_second_charge',v.days_until_second_charge,'commission_rule_version',r.version,'commission_release_policy',v.commission_release_policy,'company_included_insertions',v.company_included_insertions,
   'creator_insertions_per_screen',v.creator_insertions_per_screen,'preferred_location_limit',v.preferred_location_limit,'unused_policy',v.unused_insertions_policy),p_idempotency_key,auth.uid()) RETURNING id INTO subid;
 base_weight:=v.monthly_price_cents/v.included_screens; remainder:=v.monthly_price_cents-base_weight*v.included_screens;
 FOR i IN 1..p_requested_screens LOOP
  INSERT INTO public.subscription_screen_slots(subscription_id,slot_index,slot_type,economic_weight_cents,creator_affiliate_id,leader_affiliate_id)
  VALUES(subid,i,CASE WHEN i<=v.included_screens THEN 'included' ELSE 'additional' END,
   CASE WHEN i<=v.included_screens THEN base_weight+CASE WHEN i=v.included_screens THEN remainder ELSE 0 END ELSE v.extra_screen_price_cents END,creator,leader);
 END LOOP;
 INSERT INTO public.product_help_events(user_id,company_id,event_name,subject_type,subject_id,idempotency_key) VALUES(auth.uid(),p_company,'plan_selected','subscription',subid,'plan-selected:'||subid);
 RETURN subid;
END $$;

CREATE OR REPLACE FUNCTION public.record_expansion_payment(p_subscription UUID,p_payment_kind TEXT,p_period_reference TEXT,p_amount_cents BIGINT,p_provider_payment_id TEXT,p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.company_plan_subscriptions%ROWTYPE; r public.expansion_commission_rule_versions%ROWTYPE; payid UUID; sl RECORD; creator_total BIGINT; leader_total BIGINT;
 creator_alloc BIGINT:=0; leader_alloc BIGINT:=0; creator_part BIGINT; leader_part BIGINT; total_weight BIGINT; last_slot UUID; leader_beneficiary UUID;
 platform_total BIGINT; program UUID; enrollment UUID; planv public.expansion_plan_versions%ROWTYPE;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF p_payment_kind NOT IN ('first','recurring','addon') OR p_amount_cents<=0 THEN RAISE EXCEPTION 'Pagamento invalido.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('expansion-payment:'||p_idempotency_key,0));
 SELECT id INTO payid FROM public.expansion_payments WHERE idempotency_key=p_idempotency_key AND status='paid'; IF payid IS NOT NULL THEN RETURN payid; END IF;
 SELECT * INTO s FROM public.company_plan_subscriptions WHERE id=p_subscription FOR UPDATE;
 SELECT * INTO r FROM public.expansion_commission_rule_versions WHERE id=s.commission_rule_version_id;
 IF s.id IS NULL OR s.status IN ('cancelled','ended') THEN RAISE EXCEPTION 'Assinatura invalida.'; END IF;
 INSERT INTO public.expansion_payments(subscription_id,payment_kind,period_reference,amount_cents,status,provider_payment_id,paid_at,idempotency_key)
 VALUES(s.id,p_payment_kind,p_period_reference,p_amount_cents,'paid',p_provider_payment_id,now(),p_idempotency_key)
 ON CONFLICT(idempotency_key) DO UPDATE SET status='paid',provider_payment_id=COALESCE(EXCLUDED.provider_payment_id,expansion_payments.provider_payment_id),paid_at=now(),updated_at=now()
 RETURNING id INTO payid;
 IF p_payment_kind='first' THEN creator_total:=round(p_amount_cents*r.first_creator_percent/100); leader_total:=round(p_amount_cents*r.first_leader_percent/100);
 ELSE creator_total:=round(p_amount_cents*r.recurring_creator_percent/100); leader_total:=round(p_amount_cents*r.recurring_leader_percent/100); END IF;
 IF p_payment_kind<>'first' AND s.commission_ends_at IS NOT NULL AND s.commission_ends_at<now() THEN creator_total:=0; leader_total:=0; END IF;
 platform_total:=p_amount_cents-creator_total-leader_total;
 INSERT INTO public.expansion_commission_entries(payment_id,subscription_id,beneficiary_role,entry_kind,amount_cents,status,rule_version_id,idempotency_key,available_at)
 VALUES(payid,s.id,'platform',p_payment_kind,platform_total,'available_pending_transfer',r.id,'commission:'||payid||':platform',now());
 SELECT sum(economic_weight_cents),max(id) INTO total_weight,last_slot FROM public.subscription_screen_slots WHERE subscription_id=s.id AND status<>'cancelled';
 FOR sl IN SELECT * FROM public.subscription_screen_slots WHERE subscription_id=s.id AND status<>'cancelled' ORDER BY slot_index LOOP
  creator_part:=CASE WHEN sl.id=last_slot THEN creator_total-creator_alloc ELSE round(creator_total*sl.economic_weight_cents/total_weight) END;
  leader_part:=CASE WHEN sl.id=last_slot THEN leader_total-leader_alloc ELSE round(leader_total*sl.economic_weight_cents/total_weight) END;
  creator_alloc:=creator_alloc+creator_part; leader_alloc:=leader_alloc+leader_part;
  IF sl.creator_affiliate_id IS NOT NULL AND creator_part>0 THEN
   INSERT INTO public.expansion_commission_entries(payment_id,subscription_id,slot_id,beneficiary_affiliate_id,beneficiary_role,entry_kind,amount_cents,status,rule_version_id,idempotency_key,available_at)
   VALUES(payid,s.id,sl.id,sl.creator_affiliate_id,'creator',p_payment_kind,creator_part,CASE WHEN sl.status='active' THEN 'available_pending_transfer' ELSE 'pending_activation' END,r.id,
    'commission:'||payid||':'||sl.id||':creator',CASE WHEN sl.status='active' THEN now() END);
  END IF;
  leader_beneficiary:=CASE WHEN sl.leader_affiliate_id=sl.creator_affiliate_id THEN NULL ELSE sl.leader_affiliate_id END;
  IF leader_beneficiary IS NOT NULL AND leader_part>0 THEN
   INSERT INTO public.expansion_commission_entries(payment_id,subscription_id,slot_id,beneficiary_affiliate_id,beneficiary_role,entry_kind,amount_cents,status,rule_version_id,idempotency_key,available_at)
   VALUES(payid,s.id,sl.id,leader_beneficiary,'leader',p_payment_kind,leader_part,CASE WHEN sl.status='active' THEN 'available_pending_transfer' ELSE 'pending_activation' END,r.id,
    'commission:'||payid||':'||sl.id||':leader',CASE WHEN sl.status='active' THEN now() END);
  END IF;
 END LOOP;
 SELECT * INTO planv FROM public.expansion_plan_versions WHERE id=s.plan_version_id;
 IF p_payment_kind='first' AND planv.company_included_insertions IS NOT NULL AND planv.company_included_insertions>0 THEN
  SELECT id INTO program FROM public.partner_programs WHERE code='mpm-expansion-v1';
  INSERT INTO public.partnership_enrollments(program_id,participant_type,participant_id,attribution_id,status,metadata)
  VALUES(program,'company',s.company_id,s.attribution_id,'active',jsonb_build_object('subscription_id',s.id))
  ON CONFLICT(program_id,participant_type,participant_id) DO UPDATE SET status='active' RETURNING id INTO enrollment;
  INSERT INTO public.inventory_entitlements(program_id,enrollment_id,beneficiary_type,beneficiary_id,insertion_quantity,recurrence,unused_policy,starts_at,ends_at,metadata)
  VALUES(program,enrollment,'company',s.company_id,planv.company_included_insertions,'monthly',planv.unused_insertions_policy,now(),NULL,jsonb_build_object('subscription_id',s.id,'scope',planv.company_insertions_scope,'separate_from_creator',true));
 END IF;
 UPDATE public.company_plan_subscriptions SET status='active',first_paid_at=COALESCE(first_paid_at,now()),
  next_charge_at=CASE WHEN first_paid_at IS NULL THEN now()+make_interval(days=COALESCE((frozen_snapshot->>'days_until_second_charge')::int,60)) ELSE now()+interval '1 month' END,
  commission_ends_at=COALESCE(commission_ends_at,now()+make_interval(months=r.duration_months)),updated_at=now() WHERE id=s.id;
 INSERT INTO public.product_help_events(company_id,event_name,subject_type,subject_id,idempotency_key) VALUES(s.company_id,'first_payment_paid','payment',payid,'payment-paid:'||payid) ON CONFLICT(idempotency_key) DO NOTHING;
 RETURN payid;
END $$;

CREATE OR REPLACE FUNCTION public.create_expansion_payment_intent(p_subscription UUID,p_billing_type TEXT,p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.company_plan_subscriptions%ROWTYPE; pid UUID;
BEGIN
 SELECT * INTO s FROM public.company_plan_subscriptions WHERE id=p_subscription;
 IF s.id IS NULL OR (auth.role()<>'service_role' AND NOT public.is_master_admin() AND s.company_id NOT IN (SELECT public.get_user_admin_company_ids())) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF p_billing_type NOT IN ('PIX','BOLETO','CREDIT_CARD','UNDEFINED') THEN RAISE EXCEPTION 'Forma de pagamento invalida.'; END IF;
 INSERT INTO public.expansion_payments(subscription_id,payment_kind,period_reference,amount_cents,status,idempotency_key,raw_metadata)
 VALUES(s.id,'first',to_char(current_date,'YYYY-MM'),s.contracted_amount_cents,'pending',p_idempotency_key,jsonb_build_object('billing_type',p_billing_type))
 ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id INTO pid;
 RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.attach_expansion_payment_provider(p_payment UUID,p_provider_payment_id TEXT,p_metadata JSONB DEFAULT '{}')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pid UUID;
BEGIN
 UPDATE public.expansion_payments ep SET provider_payment_id=p_provider_payment_id,raw_metadata=raw_metadata||COALESCE(p_metadata,'{}'),updated_at=now()
 FROM public.company_plan_subscriptions s WHERE ep.id=p_payment AND s.id=ep.subscription_id
 AND (auth.role()='service_role' OR public.is_master_admin() OR s.company_id IN (SELECT public.get_user_admin_company_ids())) RETURNING ep.id INTO pid;
 IF pid IS NULL THEN RAISE EXCEPTION 'Pagamento inacessivel.'; END IF; RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_version_expansion_plan(p_plan_id UUID,p_configuration JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE prior public.expansion_plan_versions%ROWTYPE; newid UUID; next_version INTEGER;
BEGIN
 IF NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso exclusivo do Master.'; END IF;
 SELECT * INTO prior FROM public.expansion_plan_versions WHERE plan_id=p_plan_id AND effective_to IS NULL FOR UPDATE;
 IF prior.id IS NULL THEN RAISE EXCEPTION 'Plano sem versao vigente.'; END IF;
 UPDATE public.expansion_plan_versions SET effective_to=now() WHERE id=prior.id; next_version:=prior.version+1;
 INSERT INTO public.expansion_plan_versions(plan_id,version,included_screens,monthly_price_cents,annual_price_cents,extra_screen_price_cents,max_screens,
  first_charge_cents,first_charge_timing,days_until_second_charge,recurring_interval_months,payment_methods,grace_days,suspend_when_overdue,
  commission_release_policy,company_included_insertions,company_insertions_scope,creator_insertions_per_screen,creator_entitlement_months,
  creator_entitlement_requires_active,creator_entitlement_requires_current,unused_insertions_policy,preferred_location_limit,entitlement_rules,created_by)
 VALUES(p_plan_id,next_version,COALESCE((p_configuration->>'included_screens')::int,prior.included_screens),COALESCE((p_configuration->>'monthly_price_cents')::bigint,prior.monthly_price_cents),
  COALESCE((p_configuration->>'annual_price_cents')::bigint,prior.annual_price_cents),COALESCE((p_configuration->>'extra_screen_price_cents')::bigint,prior.extra_screen_price_cents),
  COALESCE((p_configuration->>'max_screens')::int,prior.max_screens),COALESCE((p_configuration->>'first_charge_cents')::bigint,prior.first_charge_cents),
  COALESCE(p_configuration->>'first_charge_timing',prior.first_charge_timing),COALESCE((p_configuration->>'days_until_second_charge')::int,prior.days_until_second_charge),
  COALESCE((p_configuration->>'recurring_interval_months')::int,prior.recurring_interval_months),COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_configuration->'payment_methods')),prior.payment_methods),
  COALESCE((p_configuration->>'grace_days')::int,prior.grace_days),COALESCE((p_configuration->>'suspend_when_overdue')::boolean,prior.suspend_when_overdue),
  COALESCE(p_configuration->>'commission_release_policy',prior.commission_release_policy),COALESCE((p_configuration->>'company_included_insertions')::bigint,prior.company_included_insertions),
  COALESCE(p_configuration->>'company_insertions_scope',prior.company_insertions_scope),COALESCE((p_configuration->>'creator_insertions_per_screen')::bigint,prior.creator_insertions_per_screen),
  COALESCE((p_configuration->>'creator_entitlement_months')::int,prior.creator_entitlement_months),COALESCE((p_configuration->>'creator_entitlement_requires_active')::boolean,prior.creator_entitlement_requires_active),
  COALESCE((p_configuration->>'creator_entitlement_requires_current')::boolean,prior.creator_entitlement_requires_current),COALESCE(p_configuration->>'unused_insertions_policy',prior.unused_insertions_policy),
  COALESCE((p_configuration->>'preferred_location_limit')::int,prior.preferred_location_limit),COALESCE(p_configuration->'entitlement_rules',prior.entitlement_rules),auth.uid()) RETURNING id INTO newid;
 UPDATE public.expansion_plans SET name=COALESCE(p_configuration->>'name',name),description=COALESCE(p_configuration->>'description',description),
  status=COALESCE(p_configuration->>'status',status),public_available=COALESCE((p_configuration->>'public_available')::boolean,public_available),
  featured=COALESCE((p_configuration->>'featured')::boolean,featured),display_order=COALESCE((p_configuration->>'display_order')::int,display_order),updated_at=now() WHERE id=p_plan_id;
 RETURN newid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_version_expansion_commission_rule(p_configuration JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE prior public.expansion_commission_rule_versions%ROWTYPE; newid UUID;
BEGIN
 IF NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso exclusivo do Master.'; END IF;
 SELECT * INTO prior FROM public.expansion_commission_rule_versions WHERE effective_to IS NULL FOR UPDATE;
 UPDATE public.expansion_commission_rule_versions SET effective_to=now() WHERE id=prior.id;
 INSERT INTO public.expansion_commission_rule_versions(version,calculation_mode,first_platform_percent,first_creator_percent,first_leader_percent,
  recurring_platform_percent,recurring_creator_percent,recurring_leader_percent,duration_months,conditions,created_by)
 VALUES(prior.version+1,COALESCE(p_configuration->>'calculation_mode',prior.calculation_mode),
  COALESCE((p_configuration->>'first_platform_percent')::numeric,prior.first_platform_percent),COALESCE((p_configuration->>'first_creator_percent')::numeric,prior.first_creator_percent),COALESCE((p_configuration->>'first_leader_percent')::numeric,prior.first_leader_percent),
  COALESCE((p_configuration->>'recurring_platform_percent')::numeric,prior.recurring_platform_percent),COALESCE((p_configuration->>'recurring_creator_percent')::numeric,prior.recurring_creator_percent),COALESCE((p_configuration->>'recurring_leader_percent')::numeric,prior.recurring_leader_percent),
  COALESCE((p_configuration->>'duration_months')::int,prior.duration_months),COALESCE(p_configuration->'conditions',prior.conditions),auth.uid()) RETURNING id INTO newid;
 RETURN newid;
END $$;

CREATE OR REPLACE FUNCTION public.activate_expansion_screen_slot(p_slot UUID,p_screen UUID,p_creator_affiliate UUID DEFAULT NULL,p_idempotency_key TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE sl public.subscription_screen_slots%ROWTYPE; s public.company_plan_subscriptions%ROWTYPE; v public.expansion_plan_versions%ROWTYPE; program UUID; enrollment UUID; creator_profile UUID;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('expansion-slot:'||p_slot::text,0));
 SELECT * INTO sl FROM public.subscription_screen_slots WHERE id=p_slot FOR UPDATE; SELECT * INTO s FROM public.company_plan_subscriptions WHERE id=sl.subscription_id;
 IF sl.id IS NULL OR s.status<>'active' THEN RAISE EXCEPTION 'Slot ou assinatura inelegivel.'; END IF;
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() AND s.company_id NOT IN (SELECT public.get_user_admin_company_ids()) AND NOT public.expansion_is_affiliate_owner(COALESCE(p_creator_affiliate,sl.creator_affiliate_id)) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.screens WHERE id=p_screen AND company_id=s.company_id AND status='online') THEN RAISE EXCEPTION 'TV deve estar online e pertencer a empresa assinante.'; END IF;
 IF sl.status='active' THEN IF sl.screen_id<>p_screen THEN RAISE EXCEPTION 'Attribution de TV ja congelada.'; END IF; RETURN sl.id; END IF;
 IF p_creator_affiliate IS NOT NULL THEN
  sl.creator_affiliate_id:=p_creator_affiliate;
  SELECT leader_affiliate_id INTO sl.leader_affiliate_id FROM public.affiliate_relationships WHERE creator_affiliate_id=p_creator_affiliate AND status='active' AND ends_at IS NULL;
 END IF;
 UPDATE public.subscription_screen_slots SET screen_id=p_screen,creator_affiliate_id=sl.creator_affiliate_id,leader_affiliate_id=sl.leader_affiliate_id,status='active',activated_at=now(),attribution_frozen_at=now(),updated_at=now() WHERE id=sl.id;
 UPDATE public.expansion_commission_entries SET status='available_pending_transfer',available_at=now() WHERE slot_id=sl.id AND status='pending_activation';
 SELECT * INTO v FROM public.expansion_plan_versions WHERE id=s.plan_version_id; SELECT id INTO program FROM public.partner_programs WHERE code='mpm-expansion-v1';
 IF v.creator_insertions_per_screen IS NOT NULL AND v.creator_insertions_per_screen>0 AND sl.creator_affiliate_id IS NOT NULL THEN
  INSERT INTO public.partnership_enrollments(program_id,participant_type,participant_id,attribution_id,status,metadata)
  VALUES(program,'affiliate',sl.creator_affiliate_id,s.attribution_id,'active',jsonb_build_object('subscription_id',s.id))
  ON CONFLICT(program_id,participant_type,participant_id) DO UPDATE SET status='active' RETURNING id INTO enrollment;
  INSERT INTO public.inventory_entitlements(program_id,enrollment_id,inventory_id,beneficiary_type,beneficiary_id,insertion_quantity,recurrence,unused_policy,starts_at,ends_at,metadata)
  SELECT program,enrollment,mi.id,'affiliate',sl.creator_affiliate_id,v.creator_insertions_per_screen,'monthly',v.unused_insertions_policy,now(),now()+make_interval(months=v.creator_entitlement_months),jsonb_build_object('slot_id',sl.id,'separate_from_company',true)
  FROM public.media_inventory mi WHERE mi.source_type IN ('screen','company_screen') AND mi.source_id=p_screen ON CONFLICT DO NOTHING;
 END IF;
 INSERT INTO public.product_help_events(company_id,event_name,subject_type,subject_id,idempotency_key) VALUES(s.company_id,'screen_activated','screen_slot',sl.id,COALESCE(p_idempotency_key,'slot-activated:'||sl.id)) ON CONFLICT(idempotency_key) DO NOTHING;
 RETURN sl.id;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_expansion_payment(p_payment UUID,p_reason TEXT,p_idempotency_key TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e RECORD; total INTEGER:=0;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('expansion-reversal:'||p_idempotency_key,0));
 FOR e IN SELECT * FROM public.expansion_commission_entries WHERE payment_id=p_payment AND entry_kind<>'reversal' AND status NOT IN ('reversed','cancelled') FOR UPDATE LOOP
  INSERT INTO public.expansion_commission_entries(payment_id,subscription_id,slot_id,beneficiary_affiliate_id,beneficiary_role,entry_kind,amount_cents,status,rule_version_id,original_entry_id,idempotency_key,metadata)
  VALUES(e.payment_id,e.subscription_id,e.slot_id,e.beneficiary_affiliate_id,e.beneficiary_role,'reversal',-e.amount_cents,CASE WHEN e.status='paid' THEN 'receivable_adjustment' ELSE 'reversed' END,e.rule_version_id,e.id,
   p_idempotency_key||':'||e.id,jsonb_build_object('reason',p_reason)) ON CONFLICT(idempotency_key) DO NOTHING;
  UPDATE public.expansion_commission_entries SET status='reversed' WHERE id=e.id; total:=total+1;
 END LOOP;
 UPDATE public.expansion_payments SET status='refunded',updated_at=now() WHERE id=p_payment AND status='paid'; RETURN total;
END $$;

CREATE OR REPLACE FUNCTION public.save_expansion_preferred_locations(p_subscription UUID,p_inventory_ids UUID[])
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.company_plan_subscriptions%ROWTYPE; lim INTEGER; item UUID; pos INTEGER:=0;
BEGIN
 SELECT * INTO s FROM public.company_plan_subscriptions WHERE id=p_subscription;
 IF s.id IS NULL OR (auth.role()<>'service_role' AND NOT public.is_master_admin() AND s.company_id NOT IN (SELECT public.get_user_admin_company_ids())) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 lim:=COALESCE((s.frozen_snapshot->>'preferred_location_limit')::int,0); IF cardinality(COALESCE(p_inventory_ids,'{}'))>lim THEN RAISE EXCEPTION 'Limite de % locais preferenciais.',lim; END IF;
 DELETE FROM public.expansion_preferred_locations WHERE subscription_id=s.id;
 FOREACH item IN ARRAY COALESCE(p_inventory_ids,'{}') LOOP pos:=pos+1; INSERT INTO public.expansion_preferred_locations(subscription_id,inventory_id,priority) VALUES(s.id,item,pos); END LOOP;
 INSERT INTO public.product_help_events(user_id,company_id,event_name,subject_type,subject_id,idempotency_key) VALUES(auth.uid(),s.company_id,'preferred_locations_saved','subscription',s.id,'preferred:'||s.id||':'||extract(epoch from now())::bigint);
 RETURN pos;
END $$;

-- Protege campos economicos historicos; somente status operacional pode mudar.
CREATE OR REPLACE FUNCTION public.protect_expansion_commission_history() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
 IF ROW(NEW.payment_id,NEW.subscription_id,NEW.slot_id,NEW.beneficiary_affiliate_id,NEW.beneficiary_role,NEW.entry_kind,NEW.amount_cents,NEW.rule_version_id,NEW.original_entry_id,NEW.idempotency_key)
  IS DISTINCT FROM ROW(OLD.payment_id,OLD.subscription_id,OLD.slot_id,OLD.beneficiary_affiliate_id,OLD.beneficiary_role,OLD.entry_kind,OLD.amount_cents,OLD.rule_version_id,OLD.original_entry_id,OLD.idempotency_key)
 THEN RAISE EXCEPTION 'Historico economico imutavel; use reversal.'; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_protect_expansion_commission_history BEFORE UPDATE ON public.expansion_commission_entries FOR EACH ROW EXECUTE FUNCTION public.protect_expansion_commission_history();

-- RLS por empresa, Creator, Lider e Master.
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY['expansion_plans','expansion_plan_versions','expansion_commission_rule_versions','affiliate_relationships','company_plan_subscriptions','subscription_screen_slots','expansion_payments','expansion_commission_entries','expansion_preferred_locations','onboarding_flows','onboarding_steps','user_onboarding_progress','help_articles','product_help_events'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;
CREATE POLICY "Expansion plans public read" ON public.expansion_plans FOR SELECT TO anon,authenticated USING((status='active' AND public_available) OR public.is_master_admin());
CREATE POLICY "Expansion plan versions public read" ON public.expansion_plan_versions FOR SELECT TO anon,authenticated USING(effective_from<=now() AND effective_to IS NULL OR public.is_master_admin());
CREATE POLICY "Expansion rules participant read" ON public.expansion_commission_rule_versions FOR SELECT TO authenticated USING(effective_from<=now() AND effective_to IS NULL OR public.is_master_admin());
CREATE POLICY "Affiliate relationships scoped read" ON public.affiliate_relationships FOR SELECT TO authenticated USING(public.is_master_admin() OR public.expansion_is_affiliate_owner(leader_affiliate_id) OR public.expansion_is_affiliate_owner(creator_affiliate_id));
CREATE POLICY "Subscriptions tenant read" ON public.company_plan_subscriptions FOR SELECT TO authenticated USING(public.is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()) OR public.expansion_is_affiliate_owner(origin_creator_affiliate_id) OR public.expansion_is_affiliate_owner(origin_leader_affiliate_id));
CREATE POLICY "Slots scoped read" ON public.subscription_screen_slots FOR SELECT TO authenticated USING(public.is_master_admin() OR subscription_id IN (SELECT id FROM public.company_plan_subscriptions) OR public.expansion_is_affiliate_owner(creator_affiliate_id) OR public.expansion_is_affiliate_owner(leader_affiliate_id));
CREATE POLICY "Payments tenant read" ON public.expansion_payments FOR SELECT TO authenticated USING(public.is_master_admin() OR subscription_id IN (SELECT id FROM public.company_plan_subscriptions));
CREATE POLICY "Commissions beneficiary read" ON public.expansion_commission_entries FOR SELECT TO authenticated USING(public.is_master_admin() OR public.expansion_is_affiliate_owner(beneficiary_affiliate_id));
CREATE POLICY "Expansion preferences tenant read" ON public.expansion_preferred_locations FOR SELECT TO authenticated USING(public.is_master_admin() OR subscription_id IN (SELECT id FROM public.company_plan_subscriptions));
CREATE POLICY "Onboarding flows visible" ON public.onboarding_flows FOR SELECT TO authenticated USING(status='active' OR public.is_master_admin());
CREATE POLICY "Onboarding steps visible" ON public.onboarding_steps FOR SELECT TO authenticated USING(flow_id IN (SELECT id FROM public.onboarding_flows));
CREATE POLICY "Onboarding progress self" ON public.user_onboarding_progress FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.is_master_admin());
CREATE POLICY "Help articles public read" ON public.help_articles FOR SELECT TO anon,authenticated USING(status='published' OR public.is_master_admin());
CREATE POLICY "Help events self read" ON public.product_help_events FOR SELECT TO authenticated USING(user_id=auth.uid() OR company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());

REVOKE INSERT,UPDATE,DELETE ON public.expansion_plans,public.expansion_plan_versions,public.expansion_commission_rule_versions,public.affiliate_relationships,
 public.company_plan_subscriptions,public.subscription_screen_slots,public.expansion_payments,public.expansion_commission_entries,public.expansion_preferred_locations,
 public.onboarding_flows,public.onboarding_steps,public.help_articles FROM anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_expansion_affiliate_relationship(UUID,UUID,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_expansion_subscription(UUID,TEXT,INTEGER,TEXT,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_expansion_payment(UUID,TEXT,TEXT,BIGINT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_expansion_payment_intent(UUID,TEXT,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.attach_expansion_payment_provider(UUID,TEXT,JSONB) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.activate_expansion_screen_slot(UUID,UUID,UUID,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reverse_expansion_payment(UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_expansion_preferred_locations(UUID,UUID[]) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_my_expansion_onboarding() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_version_expansion_plan(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_version_expansion_commission_rule(JSONB) TO authenticated;

COMMENT ON TABLE public.expansion_commission_entries IS 'Comissao financeira do programa; nao representa Credito MPM nem habilita cash-out.';
COMMENT ON COLUMN public.subscription_screen_slots.economic_weight_cents IS 'Peso do valor real contratado atribuido ao slot; nao e preco unitario comercial.';
