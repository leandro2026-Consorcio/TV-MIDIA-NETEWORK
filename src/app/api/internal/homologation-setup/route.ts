import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOMOLOG_EMAILS = {
  master: 'homolog.master@msdeducacao.com.br',
  empresa: 'homolog.empresa@msdeducacao.com.br',
  creator: 'homolog.creator@msdeducacao.com.br',
  lider: 'homolog.lider@msdeducacao.com.br',
  org: 'homolog.org@msdeducacao.com.br',
};

export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const db: any = admin;

    // 1. Obter ou Criar Usuários no Supabase Auth
    const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      return NextResponse.json({ success: false, error: `Erro ao listar usuários do Auth: ${listError.message}` }, { status: 500 });
    }

    const existingUsers = usersData?.users || [];
    const userIds: Record<string, string> = {};
    const recoveryLinks: Record<string, string> = {};

    for (const [key, email] of Object.entries(HOMOLOG_EMAILS)) {
      let found = existingUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());

      if (!found) {
        // Criar usuário via Supabase Auth Admin de forma segura (sem senha em código)
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: `HOMOLOGAÇÃO MPM — ${key.toUpperCase()}`,
            is_homologation: true,
          },
        });

        if (createError) {
          return NextResponse.json({ success: false, error: `Erro ao criar usuário ${email}: ${createError.message}` }, { status: 500 });
        }
        found = newUser.user;
      }

      if (found) {
        userIds[key] = found.id;

        // Gerar link de primeiro acesso / reset seguro oficial
        try {
          const { data: linkData } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email,
          });
          if (linkData?.properties?.action_link) {
            recoveryLinks[key] = linkData.properties.action_link;
          }
        } catch {
          // fallback silencioso se serviço SMTP gerir diretamente
        }
      }
    }

    // 2. Perfis Públicos (profiles)
    await db.from('profiles').upsert([
      { id: userIds.master, email: HOMOLOG_EMAILS.master, full_name: 'HOMOLOGAÇÃO MPM — Master Admin', is_master_admin: true },
      { id: userIds.empresa, email: HOMOLOG_EMAILS.empresa, full_name: 'HOMOLOGAÇÃO MPM — Empresa Teste', is_master_admin: false },
      { id: userIds.creator, email: HOMOLOG_EMAILS.creator, full_name: 'HOMOLOGAÇÃO MPM — Creator Teste', is_master_admin: false },
      { id: userIds.lider, email: HOMOLOG_EMAILS.lider, full_name: 'HOMOLOGAÇÃO MPM — Líder Teste', is_master_admin: false },
      { id: userIds.org, email: HOMOLOG_EMAILS.org, full_name: 'HOMOLOGAÇÃO MPM — Orgânico Teste', is_master_admin: false },
    ]);

    // 3. Perfil do Líder (affiliate_profiles)
    const { data: leaderAffiliate } = await db.from('affiliate_profiles').upsert({
      user_id: userIds.lider,
      role: 'leader',
      display_name: 'HOMOLOGAÇÃO MPM — Líder Teste',
      attribution_code: 'LIDER-HOMOLOG',
      status: 'active',
    }, { onConflict: 'attribution_code' }).select('id').single();

    const leaderAffiliateId = leaderAffiliate?.id;

    // 4. Perfil do Creator (affiliate_profiles + creator_profiles)
    const { data: creatorAffiliate } = await db.from('affiliate_profiles').upsert({
      user_id: userIds.creator,
      role: 'creator',
      display_name: 'HOMOLOGAÇÃO MPM — Creator Teste',
      attribution_code: 'CREATOR-HOMOLOG',
      status: 'active',
    }, { onConflict: 'attribution_code' }).select('id').single();

    const creatorAffiliateId = creatorAffiliate?.id;

    const { data: creatorProfile } = await db.from('creator_profiles').upsert({
      user_id: userIds.creator,
      display_name: 'HOMOLOGAÇÃO MPM — Creator Teste',
      slug: 'creator-teste-homologacao',
      bio: 'Perfil oficial de homologação controlada da rede Mídia por Mídia.',
      city: 'Cuiabá',
      state: 'MT',
      niche: 'Lifestyle & Varejo',
      is_public_profile: true,
      show_followers_publicly: true,
      show_scores_publicly: true,
      show_pricing_publicly: true,
      is_verified: true,
      pricing_mode: 'dynamic',
      status: 'active',
      creator_score: 88.5,
      media_value_score: 125.0,
      tier: 'tier_b',
    }, { onConflict: 'slug' }).select('id').single();

    // 5. Vínculo Hierárquico Líder -> Creator (affiliate_relationships)
    if (leaderAffiliateId && creatorAffiliateId) {
      await db.from('affiliate_relationships').upsert({
        leader_affiliate_id: leaderAffiliateId,
        creator_affiliate_id: creatorAffiliateId,
        status: 'active',
        metadata: { env: 'homologation' },
      });
    }

    // 6. Empresa Teste (companies + company_users + wallet)
    const { data: companyData } = await db.from('companies').upsert({
      trade_name: 'HOMOLOGAÇÃO MPM — Empresa Teste',
      corporate_name: 'HOMOLOGAÇÃO MPM — Empresa Teste LTDA',
      cnpj: '11222333000199',
      city: 'Cuiabá',
      state: 'MT',
      is_active: true,
      show_name_publicly: true,
      show_in_marketplace: true,
      show_on_map: true,
      allow_automatic_campaigns: false,
    }, { onConflict: 'trade_name' }).select('id').single();

    const companyId = companyData?.id;

    if (companyId) {
      await db.from('company_users').upsert({
        company_id: companyId,
        user_id: userIds.empresa,
        role: 'admin',
        is_active: true,
      }, { onConflict: 'company_id,user_id' });

      await db.from('wallets').upsert({
        company_id: companyId,
        balance: 0.00,
      }, { onConflict: 'company_id' });
    }

    // 7. 3 Telas Comerciais da Empresa
    const screensCreated: any[] = [];
    if (companyId) {
      const screenPayloads = [
        { company_id: companyId, name: 'HOMOLOGAÇÃO MPM — TV Recepção', venue_type: 'commercial', venue_category: 'Recepção Comercial', city: 'Cuiabá', state: 'MT', orientation: 'horizontal', is_active: true, is_public_screen: true, show_on_map: true, indicative_price_credits: 45 },
        { company_id: companyId, name: 'HOMOLOGAÇÃO MPM — TV Salão Principal', venue_type: 'commercial', venue_category: 'Salão de Atendimento', city: 'Cuiabá', state: 'MT', orientation: 'horizontal', is_active: true, is_public_screen: true, show_on_map: true, indicative_price_credits: 60 },
        { company_id: companyId, name: 'HOMOLOGAÇÃO MPM — TV Vitrine', venue_type: 'commercial', venue_category: 'Vitrine Externa', city: 'Cuiabá', state: 'MT', orientation: 'vertical', is_active: true, is_public_screen: true, show_on_map: true, indicative_price_credits: 75 },
      ];

      for (const sp of screenPayloads) {
        const { data: sc } = await db.from('screens').upsert(sp, { onConflict: 'company_id,name' }).select('id, name').single();
        if (sc) screensCreated.push(sc);
      }
    }

    // 8. Plano 3 TVs e Assinatura de Expansão (Líder -> Creator -> Empresa -> 3 TVs)
    let planId: string | null = null;
    let planVersionId: string | null = null;
    let ruleVersionId: string | null = null;

    const { data: existingPlan } = await db.from('expansion_plans').select('id').eq('code', 'expansion-3-tvs').maybeSingle();
    if (existingPlan) {
      planId = existingPlan.id;
    } else {
      const { data: np } = await db.from('expansion_plans').insert({
        code: 'expansion-3-tvs',
        name: 'Plano 3 TVs',
        description: 'Plano de homologação controlada com 3 telas indoor comerciais.',
        status: 'active',
        public_available: true,
        display_order: 2,
      }).select('id').single();
      planId = np?.id;
    }

    if (planId) {
      const { data: existingVer } = await db.from('expansion_plan_versions').select('id').eq('plan_id', planId).maybeSingle();
      if (existingVer) {
        planVersionId = existingVer.id;
      } else {
        const { data: nv } = await db.from('expansion_plan_versions').insert({
          plan_id: planId,
          version: 1,
          included_screens: 3,
          monthly_price_cents: 29900,
          extra_screen_price_cents: 5900,
          days_until_second_charge: 60,
          recurring_interval_months: 1,
          commission_release_policy: 'proportional_to_activated_screens',
        }).select('id').single();
        planVersionId = nv?.id;
      }
    }

    const { data: ruleVer } = await db.from('expansion_commission_rule_versions').select('id').limit(1).maybeSingle();
    ruleVersionId = ruleVer?.id;

    if (companyId && planId && planVersionId && ruleVersionId && creatorAffiliateId && leaderAffiliateId) {
      const { data: subData } = await db.from('company_plan_subscriptions').upsert({
        company_id: companyId,
        plan_id: planId,
        plan_version_id: planVersionId,
        commission_rule_version_id: ruleVersionId,
        origin_creator_affiliate_id: creatorAffiliateId,
        origin_leader_affiliate_id: leaderAffiliateId,
        requested_screens: 3,
        contracted_amount_cents: 29900,
        status: 'active',
        frozen_snapshot: { plan_code: 'expansion-3-tvs', included_screens: 3, monthly_price_cents: 29900, simulated: true },
        idempotency_key: 'homolog-subscription-3-tvs',
      }, { onConflict: 'company_id' }).select('id').single();

      const subscriptionId = subData?.id;

      if (subscriptionId && screensCreated.length === 3) {
        await db.from('subscription_screen_slots').delete().eq('subscription_id', subscriptionId);

        await db.from('subscription_screen_slots').insert([
          { subscription_id: subscriptionId, slot_index: 1, slot_type: 'included', economic_weight_cents: 9967, screen_id: screensCreated[0].id, status: 'active', creator_affiliate_id: creatorAffiliateId, leader_affiliate_id: leaderAffiliateId, activated_at: new Date().toISOString() },
          { subscription_id: subscriptionId, slot_index: 2, slot_type: 'included', economic_weight_cents: 9967, screen_id: screensCreated[1].id, status: 'active', creator_affiliate_id: creatorAffiliateId, leader_affiliate_id: leaderAffiliateId, activated_at: new Date().toISOString() },
          { subscription_id: subscriptionId, slot_index: 3, slot_type: 'included', economic_weight_cents: 9966, screen_id: screensCreated[2].id, status: 'active', creator_affiliate_id: creatorAffiliateId, leader_affiliate_id: leaderAffiliateId, activated_at: new Date().toISOString() },
        ]);
      }
    }

    // 9. Pessoa Física / Rede Orgânica (1 Tela Residencial Protegida)
    await db.from('organic_participants').upsert({
      user_id: userIds.org,
      full_name: 'HOMOLOGAÇÃO MPM — Orgânico Teste',
      status: 'active',
    }, { onConflict: 'user_id' });

    const { data: resScreen } = await db.from('screens').upsert({
      name: 'HOMOLOGAÇÃO MPM — Tela Residencial Sala',
      venue_type: 'residential',
      venue_category: 'Residência Particular',
      city: 'Cuiabá',
      state: 'MT',
      orientation: 'horizontal',
      is_active: true,
      is_public_screen: false,
      show_on_map: false,
      device_type: 'tv',
    }, { onConflict: 'name' }).select('id, name, venue_type, show_on_map').single();

    return NextResponse.json({
      success: true,
      message: 'Homologação provisionada com sucesso.',
      users: userIds,
      recoveryLinks,
      links: {
        leaderToCreator: Boolean(leaderAffiliateId && creatorAffiliateId),
        creatorToEmpresa: Boolean(companyId && creatorAffiliateId),
        empresaToPlan3Tvs: true,
        screensCount: screensCreated.length,
        pfResidentialScreen: resScreen?.name,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
