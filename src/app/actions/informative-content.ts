'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchRssSource, importActiveRssSources, importRssSource, sanitizeRssText } from '@/lib/rss';

const CONTENT_STATUSES = ['draft', 'pending_review', 'approved', 'rejected', 'active', 'paused', 'expired', 'archived'] as const;
type ContentStatus = typeof CONTENT_STATUSES[number];

export interface InformativeContentInput {
  id?: string;
  companyId?: string | null;
  title: string;
  summary?: string | null;
  body?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  sourceName?: string | null;
  originalUrl?: string | null;
  publishedAt?: string | null;
  region?: string | null;
  city?: string | null;
  segment?: string | null;
  durationSeconds?: number;
  startDate?: string | null;
  endDate?: string | null;
  status?: ContentStatus;
  expiresAt?: string | null;
}

export interface ContentSourceInput {
  id?: string;
  sourceName: string;
  sourceUrl: string;
  category?: string | null;
  region?: string | null;
  city?: string | null;
  refreshIntervalMinutes?: number;
  expiryHours?: number;
  requiresManualApproval?: boolean;
  isActive?: boolean;
}

export interface ScreenContentSettingsInput {
  screenId: string;
  enableBreathingContent: boolean;
  enableManualContent: boolean;
  enableRssContent: boolean;
  adsBetweenContent: 3 | 4 | 5;
  contentDurationSeconds: number;
  allowedCategories: string[];
  fallbackToAds: boolean;
}

async function getActor() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isMaster: false };
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();
  return { supabase, user, isMaster: !!profile?.is_master_admin };
}

async function canAdminCompany(supabase: ReturnType<typeof createClient>, userId: string, companyId: string) {
  const { data } = await (supabase.from('company_users') as any)
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .eq('role', 'admin')
    .eq('is_active', true)
    .maybeSingle();
  return !!data;
}

function optionalText(value: unknown, maxLength: number): string | null {
  const normalized = sanitizeRssText(value, maxLength);
  return normalized || null;
}

function optionalHttpUrl(value?: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function getInformativeContentsAction(filters?: {
  status?: string;
  category?: string;
  region?: string;
  city?: string;
}) {
  const { supabase, user, isMaster } = await getActor();
  if (!user) return { success: false, items: [], error: 'Usuário não autenticado.' };
  if (!isMaster) return { success: false, items: [], error: 'Acesso restrito ao Master Admin.' };

  let query = (supabase.from('informative_content_items') as any)
    .select('*, content_sources(source_name, source_url)')
    .order('created_at', { ascending: false })
    .limit(250);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.category) query = query.ilike('category', `%${filters.category}%`);
  if (filters?.region) query = query.ilike('region', `%${filters.region}%`);
  if (filters?.city) query = query.ilike('city', `%${filters.city}%`);
  const { data, error } = await query;
  return error
    ? { success: false, items: [], error: error.message }
    : { success: true, items: data || [], error: null };
}

export async function saveInformativeContentAction(input: InformativeContentInput) {
  const { supabase, user, isMaster } = await getActor();
  if (!user) return { success: false, error: 'Usuário não autenticado.' };

  const companyId = input.companyId || null;
  if (!isMaster && (!companyId || !(await canAdminCompany(supabase, user.id, companyId)))) {
    return { success: false, error: 'Apenas Master Admin ou Admin da empresa pode salvar conteúdo.' };
  }

  const title = sanitizeRssText(input.title, 180);
  if (title.length < 2) return { success: false, error: 'Título deve ter pelo menos 2 caracteres.' };
  const duration = Math.min(15, Math.max(8, Number(input.durationSeconds || 10)));
  let status: ContentStatus = CONTENT_STATUSES.includes(input.status as ContentStatus)
    ? input.status as ContentStatus
    : 'draft';
  if (!isMaster && ['approved', 'rejected', 'expired'].includes(status)) status = 'pending_review';

  const payload = {
    company_id: companyId,
    created_by: user.id,
    content_source_id: null,
    content_origin: 'manual',
    title,
    summary: optionalText(input.summary, 500),
    body: optionalText(input.body, 2000),
    category: optionalText(input.category, 80),
    image_url: optionalHttpUrl(input.imageUrl),
    source_name: optionalText(input.sourceName, 120) || 'Mídia por Mídia',
    original_url: optionalHttpUrl(input.originalUrl),
    published_at: input.publishedAt || null,
    region: optionalText(input.region, 80),
    city: optionalText(input.city, 80),
    segment: optionalText(input.segment, 80),
    duration_seconds: duration,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    status,
    is_active: !['rejected', 'expired', 'archived'].includes(status),
    expires_at: input.expiresAt || null,
  };

  let result;
  if (input.id) {
    const { data: existing } = await (supabase.from('informative_content_items') as any)
      .select('company_id, content_origin')
      .eq('id', input.id)
      .single();
    if (!existing || existing.content_origin !== 'manual') return { success: false, error: 'Conteúdo manual não encontrado.' };
    if (!isMaster && existing.company_id !== companyId) return { success: false, error: 'Acesso negado.' };
    result = await (supabase.from('informative_content_items') as any)
      .update({ ...payload, created_by: undefined })
      .eq('id', input.id)
      .select('*')
      .single();
  } else {
    result = await (supabase.from('informative_content_items') as any)
      .insert(payload)
      .select('*')
      .single();
  }

  if (result.error) return { success: false, error: result.error.message };
  revalidatePath('/admin/informative-content');
  return { success: true, item: result.data, error: null };
}

