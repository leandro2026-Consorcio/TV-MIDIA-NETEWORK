-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2B: MÍDIAS E STORAGE (MEDIA_ASSETS)
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE MÍDIAS (MEDIA_ASSETS)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  orientation TEXT NOT NULL DEFAULT 'horizontal' CHECK (orientation IN ('horizontal', 'vertical', 'square', 'unknown')),
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  playback_duration_seconds INTEGER NOT NULL CHECK (playback_duration_seconds IN (5, 10, 15, 30)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  rejection_reason TEXT,
  is_external BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para buscas e ordenação rápida por tenant e status
CREATE INDEX IF NOT EXISTS idx_media_assets_company_id ON public.media_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON public.media_assets(status);

-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS RLS - MEDIA_ASSETS
-- 3.1 LEITURA: Master Admin ou membros ativos (Admin e Operador) da mesma empresa
DROP POLICY IF EXISTS "MediaAssets - Leitura para membros da empresa ou Master Admin" ON public.media_assets;
CREATE POLICY "MediaAssets - Leitura para membros da empresa ou Master Admin"
  ON public.media_assets FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

-- 3.2 INSERÇÃO: Admins e Operadores ativos da mesma empresa
DROP POLICY IF EXISTS "MediaAssets - Inserção por membros da empresa ou Master Admin" ON public.media_assets;
CREATE POLICY "MediaAssets - Inserção por membros da empresa ou Master Admin"
  ON public.media_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

-- 3.3 EDIÇÃO/ATUALIZAÇÃO:
-- Master Admin ou Admin da empresa podem editar tudo (inclusive aprovar/reprovar status).
-- Operadores podem editar título/descrição de mídias de sua própria empresa.
DROP POLICY IF EXISTS "MediaAssets - Edição para membros da empresa ou Master Admin" ON public.media_assets;
CREATE POLICY "MediaAssets - Edição para membros da empresa ou Master Admin"
  ON public.media_assets FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  )
  WITH CHECK (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

-- 3.4 EXCLUSÃO / ARQUIVAMENTO FÍSICO: Restrito a Master Admin ou Admin da empresa
DROP POLICY IF EXISTS "MediaAssets - Exclusão por Admins da Empresa ou Master Admin" ON public.media_assets;
CREATE POLICY "MediaAssets - Exclusão por Admins da Empresa ou Master Admin"
  ON public.media_assets FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE)
  );

-- ============================================================================
-- 4. CONFIGURAÇÃO E SEGURANÇA DO SUPABASE STORAGE BUCKET (MEDIA-ASSETS)
-- ============================================================================

-- Inserir o bucket 'media-assets' na tabela de buckets do Supabase se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-assets', 'media-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para o schema storage.objects no bucket media-assets
-- O caminho do arquivo segue a estrutura: {company_id}/{media_id}/{filename}

-- Leitura de arquivos do Storage: Autenticados da mesma empresa ou Master Admin
DROP POLICY IF EXISTS "Storage - Leitura de mídias por empresa" ON storage.objects;
CREATE POLICY "Storage - Leitura de mídias por empresa"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'media-assets' AND (
      is_master_admin() OR 
      (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_company_ids())
    )
  );

-- Leitura pública para exibição de imagens/vídeos nos players e previews do dashboard
DROP POLICY IF EXISTS "Storage - Leitura pública para renderização de mídias" ON storage.objects;
CREATE POLICY "Storage - Leitura pública para renderização de mídias"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'media-assets');

-- Upload de arquivos: Restrito a usuários autenticados da empresa pertencente ao caminho
DROP POLICY IF EXISTS "Storage - Upload por membros da empresa" ON storage.objects;
CREATE POLICY "Storage - Upload por membros da empresa"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media-assets' AND (
      is_master_admin() OR 
      (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_company_ids())
    )
  );

-- Remoção/Exclusão no Storage: Restrito a Admins da Empresa ou Master Admin
DROP POLICY IF EXISTS "Storage - Remoção por Admins da Empresa ou Master Admin" ON storage.objects;
CREATE POLICY "Storage - Remoção por Admins da Empresa ou Master Admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media-assets' AND (
      is_master_admin() OR 
      (storage.foldername(name))[1]::uuid IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE)
    )
  );
