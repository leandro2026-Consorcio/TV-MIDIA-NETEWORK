import 'server-only';

import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createAdminClient } from '@/lib/supabase/admin';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_FEED_BYTES = 2 * 1024 * 1024;
const MAX_ITEMS_PER_SOURCE = 20;
const MAX_REDIRECTS = 3;

export interface NormalizedRssItem {
  title: string;
  summary: string | null;
  originalUrl: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  dedupeKey: string;
}

function textValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return textValue(record['#text'] ?? record['__cdata'] ?? '');
  }
  return '';
}

export function sanitizeRssText(value: unknown, maxLength: number): string {
  return textValue(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const octets = address.split('.').map(Number);
    return octets[0] === 10 ||
      octets[0] === 127 ||
      octets[0] >= 224 ||
      (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 192 && octets[1] === 0 && octets[2] === 0) ||
      (octets[0] === 198 && octets[1] >= 18 && octets[1] <= 19) ||
      (octets[0] === 198 && octets[1] === 51 && octets[2] === 100) ||
      (octets[0] === 203 && octets[1] === 0 && octets[2] === 113) ||
      octets[0] === 0;
  }

  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateAddress(normalized.slice('::ffff:'.length));
  }
  return normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('2001:db8:');
}

async function assertSafeRemoteUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('URL RSS inválida.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('A fonte RSS deve usar HTTP/HTTPS e não pode conter credenciais.');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Endereço local não é permitido como fonte RSS.');
  }

  const addresses = net.isIP(hostname)
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('A fonte RSS aponta para uma rede privada ou reservada.');
  }

  return url;
}

async function readLimitedResponse(response: Response): Promise<string> {
  const announcedSize = Number(response.headers.get('content-length') || 0);
  if (announcedSize > MAX_FEED_BYTES) throw new Error('Feed RSS excede o limite de 2 MB.');
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_FEED_BYTES) {
      await reader.cancel();
      throw new Error('Feed RSS excede o limite de 2 MB.');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(body);
}

async function fetchXmlWithSafeRedirects(sourceUrl: string): Promise<string> {
  let currentUrl = sourceUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const safeUrl = await assertSafeRemoteUrl(currentUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(safeUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9',
          'User-Agent': 'MidiaPorMidia-RSS/1.0',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirecionamento RSS sem destino.');
        currentUrl = new URL(location, safeUrl).toString();
        continue;
      }
      if (!response.ok) throw new Error(`Fonte RSS respondeu HTTP ${response.status}.`);
      return await readLimitedResponse(response);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Tempo limite excedido ao buscar a fonte RSS.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error('Fonte RSS excedeu o limite de redirecionamentos.');
}

function normalizeLink(rawItem: Record<string, any>): string | null {
  const rawLink = rawItem.link;
  const candidates = Array.isArray(rawLink) ? rawLink : [rawLink];
  for (const candidate of candidates) {
    const value = typeof candidate === 'object'
      ? candidate?.['@_href'] || candidate?.['#text']
      : candidate;
    if (typeof value === 'string') {
      try {
        const parsed = new URL(value.trim());
        if (['http:', 'https:'].includes(parsed.protocol)) return parsed.toString();
      } catch {}
    }
  }
  return null;
}

function normalizeImage(rawItem: Record<string, any>): string | null {
  const candidates = [
    rawItem.enclosure?.['@_url'],
    rawItem['media:content']?.['@_url'],
    rawItem['media:thumbnail']?.['@_url'],
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    try {
      const parsed = new URL(candidate);
      if (['http:', 'https:'].includes(parsed.protocol)) return parsed.toString();
    } catch {}
  }
  return null;
}

export function normalizeRssItem(rawItem: Record<string, any>): NormalizedRssItem | null {
  const title = sanitizeRssText(rawItem.title, 180);
  if (!title) return null;

  const summary = sanitizeRssText(
    rawItem.description ?? rawItem.summary ?? rawItem.content ?? rawItem['content:encoded'],
    500
  ) || null;
  const originalUrl = normalizeLink(rawItem);
  const imageUrl = normalizeImage(rawItem);
  const rawDate = textValue(rawItem.pubDate ?? rawItem.published ?? rawItem.updated ?? rawItem['dc:date']);
  const parsedDate = rawDate ? new Date(rawDate) : null;
  const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
  const guid = sanitizeRssText(rawItem.guid ?? rawItem.id, 500);
  const dedupeSeed = originalUrl || guid || `${title}|${publishedAt || ''}`;

  return {
    title,
    summary,
    originalUrl,
    imageUrl,
    publishedAt,
    dedupeKey: crypto.createHash('sha256').update(dedupeSeed).digest('hex'),
  };
}

export async function fetchRssSource(sourceUrl: string): Promise<NormalizedRssItem[]> {
  const xml = await fetchXmlWithSafeRedirects(sourceUrl);
  if (!xml.trim() || /<!DOCTYPE/i.test(xml)) throw new Error('Feed RSS vazio ou com DOCTYPE não permitido.');
  const validation = XMLValidator.validate(xml);
  if (validation !== true) throw new Error('XML da fonte RSS é inválido.');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    processEntities: false,
    trimValues: true,
  });
  const parsed = parser.parse(xml) as Record<string, any>;
  const rawItems = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? parsed?.['rdf:RDF']?.item ?? [];
  const list = Array.isArray(rawItems) ? rawItems : [rawItems];

  return list
    .slice(0, MAX_ITEMS_PER_SOURCE)
    .map((item) => normalizeRssItem(item || {}))
    .filter((item): item is NormalizedRssItem => !!item);
}

