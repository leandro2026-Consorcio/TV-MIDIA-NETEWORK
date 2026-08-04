'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ContentCategoryInput {
  id?: string;
  name: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

function generateSlug(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

export async function getContentCategoriesAction(onlyActive = false) {
  try {
    const supabase = createClient();
    let query = (supabase.from('content_categories') as any)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (onlyActive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { success: true as const, categories: data || [] };
  } catch (err: any) {
    return { success: false as const, categories: [], error: err.message || 'Falha ao buscar categorias.' };
  }
}

export async function saveContentCategoryAction(input: ContentCategoryInput) {
  const { user, isMaster } = await getActor();
  if (!user || !isMaster) {
    return { success: false as const, error: 'Acesso restrito ao Master Admin.' };
  }

  const name = String(input.name || '').trim();
  if (name.length < 2) {
    return { success: false as const, error: 'Nome da categoria deve ter pelo menos 2 caracteres.' };
  }

  const slug = input.slug?.trim() ? generateSlug(input.slug) : generateSlug(name);
  if (!slug) {
    return { success: false as const, error: 'Slug inválido.' };
  }

  const admin = createAdminClient();
  const payload = {
    name,
    slug,
    description: input.description?.trim() || null,
    sort_order: Number(input.sortOrder || 0),
    is_active: input.isActive !== false,
  };

  let result;
  if (input.id) {
    result = await (admin.from('content_categories') as any)
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single();
  } else {
    result = await (admin.from('content_categories') as any)
      .insert(payload)
      .select('*')
      .single();
  }

  if (result.error) {
    if (result.error.code === '23505') {
      return { success: false as const, error: 'Já existe uma categoria com este slug/nome.' };
    }
    return { success: false as const, error: result.error.message };
  }

  revalidatePath('/admin/content-categories');
  revalidatePath('/admin/informative-content');
  return { success: true as const, category: result.data };
}

export async function toggleContentCategoryAction(id: string, isActive: boolean) {
  const { user, isMaster } = await getActor();
  if (!user || !isMaster) {
    return { success: false as const, error: 'Acesso restrito ao Master Admin.' };
  }

  const admin = createAdminClient();
  const { error } = await (admin.from('content_categories') as any)
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) return { success: false as const, error: error.message };

  revalidatePath('/admin/content-categories');
  revalidatePath('/admin/informative-content');
  return { success: true as const };
}
