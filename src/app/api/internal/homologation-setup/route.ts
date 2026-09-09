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
          password: 'midiapormidia@123',
          email_confirm: true,
          user_metadata: {
            full_name: `HOMOLOGAÇÃO MPM — ${key.toUpperCase()}`,
            is_homologation: true,
            initial_password_set: true,
            must_change_password: true,
          },
        });

        if (createError) {
          return NextResponse.json({ success: false, error: `Erro ao criar usuário ${email}: ${createError.message}` }, { status: 500 });
        }
        found = newUser.user;
      }

      if (found) {
        userIds[key] = found.id;

        // Garante que a senha inicial padrão midiapormidia@123 esteja definida e e-mail confirmado
        await admin.auth.admin.updateUserById(found.id, {
          password: 'midiapormidia@123',
          email_confirm: true,
          user_metadata: {
            ...(found.user_metadata || {}),
            full_name: `HOMOLOGAÇÃO MPM — ${key.toUpperCase()}`,
            is_homologation: true,
            initial_password_set: true,
            must_change_password: true,
          },
        });
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
    const { data: allLeaderMatches } = await db
      .from('affiliate_profiles')
      .select('id, attribution_code, user_id')
      .or(`attribution_code.ilike.LIDER-HOMOLOG,user_id.eq.${userIds.lider}`);

    const existingLeaderAff = allLeaderMatches?.[0];

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
    const { data: allCreatorMatches } = await db
      .from('affiliate_profiles')
      .select('id, attribution_code, user_id')
      .or(`attribution_code.ilike.CREATOR-HOMOLOG,user_id.eq.${userIds.creator}`);

    const existingCreatorAff = allCreatorMatches?.[0];

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
      media_value_score: 95.0,
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
      media_value_score: 95.0,
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

    const { data: cpData, error: cpErrFull } = await db
      .from('creator_profiles')
      .upsert(creatorFullPayload, { onConflict: 'user_id' })
      .select('id')
      .maybeSingle();

    if (cpErrFull) {
      const { data: cpBaseData, error: cpErrBase } = await db
        .from('creator_profiles')
        .upsert(creatorBasePayload, { onConflict: 'user_id' })
        .select('id')
        .single();
      if (cpErrBase) {
        return NextResponse.json({ success: false, step: 'creator_profiles upsert', error: cpErrBase.message }, { status: 500 });
      }
      creatorProfileId = cpBaseData?.id;
    } else {
      creatorProfileId = cpData?.id;
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
        if (relErr && !relErr.message?.includes('uq_creator_active_leader') && relErr.code !== '23505') {
          return NextResponse.json({ success: false, step: 'affiliate_relationships', error: relErr.message }, { status: 500 });
        }
      }
    }
    stepsDone.leaderToCreatorRel = true;

    // 6. Empresa Teste (companies + company_users + wallet)
    let companyId: string | null = null;
    const companyBasePayload = {
      trade_name: 'HOMOLOGAÇÃO MPM — Empresa Teste',
      corporate_name: 'HOMOLOGAÇÃO MPM — Empresa Teste LTDA',
      cnpj: '11222333000199',
      city: 'Cuiabá',
      state: 'MT',
      accepts_external_media: true,
      accepts_exchange: true,
    };

    const { data: compUpsert } = await db
      .from('companies')
      .upsert(companyBasePayload, { onConflict: 'cnpj' })
      .select('id')
      .maybeSingle();

    if (compUpsert) {
      companyId = compUpsert.id;
    } else {
      const { data: foundComp } = await db.from('companies').select('id').ilike('trade_name', '%Empresa Teste%').limit(1);
      companyId = foundComp?.[0]?.id || null;
    }

    if (companyId) {
      // Associação Company User
      const { data: existingCUs } = await db
        .from('company_users')
        .select('id')
        .eq('company_id', companyId)
        .eq('user_id', userIds.empresa);

      if (!existingCUs || existingCUs.length === 0) {
        await db.from('company_users').insert({
          company_id: companyId,
          user_id: userIds.empresa,
          role: 'admin',
          is_active: true,
        });
      }

      // Carteira
      const { data: existingWallets } = await db
        .from('wallets')
        .select('id')
        .eq('company_id', companyId);

      if (!existingWallets || existingWallets.length === 0) {
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
        { name: 'HOMOLOGAÇÃO MPM — TV Recepção', orientation: 'horizontal' },
        { name: 'HOMOLOGAÇÃO MPM — TV Salão Principal', orientation: 'horizontal' },
        { name: 'HOMOLOGAÇÃO MPM — TV Vitrine', orientation: 'vertical' },
      ];

      const { data: allCompScreens } = await db
        .from('screens')
        .select('id, name')
        .eq('company_id', companyId);

      for (const sdef of screenDefinitions) {
        const existing = allCompScreens?.find((s: any) => s.name === sdef.name);
        if (existing) {
          screensCreated.push(existing);
        } else {
          const { data: newScreen, error: scrErr } = await db.from('screens').insert({
            company_id: companyId,
            name: sdef.name,
            orientation: sdef.orientation,
            status: 'online',
          }).select('id, name').single();

          if (scrErr) {
            return NextResponse.json({ success: false, step: `screen ${sdef.name}`, error: scrErr.message }, { status: 500 });
          }
          if (newScreen) screensCreated.push(newScreen);
        }
      }
    }
    stepsDone.screens = screensCreated;

    // 8. Plano 3 TVs e Assinatura de Expansão (Líder -> Creator -> Empresa -> 3 TVs)
    let planId: string | null = null;
    let planVersionId: string | null = null;
    let ruleVersionId: string | null = null;

    const { data: plans } = await db
      .from('expansion_plans')
      .select('id, code')
      .or('code.eq.mpm-3-tvs,code.ilike.%3-tv%');

    const matchedPlan = plans?.find((p: any) => p.code === 'mpm-3-tvs') || plans?.[0];
    planId = matchedPlan?.id;

    if (planId) {
      const { data: versions } = await db
        .from('expansion_plan_versions')
        .select('id')
        .eq('plan_id', planId)
        .order('version', { ascending: false })
        .limit(1);
      planVersionId = versions?.[0]?.id;
    }

    const { data: rules } = await db
      .from('expansion_commission_rule_versions')
      .select('id')
      .is('effective_to', null)
      .order('version', { ascending: false })
      .limit(1);

    ruleVersionId = rules?.[0]?.id;

    let subscriptionId: string | null = null;
    if (companyId && planId && planVersionId && ruleVersionId && creatorAffiliateId && leaderAffiliateId) {
      const { data: existingSubs } = await db
        .from('company_plan_subscriptions')
        .select('id')
        .eq('company_id', companyId);

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
        frozen_snapshot: { plan_code: 'mpm-3-tvs', included_screens: 3, monthly_price_cents: 29900, simulated: true },
        idempotency_key: 'homolog-subscription-3-tvs',
        created_by: userIds.master,
      };

      const existingSub = existingSubs?.[0];
      if (existingSub) {
        subscriptionId = existingSub.id;
        await db.from('company_plan_subscriptions').update(subPayload).eq('id', subscriptionId);
      } else {
        const { data: newSub, error: se } = await db.from('company_plan_subscriptions').insert(subPayload).select('id').maybeSingle();
        if (se) {
          if (se.code === '23505' || se.message?.includes('uq_company_active_expansion_subscription')) {
            const { data: matchedSub } = await db.from('company_plan_subscriptions').select('id').eq('company_id', companyId).maybeSingle();
            subscriptionId = matchedSub?.id || null;
          } else {
            return NextResponse.json({ success: false, step: 'company_plan_subscriptions', error: se.message }, { status: 500 });
          }
        } else {
          subscriptionId = newSub?.id || null;
        }
      }

      if (subscriptionId && screensCreated.length === 3) {
        await db.from('subscription_screen_slots').delete().eq('subscription_id', subscriptionId);
        const screenIds = screensCreated.map((s: any) => s.id);
        await db.from('subscription_screen_slots').delete().in('screen_id', screenIds);

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
    const { data: opData, error: ope } = await db
      .from('organic_participants')
      .upsert({
        user_id: userIds.org,
        display_name: 'HOMOLOGAÇÃO MPM — Orgânico Teste',
        city: 'Cuiabá',
        state: 'MT',
        status: 'active',
      }, { onConflict: 'user_id' })
      .select('id')
      .single();

    if (ope) return NextResponse.json({ success: false, step: 'organic_participants', error: ope.message }, { status: 500 });
    organicParticipantId = opData?.id;

    let organicScreenName = '';
    if (organicParticipantId) {
      const { data: existingOSs } = await db
        .from('organic_screens')
        .select('id, name')
        .eq('participant_id', organicParticipantId);

      const existingOS = existingOSs?.find((s: any) => s.name === 'HOMOLOGAÇÃO MPM — Tela Residencial Sala') || existingOSs?.[0];

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