export async function updateInformativeContentStatusAction(contentId: string, status: ContentStatus) {
  const { supabase, user, isMaster } = await getActor();
  if (!user) return { success: false, error: 'Usuário não autenticado.' };
  if (!CONTENT_STATUSES.includes(status)) return { success: false, error: 'Status inválido.' };

  const { data: item } = await (supabase.from('informative_content_items') as any)
    .select('company_id, content_origin')
    .eq('id', contentId)
    .single();
  if (!item) return { success: false, error: 'Conteúdo não encontrado.' };

  if (!isMaster) {
    if (!item.company_id || !(await canAdminCompany(supabase, user.id, item.company_id)) || item.content_origin !== 'manual') {
      return { success: false, error: 'Acesso negado.' };
    }
    if (['approved', 'rejected', 'expired'].includes(status)) {
      return { success: false, error: 'Aprovação e rejeição são exclusivas do Master Admin.' };
    }
  }

  const { error } = await (supabase.from('informative_content_items') as any)
    .update({ status, is_active: !['rejected', 'expired', 'archived', 'paused'].includes(status) })
    .eq('id', contentId);
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/informative-content');
  return { success: true, error: null };
}

export async function getContentSourcesAction() {
  const { supabase, user, isMaster } = await getActor();
  if (!user || !isMaster) return { success: false, sources: [], error: 'Acesso restrito ao Master Admin.' };
  const { data, error } = await (supabase.from('content_sources') as any)
    .select('*')
    .order('source_name');
  return error
    ? { success: false, sources: [], error: error.message }
    : { success: true, sources: data || [], error: null };
}

export async function saveContentSourceAction(input: ContentSourceInput) {
  const { supabase, user, isMaster } = await getActor();
  if (!user || !isMaster) return { success: false, error: 'Acesso restrito ao Master Admin.' };
  const sourceName = sanitizeRssText(input.sourceName, 120);
  if (sourceName.length < 2) return { success: false, error: 'Nome da fonte inválido.' };
  const sourceUrl = optionalHttpUrl(input.sourceUrl);
  if (!sourceUrl) return { success: false, error: 'URL RSS inválida.' };

  const payload = {
    created_by: user.id,
    source_name: sourceName,
    source_url: sourceUrl,
    source_type: 'rss',
    category: optionalText(input.category, 80),
    region: optionalText(input.region, 80),
    city: optionalText(input.city, 80),
    refresh_interval_minutes: Math.min(1440, Math.max(15, Number(input.refreshIntervalMinutes || 60))),
    expiry_hours: Math.min(168, Math.max(12, Number(input.expiryHours || 48))),
    requires_manual_approval: input.requiresManualApproval !== false,
    is_active: input.isActive !== false,
  };

  const result = input.id
    ? await (supabase.from('content_sources') as any).update({ ...payload, created_by: undefined }).eq('id', input.id).select('*').single()
    : await (supabase.from('content_sources') as any).insert(payload).select('*').single();
  if (result.error) return { success: false, error: result.error.message };
  revalidatePath('/admin/content-sources');
  return { success: true, source: result.data, error: null };
}

