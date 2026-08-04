-- Migration: Fase 6D — Melhores de UX, Categorias de Conteúdo, Revezamento e Diretório de Rede

-- 1. TABELA DE CATEGORIAS DE CONTEÚDO (content_categories)
CREATE TABLE IF NOT EXISTS public.content_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_categories_slug ON public.content_categories(slug);
CREATE INDEX IF NOT EXISTS idx_content_categories_active ON public.content_categories(is_active);

-- Seed de categorias iniciais
INSERT INTO public.content_categories (name, slug, description, sort_order)
VALUES
  ('Saúde', 'saude', 'Dicas de saúde, bem-estar e vida saudável', 1),
  ('Educação', 'educacao', 'Notícias sobre educação, cursos e aprendizado', 2),
  ('Agronegócio', 'agronegocio', 'Mercado agrícola, cotações e tecnologia no campo', 3),
  ('Economia', 'economia', 'Notícias econômicas, mercado e finanças', 4),
  ('Notícias locais', 'noticias-locais', 'Informações e destaques da região', 5),
  ('Frases do dia', 'frases-do-dia', 'Pensamentos positivos e frases motivacionais', 6),
  ('Eventos', 'eventos', 'Agenda cultural e eventos locais', 7),
  ('Segurança', 'seguranca', 'Orientações de prevenção e segurança comunitária', 8),
  ('Meio ambiente', 'meio-ambiente', 'Sustentabilidade, clima e ecologia', 9),
  ('Esportes', 'esportes', 'Destaques e resultados esportivos', 10)
ON CONFLICT (slug) DO NOTHING;

-- RLS para content_categories
ALTER TABLE public.content_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ContentCategories - Leitura para autenticados" ON public.content_categories;
CREATE POLICY "ContentCategories - Leitura para autenticados"
  ON public.content_categories FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "ContentCategories - Gerenciamento exclusivo do Master Admin" ON public.content_categories;
CREATE POLICY "ContentCategories - Gerenciamento exclusivo do Master Admin"
  ON public.content_categories FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

-- 2. ALTERAÇÕES EM screen_content_settings (Modos de Revezamento)
ALTER TABLE public.screen_content_settings
  ADD COLUMN IF NOT EXISTS content_mix_mode TEXT NOT NULL DEFAULT 'ads_first',
  ADD COLUMN IF NOT EXISTS mix_interval INT NOT NULL DEFAULT 4;

-- Constraints para mix_mode e mix_interval se ainda não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_screen_content_mix_mode'
  ) THEN
    ALTER TABLE public.screen_content_settings
      ADD CONSTRAINT chk_screen_content_mix_mode CHECK (content_mix_mode IN ('ads_first', 'content_first'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_screen_content_mix_interval'
  ) THEN
    ALTER TABLE public.screen_content_settings
      ADD CONSTRAINT chk_screen_content_mix_interval CHECK (mix_interval BETWEEN 1 AND 5);
  END IF;
END $$;

-- 3. ALTERAÇÕES EM company_network_preferences (Visibilidade e Participação na Rede)
ALTER TABLE public.company_network_preferences
  ADD COLUMN IF NOT EXISTS participates_in_network BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_company_name BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_city BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_segment BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS public_description TEXT;

-- Atualizar RLS para company_network_preferences permitir leitura de empresas participantes por todos autenticados
DROP POLICY IF EXISTS "CompanyNetworkPreferences - Leitura por membros ou Master Admin" ON public.company_network_preferences;
DROP POLICY IF EXISTS "CompanyNetworkPreferences - Leitura publica de participantes na rede" ON public.company_network_preferences;

CREATE POLICY "CompanyNetworkPreferences - Leitura publica de participantes na rede"
  ON public.company_network_preferences FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR company_id IN (SELECT public.get_user_company_ids())
    OR participates_in_network = TRUE
  );

-- Atualizar trigger/função de atualização da tabela
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_categories_updated_at ON public.content_categories;
CREATE TRIGGER trg_content_categories_updated_at
  BEFORE UPDATE ON public.content_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
