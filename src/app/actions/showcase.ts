'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function getPublicShowcaseDataAction() {
  try {
    const supabase = createClient();
    const { data, error } = await (supabase.rpc as any)('get_public_showcase_data');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao carregar vitrine pública.' };
  }
}

export async function getCreatorPublicProfileAction(slugOrId: string) {
  try {
    const supabase = createClient();
    const { data, error } = await (supabase.rpc as any)('get_creator_public_profile', {
      p_identifier: slugOrId,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, profile: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao carregar perfil público do creator.' };
  }
}

export async function updateCompanyPrivacyAction(companyId: string, settings: {
  showLogoPublicly?: boolean;
  showNamePublicly?: boolean;
  showLocationPublicly?: boolean;
  showScreenCountPublicly?: boolean;
  showInMarketplace?: boolean;
  allowAutomaticCampaigns?: boolean;
  showOnMap?: boolean;
  mapPrivacyLevel?: 'public' | 'region_only' | 'hidden';
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (settings.showLogoPublicly !== undefined) updatePayload.show_logo_publicly = settings.showLogoPublicly;
    if (settings.showNamePublicly !== undefined) updatePayload.show_name_publicly = settings.showNamePublicly;
    if (settings.showLocationPublicly !== undefined) updatePayload.show_location_publicly = settings.showLocationPublicly;
    if (settings.showScreenCountPublicly !== undefined) updatePayload.show_screen_count_publicly = settings.showScreenCountPublicly;
    if (settings.showInMarketplace !== undefined) updatePayload.show_in_marketplace = settings.showInMarketplace;
    if (settings.allowAutomaticCampaigns !== undefined) updatePayload.allow_automatic_campaigns = settings.allowAutomaticCampaigns;
    if (settings.showOnMap !== undefined) updatePayload.show_on_map = settings.showOnMap;
    if (settings.mapPrivacyLevel !== undefined) updatePayload.map_privacy_level = settings.mapPrivacyLevel;

    const { error } = await (supabase.from('companies') as any)
      .update(updatePayload)
      .eq('id', companyId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/companies');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao atualizar privacidade da empresa.' };
  }
}