export async function toggleContentSourceAction(sourceId: string, isActive: boolean) {
  const { supabase, user, isMaster } = await getActor();
  if (!user || !isMaster) return { success: false, error: 'Acesso restrito ao Master Admin.' };
  const { error } = await (supabase.from('content_sources') as any).update({ is_active: isActive }).eq('id', sourceId);
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/content-sources');
  return { success: true, error: null };
}

export async function testContentSourceAction(sourceUrl: string) {
  const { user, isMaster } = await getActor();
  if (!user || !isMaster) return { success: false, items: [], error: 'Acesso restrito ao Master Admin.' };
  try {
    const items = await fetchRssSource(sourceUrl);
    return { success: true, items: items.slice(0, 3), count: items.length, error: null };
  } catch (error) {
    return { success: false, items: [], error: error instanceof Error ? error.message : 'Falha ao testar fonte RSS.' };
  }
}

export async function importContentSourceAction(sourceId: string) {
  const { user, isMaster } = await getActor();
  if (!user || !isMaster) return { success: false, imported: 0, skipped: 0, error: 'Acesso restrito ao Master Admin.' };
  try {
    const result = await importRssSource(sourceId);
    revalidatePath('/admin/content-sources');
    revalidatePath('/admin/informative-content');
    return result;
  } catch (error) {
    return { success: false, imported: 0, skipped: 0, error: error instanceof Error ? error.message : 'Falha ao importar RSS.' };
  }
}

export async function importAllActiveContentSourcesAction() {
  const { user, isMaster } = await getActor();
  if (!user || !isMaster) return { success: false, results: [], error: 'Acesso restrito ao Master Admin.' };
  try {
    const results = await importActiveRssSources();
    revalidatePath('/admin/content-sources');
    revalidatePath('/admin/informative-content');
    return { success: true, results, error: null };
  } catch (error) {
    return { success: false, results: [], error: error instanceof Error ? error.message : 'Falha ao importar fontes RSS.' };
  }
}

export async function getScreenContentSettingsAction(screenId: string) {
  const { supabase, user, isMaster } = await getActor();
  if (!user) return { success: false, error: 'Usuário não autenticado.', screen: null, settings: null };
  const { data: screen } = await (supabase.from('screens') as any)
    .select('id, company_id, name, companies(trade_name)')
    .eq('id', screenId)
    .single();
  if (!screen) return { success: false, error: 'Tela não encontrada.', screen: null, settings: null };
  if (!isMaster) {
    const { data: membership } = await (supabase.from('company_users') as any)
      .select('role')
      .eq('company_id', screen.company_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!membership) return { success: false, error: 'Acesso negado.', screen: null, settings: null };
  }
  const { data: settings } = await (supabase.from('screen_content_settings') as any)
    .select('*')
    .eq('screen_id', screenId)
    .maybeSingle();
  return { success: true, screen, settings: settings || null, error: null };
}

export async function saveScreenContentSettingsAction(input: ScreenContentSettingsInput) {
  const { supabase, user, isMaster } = await getActor();
  if (!user) return { success: false, error: 'Usuário não autenticado.' };
  const { data: screen } = await (supabase.from('screens') as any)
    .select('id, company_id')
    .eq('id', input.screenId)
    .single();
  if (!screen) return { success: false, error: 'Tela não encontrada.' };
  if (!isMaster && !(await canAdminCompany(supabase, user.id, screen.company_id))) {
    return { success: false, error: 'Apenas Admin da empresa ou Master pode alterar esta configuração.' };
  }
  if (![3, 4, 5].includes(input.adsBetweenContent)) return { success: false, error: 'Frequência inválida.' };

  const categories = [...new Set((input.allowedCategories || [])
    .map((category) => sanitizeRssText(category, 80))
    .filter(Boolean))];
  const { data, error } = await (supabase.from('screen_content_settings') as any)
    .upsert({
      company_id: screen.company_id,
      screen_id: screen.id,
      enable_breathing_content: input.enableBreathingContent,
      enable_manual_content: input.enableManualContent,
      enable_rss_content: input.enableRssContent,
      ads_between_content: input.adsBetweenContent,
      content_duration_seconds: Math.min(15, Math.max(8, Number(input.contentDurationSeconds || 10))),
      allowed_categories: categories.length ? categories : null,
      fallback_to_ads: input.fallbackToAds,
      is_active: true,
    }, { onConflict: 'screen_id' })
    .select('*')
    .single();
  if (error) return { success: false, error: error.message };
  revalidatePath(`/screens/${screen.id}/content-settings`);
  return { success: true, settings: data, error: null };
}
