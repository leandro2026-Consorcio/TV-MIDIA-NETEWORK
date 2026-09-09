-- ============================================================================
-- MIGRACAO INCREMENTAL: CONSISTENCIA DO CALCULO DE PONTOS DA REDE ORGANICA
-- Data: 2026-09-09
-- Padronizacao: R$ 79,90 -> 80 pontos -> 1.600 Exibicoes Validadas sem bonus.
-- Bonus de 95% -> 4 pontos liquidos -> 80 Exibicoes Validadas.
-- Estimativa comercial de R$ 799,00 -> 15.980 exibicoes residenciais estimadas (independente).
-- ============================================================================

INSERT INTO public.help_articles (slug, audience, title, objective, expected_result, steps, display_order)
VALUES
  (
    'como-funciona-pontuacao',
    'company',
    'Como funciona a pontuação',
    'Entender como os pontos dos participantes são calculados com consistência matemática estrita.',
    'Preço anunciado convertido em pontos inteiros (R$ 79,90 = 80 pontos = 1.600 exibições sem bônus, ou 4 pontos = 80 exibições com bônus de 95%).',
    to_jsonb(ARRAY[
      'O valor unitário anunciado é convertido em pontos inteiros pela regra de arredondamento (R$ 79,90 = 80 pontos base).',
      'Cada Exibição Validada na TV residencial gera 0,05 Ponto da Rede para o participante.',
      'Requisito sem bônus: 80 pontos ÷ 0,05 = 1.600 Exibições Validadas.',
      'Com bônus de 95% da empresa: o requisito líquido cai para 4 pontos = 80 Exibições Validadas (4 ÷ 0,05).',
      'Trava de liberação: 1.599 exibições geram 79,95 pontos e ainda não liberam; somente a 1.600ª exibição atinge 80 pontos e libera o resgate.',
      'Independência comercial: A divulgação da empresa (R$ 799 ÷ R$ 0,05 = 15.980 exibições residenciais estimadas) é uma regra comercial separada e não altera a meta do participante.'
    ]),
    51
  ),
  (
    'como-acumular-pontos-e-resgatar',
    'organic',
    'Como acumular pontos e resgatar prêmios',
    'Compreender quantas exibições são necessárias para conquistar benefícios com e sem bônus da empresa.',
    'Regra clara de 0,05 ponto por exibição validada (1.600 exibições para 80 pontos base; 80 exibições com bônus de 95%).',
    to_jsonb(ARRAY[
      'Mantenha sua TV conectada: cada propaganda validada entre 06:00 e 23:59 rende 0,05 Ponto da Rede.',
      'Para um prêmio de R$ 79,90 (80 pontos), são necessárias 1.600 Exibições Validadas sem bônus.',
      'Aproveite o bônus da empresa (ex.: 95%): seu custo cai para 4 pontos líquidos, precisando de apenas 80 Exibições Validadas.',
      'O saldo acumulado não é perdido se o prêmio esgotar; você pode resgatar outro benefício.',
      'Ao resgatar, apenas os pontos líquidos (ex.: 4 pontos) são debitados do seu saldo.'
    ]),
    65
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  audience = EXCLUDED.audience,
  objective = EXCLUDED.objective,
  expected_result = EXCLUDED.expected_result,
  steps = EXCLUDED.steps,
  display_order = EXCLUDED.display_order;

NOTIFY pgrst, 'reload schema';