export async function importRssSource(sourceId: string) {
  const supabase = createAdminClient();
  const { data: source, error: sourceError } = await (supabase.from('content_sources') as any)
    .select('*')
    .eq('id', sourceId)
    .single();

  if (sourceError || !source) return { success: false, imported: 0, skipped: 0, error: 'Fonte RSS não encontrada.' };
  const fetchedAt = new Date().toISOString();

  try {
    const items = await fetchRssSource(source.source_url);
    let imported = 0;
    let skipped = 0;
    const expiryMs = Number(source.expiry_hours || 48) * 60 * 60 * 1000;

    for (const item of items) {
      const publishedTime = item.publishedAt ? new Date(item.publishedAt).getTime() : Date.now();
      if (publishedTime + expiryMs <= Date.now()) {
        skipped += 1;
        continue;
      }

      const { error } = await (supabase.from('informative_content_items') as any).insert({
        company_id: null,
        created_by: source.created_by,
        content_source_id: source.id,
        content_origin: 'rss',
        title: item.title,
        summary: item.summary,
        category: source.category || null,
        image_url: item.imageUrl,
        source_name: source.source_name,
        original_url: item.originalUrl,
        rss_dedupe_key: item.dedupeKey,
        published_at: item.publishedAt,
        region: source.region || null,
        city: source.city || null,
        duration_seconds: 10,
        status: source.requires_manual_approval ? 'pending_review' : 'approved',
        is_active: true,
        expires_at: new Date(publishedTime + expiryMs).toISOString(),
        metadata: { imported_at: fetchedAt, source_type: 'rss' },
      });

      if (!error) imported += 1;
      else if (error.code === '23505') skipped += 1;
      else throw new Error(error.message);
    }

    await (supabase.from('content_sources') as any).update({
      last_fetched_at: fetchedAt,
      last_success_at: fetchedAt,
      last_error: null,
    }).eq('id', source.id);

    return { success: true, imported, skipped, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Falha desconhecida ao importar RSS.';
    await (supabase.from('content_sources') as any).update({
      last_fetched_at: fetchedAt,
      last_error: message,
    }).eq('id', source.id);
    return { success: false, imported: 0, skipped: 0, error: message };
  }
}

export async function importActiveRssSources() {
  const supabase = createAdminClient();
  const { data: sources, error } = await (supabase.from('content_sources') as any)
    .select('id, refresh_interval_minutes, last_fetched_at')
    .eq('source_type', 'rss')
    .eq('is_active', true);
  if (error) throw new Error(`Falha ao consultar fontes RSS ativas: ${error.message}`);

  const results = [];
  for (const source of sources || []) {
    const intervalMs = Number(source.refresh_interval_minutes || 60) * 60 * 1000;
    const lastFetched = source.last_fetched_at ? new Date(source.last_fetched_at).getTime() : 0;
    if (Date.now() - lastFetched >= intervalMs) {
      results.push({ sourceId: source.id, ...(await importRssSource(source.id)) });
    }
  }
  return results;
}
