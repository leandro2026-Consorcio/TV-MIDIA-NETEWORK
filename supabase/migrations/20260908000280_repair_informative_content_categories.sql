-- Repair incremental: structures required by the informative content UI.
-- Idempotent and data-preserving; does not replace or edit older migrations.

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

CREATE INDEX IF NOT EXISTS idx_content_categories_slug
  ON public.content_categories(slug);
CREATE INDEX IF NOT EXISTS idx_content_categories_active
  ON public.content_categories(is_active);

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

ALTER TABLE public.content_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ContentCategories - Leitura para autenticados"
  ON public.content_categories;
CREATE POLICY "ContentCategories - Leitura para autenticados"
  ON public.content_categories FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "ContentCategories - Gerenciamento exclusivo do Master Admin"
  ON public.content_categories;
CREATE POLICY "ContentCategories - Gerenciamento exclusivo do Master Admin"
  ON public.content_categories FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

ALTER TABLE public.screen_content_settings
  ADD COLUMN IF NOT EXISTS content_mix_mode TEXT NOT NULL DEFAULT 'ads_first',
  ADD COLUMN IF NOT EXISTS mix_interval INT NOT NULL DEFAULT 4;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_screen_content_mix_mode'
      AND conrelid = 'public.screen_content_settings'::regclass
  ) THEN
    ALTER TABLE public.screen_content_settings
      ADD CONSTRAINT chk_screen_content_mix_mode
      CHECK (content_mix_mode IN ('ads_first', 'content_first'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_screen_content_mix_interval'
      AND conrelid = 'public.screen_content_settings'::regclass
  ) THEN
    ALTER TABLE public.screen_content_settings
      ADD CONSTRAINT chk_screen_content_mix_interval
      CHECK (mix_interval BETWEEN 1 AND 5);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_content_categories_updated_at
  ON public.content_categories;
CREATE TRIGGER trg_content_categories_updated_at
  BEFORE UPDATE ON public.content_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

NOTIFY pgrst, 'reload schema';
