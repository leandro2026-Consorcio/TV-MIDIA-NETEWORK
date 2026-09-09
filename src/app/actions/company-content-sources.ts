'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchRssSource, sanitizeRssText } from '@/lib/rss';
import dns from 'node:dns/promises';
import net from 'node:net';

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const octets = address.split('.').map(Number);
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      octets[0] >= 224 ||
      (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 192 && octets[1] === 0 && octets[2] === 0) ||
      octets[0] === 0
    );
  }
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) return isPrivateAddress(normalized.slice('::ffff:'.length));
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('2001:db8:')
  );
}

async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Endereço URL inválido.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('O endereço deve utilizar HTTP ou HTTPS sem credenciais.');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Endereço local não é permitido.');
  }

  const addresses = net.isIP(hostname)
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('O endereço aponta para uma rede privada ou reservada.');
  }

  return url;
}

async function getAuthenticatedCompany() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, companyId: null, isMaster: false };

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  const isMaster = Boolean(profile?.is_master_admin);

  const { data: link } = await (supabase.from('company_users') as any)
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  return { user, companyId: link?.company_id || null, role: link?.role, isMaster };
}

export async function getCompanyContentSourcesAction() {
  const { user, companyId, isMaster } = await getAuthenticatedCompany();
  if (!user) return { success: false, error: 'Usuário não autenticado.' };
  if (!companyId && !isMaster) return { success: false, error: 'Empresa não vinculada.' };

  const admin = createAdminClient();

  try {
    // 1. Fontes Recomendadas (globais ativas)
    const { data: globalSources, error: gErr } = await (admin as any).from('content_sources')
      .select('*')
      .or('is_private.is.null,is_private.eq.false')
      .eq('is_active', true)
      .order('source_name');

    // 2. Minhas Fontes (privadas da empresa)
    let companySources: any[] = [];
    if (companyId) {
      const { data: privSources } = await (admin as any).from('content_sources')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      companySources = privSources || [];
    }

    // 3. Categorias disponíveis
    const { data: categories } = await (admin as any).from('content_categories')
      .select('id, name, slug, description')
      .eq('is_active', true)
      .order('sort_order');

    // 4. Telas da empresa com suas configurações
    let screens: any[] = [];
    if (companyId) {
      const { data: screenList } = await (admin as any).from('screens')
        .select('id, name, status, device_type, orientation, screen_content_settings(*)')
        .eq('company_id', companyId)
        .neq('status', 'inactive')
        .order('created_at');
      screens = screenList || [];
    }

    return {
      success: true as const,
      companyId,
      recommendedSources: globalSources || [],
      mySources: companySources,
      categories: categories || [],
      screens,
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Falha ao carregar fontes de conteúdo.' };
  }
}

export async function discoverCompanyRssFeedsAction(websiteUrl: string) {
  const { user } = await getAuthenticatedCompany();
  if (!user) return { success: false, feeds: [], error: 'Usuário não autenticado.' };

  try {
    let clean = websiteUrl.trim();
    if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
    const targetUrl = await assertSafeUrl(clean);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Site retornou status HTTP ${res.status}.`);
    const html = await res.text();

    const feeds: Array<{ title: string; url: string; type: string }> = [];

    // Regex para tags <link rel="alternate" type="application/rss+xml" href="...">
    const linkRegex = /<link\b[^>]*>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const tag = match[0];
      const isRelAlternate = /\brel=["'][^"']*alternate[^"']*["']/i.test(tag);
      const typeMatch = tag.match(/\btype=["']([^"']+)["']/i);
      const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
      const titleMatch = tag.match(/\btitle=["']([^"']+)["']/i);

      if (isRelAlternate && typeMatch && hrefMatch) {
        const type = typeMatch[1].toLowerCase();
        if (type.includes('rss') || type.includes('atom') || type.includes('xml')) {
          try {
            const absoluteUrl = new URL(hrefMatch[1], targetUrl).toString();
            feeds.push({
              title: titleMatch ? sanitizeRssText(titleMatch[1], 80) : 'Feed de Notícias',
              url: absoluteUrl,
              type: type.includes('atom') ? 'Atom' : 'RSS',
            });
          } catch {}
        }
      }
    }

    // Se nenhuma tag foi encontrada, tentar endpoints canônicos conhecidos
    if (feeds.length === 0) {
      const commonPaths = ['/feed', '/rss', '/rss.xml', '/index.xml'];
      for (const path of commonPaths) {
        try {
          const testUrl = new URL(path, targetUrl).toString();
          const items = await fetchRssSource(testUrl);
          if (items && items.length > 0) {
            feeds.push({
              title: `Feed (${path})`,
              url: testUrl,
              type: 'RSS',
            });
            break;
          }
        } catch {}
      }
    }

    return {
      success: true as const,
      feeds,
      siteUrl: targetUrl.toString(),
      count: feeds.length,
    };
  } catch (error: any) {
    return {
      success: false as const,
      feeds: [],
      error: error?.message || 'Não foi possível encontrar feeds neste site.',
    };
  }
}

export async function previewCompanyRssFeedAction(feedUrl: string) {
  const { user } = await getAuthenticatedCompany();
  if (!user) return { success: false, items: [], error: 'Usuário não autenticado.' };

  try {
    const safeUrl = await assertSafeUrl(feedUrl);
    const items = await fetchRssSource(safeUrl.toString());
    const topItems = (items || []).slice(0, 5).map((item) => ({
      title: item.title,
      summary: item.summary,
      imageUrl: item.imageUrl,
      publishedAt: item.publishedAt,
      originalUrl: item.originalUrl,
    }));

    return {
      success: true as const,
      items: topItems,
      totalFound: items.length,
      feedUrl: safeUrl.toString(),
      lastUpdate: topItems[0]?.publishedAt || new Date().toISOString(),
    };
  } catch (error: any) {
    return { success: false as const, items: [], error: error?.message || 'Falha ao carregar prévia da fonte.' };
  }
}

export async function addCompanyPrivateSourceAction(payload: {
  sourceName: string;
  sourceUrl: string;
  category?: string;
}) {
  const { user, companyId, isMaster } = await getAuthenticatedCompany();
  if (!user) return { success: false, error: 'Usuário não autenticado.' };
  if (!companyId && !isMaster) return { success: false, error: 'Empresa não vinculada.' };

  try {
    const cleanUrl = await assertSafeUrl(payload.sourceUrl);
    const items = await fetchRssSource(cleanUrl.toString());
    if (!items || items.length === 0) {
      return { success: false, error: 'Esta fonte não retornou notícias válidas.' };
    }

    const admin = createAdminClient();
    const sourcePayload: any = {
      created_by: user.id,
      company_id: companyId,
      source_name: sanitizeRssText(payload.sourceName, 120),
      source_url: cleanUrl.toString(),
      source_type: 'rss',
      category: payload.category ? sanitizeRssText(payload.category, 80) : null,
      refresh_interval_minutes: 60,
      expiry_hours: 48,
      requires_manual_approval: false,
      is_active: true,
      is_private: true,
      approval_status: 'approved',
      last_fetched_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
    };

    const { data: newSource, error } = await (admin as any).from('content_sources')
      .insert(sourcePayload)
      .select('*')
      .single();

    if (error) throw error;
    return { success: true as const, source: newSource };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Falha ao adicionar fonte.' };
  }
}

export async function suggestCompanySourceAction(sourceId: string) {
  const { user, companyId, isMaster } = await getAuthenticatedCompany();
  if (!user) return { success: false, error: 'Usuário não autenticado.' };

  const admin = createAdminClient();
  const query = (admin as any).from('content_sources')
    .update({ suggested_for_catalog: true, updated_at: new Date().toISOString() })
    .eq('id', sourceId);

  if (!isMaster && companyId) {
    query.eq('company_id', companyId);
  }

  const { error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true as const };
}

export async function toggleCompanySourceAction(sourceId: string, isActive: boolean) {
  const { user, companyId, isMaster } = await getAuthenticatedCompany();
  if (!user) return { success: false, error: 'Usuário não autenticado.' };

  const admin = createAdminClient();
  const query = (admin as any).from('content_sources')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', sourceId);

  if (!isMaster && companyId) {
    query.eq('company_id', companyId);
  }

  const { error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true as const };
}

export async function saveScreenContentSourcesAction(screenId: string, allowedSourceIds: string[]) {
  const { user, companyId, isMaster } = await getAuthenticatedCompany();
  if (!user) return { success: false, error: 'Usuário não autenticado.' };

  const admin = createAdminClient();

  // Validar se a tela pertence à empresa
  const { data: screen } = await (admin as any).from('screens')
    .select('id, company_id')
    .eq('id', screenId)
    .single();

  if (!screen) return { success: false, error: 'Tela não encontrada.' };
  if (!isMaster && screen.company_id !== companyId) {
    return { success: false, error: 'Acesso negado a esta tela.' };
  }

  const { error } = await (admin as any).from('screen_content_settings')
    .upsert({
      screen_id: screenId,
      company_id: screen.company_id,
      allowed_source_ids: allowedSourceIds,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'screen_id' });

  if (error) return { success: false, error: error.message };
  return { success: true as const };
}
