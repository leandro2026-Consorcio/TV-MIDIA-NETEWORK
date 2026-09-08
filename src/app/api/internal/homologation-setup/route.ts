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
  const stepsDone: Record<string, any> = {};
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

        try {
          const { data: linkData } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email,
          });
          if (linkData?.properties?.action_link) {
            recoveryLinks[key] = linkData.properties.action_link;
          }
        } catch {
          // fallback
        }
      }
    }
    stepsDone.usersAuth = userIds;

    // 2. Perfis Públicos (profiles)
    for (const [key, email] of Object.entries(HOMOLOG_EMAILS)) {
      const isMaster = key === 'master';
      const fullName = `HOMOLOGAÇÃO MPM — ${key.charAt(0).toUpperCase() + key.slice(1)} Teste`;
      const { error: profErr } = await db.from('profiles').upsert({
        id: userIds[key],
        email,
        full_name: isMaster ? 'HOMOLOGAÇÃO MPM — Master Admin' : fullName,
        is_master_admin: isMaster,
      }, { onConflict: 'id' });
      if (profErr) {
        return NextResponse.json({ success: false, step: 'profiles', error: profErr.message }, { status: 500 });
      }
    }
    stepsDone.profiles = true;

    // 3. Perfil do Líder (affiliate_profiles com affiliate_type = 'partners')
    let leaderAffiliateId: string | null = null;
    const { data: existingLeaderAff } = await db
      .from('affiliate_profiles')
      .select('id')
      .eq('attribution_code', 'LIDER-HOMOLOG')
      .maybeSingle();

    if (existingLeaderAff) {
      leaderAffiliateId = existingLeaderAff.id;
      await db.from('affiliate_profiles').update({
        user_id: userIds.lider,
        display_name: 'HOMOLOGAÇÃO MPM — Líder Teste',
        affiliate_type: 'partners',
        status: 'active',
        metadata: { role: 'leader', env: 'homologation' },
      }).eq('id', leaderAffiliateId);
    } else {
      const { data: newLeaderAff, error: leadErr } = await db.from('affiliate_profiles').insert({
        user_id: userIds.lider,
        affiliate_type: 'partners',
        display_name: 'HOMOLOGAÇÃO MPM — Líder Teste',
        attribution_code: 'LIDER-HOMOLOG',
        status: 'active',
        metadata: { role: 'leader', env: 'homologation' },
      }).select('id').single();
      if (leadErr) {
        return NextResponse.json({ success: false, step: 'affiliate_profiles leader', error: leadErr.message }, { status: 500 });
      }
      leaderAffiliateId = newLeaderAff?.id;
    }
    stepsDone.leaderAffiliateId = leaderAffiliateId;

    // 4. Perfil do Creator (affiliate_profiles com affiliate_type = 'creators' + creator_profiles)
    let creatorAffiliateId: string | null = null;
    const { data: existingCreatorAff } = await db
      .from('affiliate_profiles')
      .select('id')
      .eq('attribution_code', 'CREATOR-HOMOLOG')
      .maybeSingle();

    if (existingCreatorAff) {
      creatorAffiliateId = existingCreatorAff.id;
      await db.from('affiliate_profiles').update({
        user_id: userIds.creator,
        display_name: 'HOMOLOGAÇÃO MPM — Creator Teste',
        affiliate_type: 'creators',
        status: 'active',
        metadata: { role: 'creator', env: 'homologation' },
      }).eq('id', creatorAffiliateId);
    } else {
      const { data: newCreatorAff, error: creatErr } = await db.from('affiliate_profiles').insert({
        user_id: userIds.creator,
        affiliate_type: 'creators',
        display_name: 'HOMOLOGAÇÃO MPM — Creator Teste',
        attribution_code: 'CREATOR-HOMOLOG',
        status: 'active',
        metadata: { role: 'creator', env: 'homologation' },
      }).select('id').single();
      if (creatErr) {
        return NextResponse.json({ success: false, step: 'affiliate_profiles creator', error: creatErr.message }, { status: 500 });
      }
      creatorAffiliateId = newCreatorAff?.id;
    }
    stepsDone.creatorAffiliateId = creatorAffiliateId;

    // Creator Profile (Tentativa completa e fallback resiliente)
    let creatorProfileId: string | null = null;
    const creatorFullPayload = {
      user_id: userIds.creator,
      display_name: 'HOMOLOGAÇÃO MPM — Creator Teste',
      slug: 'creator-teste-homologacao',
      bio: 'Perfil oficial de homologação controlada da rede Mídia por Mídia.',
      city: 'Cuiabá',
      state: 'MT',
      niches: ['Lifestyle', 'Varejo'],
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
      metadata: { env: 'homologation' },
    };

    const creatorBasePayload = {
      user_id: userIds.creator,
      display_name: 'HOMOLOGAÇÃO MPM — Creator Teste',
      bio: 'Perfil oficial de homologação controlada da rede Mídia por Mídia.',
      city: 'Cuiabá',
      state: 'MT',
      niches: ['Lifestyle', 'Varejo'],
      status: 'active',
      creator_score: 88.5,
      media_value_score: 125.0,
      tier: 'tier_b',
      metadata: {
        slug: 'creator-teste-homologacao',
        is_public_profile: true,
        show_followers_publicly: true,
        show_scores_publicly: true,
        show_pricing_publicly: true,
        is_verified: true,
        pricing_mode: 'dynamic',
        env: 'homologation',
      },
    };

    const { data: existingCreatorProf } = await db
      .from('creator_profiles')
      .select('id')
      .eq('user_id', userIds.creator)
      .maybeSingle();

    if (existingCreatorProf) {
      creatorProfileId = existingCreatorProf.id;
      const { error: cpErrFull } = await db.from('creator_profiles').update(creatorFullPayload).eq('id', creatorProfileId);
      if (cpErrFull) {
        const { error: cpErrBase } = await db.from('creator_profiles').update(creatorBasePayload).eq('id', creatorProfileId);
        if (cpErrBase) {
          return NextResponse.json({ success: false, step: 'creator_profiles update', error: cpErrBase.message }, { status: 500 });
        }
      }
    } else {
      const { data: newCPFull, error: cpErrFull } = await db.from('creator_profiles').insert(creatorFullPayload).select('id').maybeSingle();
      if (!cpErrFull && newCPFull) {
        creatorProfileId = newCPFull.id;
      } else {
        const { data: newCPBase, error: cpErrBase } = await db.from('creator_profiles').insert(creatorBasePayload).select('id').single();
        if (cpErrBase) {
          return NextResponse.json({ success: false, step: 'creator_profiles insert', error: cpErrBase.message }, { status: 500 });
        }
        creatorProfileId = newCPBase?.id;
      }
    }
    stepsDone.creatorProfileId = creatorProfileId;

    // 5. Vínculo Hierárquico Líder -> Creator (affiliate_relationships)
    if (leaderAffiliateId && creatorAffiliateId) {
      const { data: existingRel } = await db
        .from('affiliate_relationships')
        .select('id')
        .eq('creator_affiliate_id', creatorAffiliateId)
        .eq('status', 'active')
        .is('ends_at', null)
        .maybeSingle();

      if (!existingRel) {
        const { error: relErr } = await db.from('affiliate_relationships').insert({
          leader_affiliate_id: leaderAffiliateId,
          creator_affiliate_id: creatorAffiliateId,
          status: 'active',
          metadata: { env: 'homologation' },
        });
        if (relErr) {
          return NextResponse.json({ success: false, step: 'affiliate_relationships', error: relErr.message }, { status: 500 });
        }
      }
    }
    stepsDone.leaderToCreatorRel = true;

    // 6. Empresa Teste (companies + company_users + wallet)
    let companyId: string | null = null;
    const { data: existingComp } = await db
      .from('companies')
      .select('id')
      .eq('cnpj', '11222333000199')
      .maybeSingle();

    const companyFullPayload = {
      trade_name: 'HOMOLOGAÇÃO MPM — Empresa Teste',
      corporate_name: 'HOMOLOGAÇÃO MPM — Empresa Teste LTDA',
      cnpj: '11222333000199',
      city: 'Cuiabá',
      state: 'MT',
      accepts_external_media: true,
      accepts_exchange: true,
      show_name_publicly: true,
      show_in_marketplace: true,
      show_on_map: true,
      allow_automatic_campaigns: false,
    };

    const companyBasePayload = {
      trade_name: 'HOMOLOGAÇÃO MPM — Empresa Teste',
      corporate_name: 'HOMOLOGAÇÃO MPM — Empresa Teste LTDA',
      cnpj: '11222333000199',
      city: 'Cuiabá',
      state: 'MT',
      accepts_external_media: true,
      accepts_exchange: true,
    };

    if (existingComp) {
      companyId = existingComp.id;
      const { error: ceFull } = await db.from('companies').update(companyFullPayload).eq('id', companyId);
      if (ceFull) {
        await db.from('companies').update(companyBasePayload).eq('id', companyId);
      }
    } else {
      const { data: newCompFull, error: compErrFull } = await db.from('companies').insert(companyFullPayload).select('id').maybeSingle();
      if (!compErrFull && newCompFull) {
        companyId = newCompFull.id;
      } else {
        const { data: newCompBase, error: compErrBase } = await db.from('companies').insert(companyBasePayload).select('id').single();
        if (compErrBase) {
          return NextResponse.json({ success: false, step: 'companies', error: compErrBase.message }, { status: 500 });
        }
        companyId = newCompBase?.id;
      }
    }

    if (companyId) {
      // Associação Company User
      const { data: existingCU } = await db
        .from('company_users')
        .select('id')
        .eq('company_id', companyId)
        .eq('user_id', userIds.empresa)
        .maybeSingle();

      if (!existingCU) {
        await db.from('company_users').insert({
          company_id: companyId,
          user_id: userIds.empresa,
          role: 'admin',
          is_active: true,
        });
      }

      // Carteira
      const { data: existingWallet } = await db
        .from('wallets')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();

      if (!existingWallet) {
        await db.from('wallets').insert({
          company_id: companyId,
          balance: 0.00,
        });
      }
    }
    stepsDone.companyId = companyId;

    // 7. 3 Telas Comerciais da Empresa (screens)
    const screensCreated: any[] = [];
    if (companyId) {
      const screenDefinitions = [
        { name: 'HOMOLOGAÇÃO MPM — TV Recepção', venue_category: 'Recepção Comercial', orientation: 'horizontal', price: 45 },
        { name: 'HOMOLOGAÇÃO MPM — TV Salão Principal', venue_category: 'Salão de Atendimento', orientation: 'horizontal', price: 60 },
        { name: 'HOMOLOGAÇÃO MPM — TV Vitrine', venue_category: 'Vitrine Externa', orientation: 'vertical', price: 75 },
      ];

      for (const sdef of screenDefinitions) {
        const { data: existingScreen } = await db
          .from('screens')
          .select('id, name')
          .eq('company_id', companyId)
          .eq('name', sdef.name)
          .maybeSingle();

        if (existingScreen) {
          screensCreated.push(existingScreen);
        } else {
          const screenFullPayload = {
            company_id: companyId,
            name: sdef.name,
            venue_type: 'commercial',
            venue_category: sdef.venue_category,
            orientation: sdef.orientation,
            is_public_screen: true,
            show_on_map: true,
            indicative_price_credits: sdef.price,
            status: 'online',
          };
          const screenBasePayload = {
            company_id: companyId,
            name: sdef.name,
            orientation: sdef.orientation,
            status: 'online',
          };

          const { data: newScreenFull, error: scrErrFull } = await db.from('screens').insert(screenFullPayload).select('id, name').maybeSingle();
          if (!scrErrFull && newScreenFull) {
            screensCreated.push(newScreenFull);
          } else {
            const { data: newScreenBase, error: scrErrBase } = await db.from('screens').insert(screenBasePayload).select('id, name').single();
            if (scrErrBase) {
              return NextResponse.json({ success: false, step: `screen ${sdef.name}`, error: scrErrBase.message }, { status: 500 });
            }
            if (newScreenBase) screensCreated.push(newScreenBase);
          }
        }
      }
    }
    stepsDone.screens = screensCreated;

    // 8. Plano 3 TVs e Assinatura de Expansão (Líder -> Creator -> Empresa -> 3 TVs)
    let planId: string | null = null;
    let planVersionId: string | null = null;
    let ruleVersionId: string | null = null;

    const { data: existingPlan } = await db.from('expansion_plans').select('id').eq('code', 'expansion-3-tvs').maybeSingle();
    if (existingPlan) {
      planId = existingPlan.id;
    } else {
      const { data: np, error: pe } = await db.from('expansion_plans').insert({
        code: 'expansion-3-tvs',
        name: 'Plano 3 TVs',
        description: 'Plano de homologação controlada com 3 telas indoor comerciais.',
        status: 'active',
        public_available: true,
        display_order: 2,
      }).select('id').single();
      if (pe) return NextResponse.json({ success: false, step: 'expansion_plans', error: pe.message }, { status: 500 });
      planId = np?.id;
    }

    if (planId) {
      const { data: existingVer } = await db.from('expansion_plan_versions').select('id').eq('plan_id', planId).maybeSingle();
      if (existingVer) {
        planVersionId = existingVer.id;
      } else {
        const { data: nv, error: ve } = await db.from('expansion_plan_versions').insert({
          plan_id: planId,
          version: 1,
          included_screens: 3,
          monthly_price_cents: 29900,
          extra_screen_price_cents: 5900,
          days_until_second_charge: 60,
          recurring_interval_months: 1,
          commission_release_policy: 'proportional_to_activated_screens',
        }).select('id').single();
        if (ve) return NextResponse.json({ success: false, step: 'expansion_plan_versions', error: ve.message }, { status: 500 });
        planVersionId = nv?.id;
      }
    }

    const { data: ruleVer } = await db.from('expansion_commission_rule_versions').select('id').is('effective_to', null).limit(1).maybeSingle();
    if (ruleVer) {
      ruleVersionId = ruleVer.id;
    } else {
      const { data: nr, error: re } = await db.from('expansion_commission_rule_versions').insert({
        version: 1,
        name: 'Regra Padrão Expansão',
        first_platform_percent: 10.0,
        first_creator_percent: 67.1141,
        first_leader_percent: 22.8859,
        recurring_platform_percent: 73.1544,
        recurring_creator_percent: 16.7785,
        recurring_leader_percent: 10.0671,
      }).select('id').single();
      if (re) return NextResponse.json({ success: false, step: 'expansion_commission_rule_versions', error: re.message }, { status: 500 });
      ruleVersionId = nr?.id;
    }

    let subscriptionId: string | null = null;
    if (companyId && planId && planVersionId && ruleVersionId && creatorAffiliateId && leaderAffiliateId) {
      const { data: existingSub } = await db
        .from('company_plan_subscriptions')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();

      const subPayload = {
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
        created_by: userIds.master,
      };

      if (existingSub) {
        subscriptionId = existingSub.id;
        await db.from('company_plan_subscriptions').update(subPayload).eq('id', subscriptionId);
      } else {
        const { data: newSub, error: se } = await db.from('company_plan_subscriptions').insert(subPayload).select('id').single();
        if (se) return NextResponse.json({ success: false, step: 'company_plan_subscriptions', error: se.message }, { status: 500 });
        subscriptionId = newSub?.id;
      }

      if (subscriptionId && screensCreated.length === 3) {
        await db.from('subscription_screen_slots').delete().eq('subscription_id', subscriptionId);

        const { error: slotErr } = await db.from('subscription_screen_slots').insert([
          { subscription_id: subscriptionId, slot_index: 1, slot_type: 'included', economic_weight_cents: 9967, screen_id: screensCreated[0].id, status: 'active', creator_affiliate_id: creatorAffiliateId, leader_affiliate_id: leaderAffiliateId, activated_at: new Date().toISOString() },
          { subscription_id: subscriptionId, slot_index: 2, slot_type: 'included', economic_weight_cents: 9967, screen_id: screensCreated[1].id, status: 'active', creator_affiliate_id: creatorAffiliateId, leader_affiliate_id: leaderAffiliateId, activated_at: new Date().toISOString() },
          { subscription_id: subscriptionId, slot_index: 3, slot_type: 'included', economic_weight_cents: 9966, screen_id: screensCreated[2].id, status: 'active', creator_affiliate_id: creatorAffiliateId, leader_affiliate_id: leaderAffiliateId, activated_at: new Date().toISOString() },
        ]);
        if (slotErr) {
          return NextResponse.json({ success: false, step: 'subscription_screen_slots', error: slotErr.message }, { status: 500 });
        }
      }
    }
    stepsDone.subscriptionId = subscriptionId;

    // 9. Pessoa Física / Rede Orgânica (1 Tela Residencial Protegida)
    let organicParticipantId: string | null = null;
    const { data: existingOrgPart } = await db
      .from('organic_participants')
      .select('id')
      .eq('user_id', userIds.org)
      .maybeSingle();

    if (existingOrgPart) {
      organicParticipantId = existingOrgPart.id;
    } else {
      const { data: newOP, error: ope } = await db.from('organic_participants').insert({
        user_id: userIds.org,
        display_name: 'HOMOLOGAÇÃO MPM — Orgânico Teste',
        city: 'Cuiabá',
        state: 'MT',
        status: 'active',
      }).select('id').single();
      if (ope) return NextResponse.json({ success: false, step: 'organic_participants', error: ope.message }, { status: 500 });
      organicParticipantId = newOP?.id;
    }

    let organicScreenName = '';
    if (organicParticipantId) {
      const { data: existingOS } = await db
        .from('organic_screens')
        .select('id, name')
        .eq('participant_id', organicParticipantId)
        .eq('name', 'HOMOLOGAÇÃO MPM — Tela Residencial Sala')
        .maybeSingle();

      if (existingOS) {
        organicScreenName = existingOS.name;
      } else {
        const { data: newOS, error: ose } = await db.from('organic_screens').insert({
          participant_id: organicParticipantId,
          name: 'HOMOLOGAÇÃO MPM — Tela Residencial Sala',
          device_type: 'organic_tv',
          orientation: 'horizontal',
          status: 'online',
        }).select('id, name').single();
        if (ose) return NextResponse.json({ success: false, step: 'organic_screens', error: ose.message }, { status: 500 });
        organicScreenName = newOS?.name || '';
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Homologação provisionada com sucesso.',
      users: userIds,
      recoveryLinks,
      links: {
        leaderToCreator: Boolean(leaderAffiliateId && creatorAffiliateId),
        creatorToEmpresa: Boolean(companyId && creatorAffiliateId),
        empresaToPlan3Tvs: Boolean(subscriptionId),
        screensCount: screensCreated.length,
        pfResidentialScreen: organicScreenName || 'HOMOLOGAÇÃO MPM — Tela Residencial Sala',
      },
      details: stepsDone,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, stepsDone }, { status: 500 });
  }
}
