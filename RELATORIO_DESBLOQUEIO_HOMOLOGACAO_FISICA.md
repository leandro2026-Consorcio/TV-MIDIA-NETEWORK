# MPM — DESBLOQUEIO DA HOMOLOGAÇÃO FÍSICA

Data: 2026-09-13 (America/Cuiaba)
Branch: `main`
Status: **BLOQUEIO LOCAL REMOVIDO / AMBIENTE REMOTO AINDA BLOQUEADO**

## AMBIENTE

- Vercel project: `tv-midia-netework` (`prj_uk0…FvTr`)
- Production backend: Supabase project ref `ubvt…fciw`
- Preview backend: Supabase project ref `ubvt…fciw`
- mesmo Supabase/Postgres: **SIM**
- homologação isolada disponível: **NÃO**

Evidência objetiva: as mesmas 16 definições secretas de Supabase/Postgres estão
configuradas na Vercel com escopo simultâneo `Preview, Production`. A Vercel não
permite baixar seus valores secretos e devolve apenas `[SENSITIVE]`, mas o próprio
escopo único confirma que Preview e Production recebem a mesma configuração. Nenhum
secret foi incluído neste relatório e nenhuma conexão ao banco foi aberta.

Menor solução segura: criar um projeto/branch Supabase exclusivo de homologação e
substituir, somente no scope Preview, as 16 variáveis hoje compartilhadas. Depois,
configurar `MPM_ENV=homologation` e `MPM_HOMOLOGATION_PROJECT_REF` com o novo ref.

## PLAYER

- player_version: `0.1.0`, compilado no bundle cliente
- player_build: `MPM_PLAYER_BUILD`, `VERCEL_DEPLOYMENT_ID` ou commit do build
- player_commit: `VERCEL_GIT_COMMIT_SHA` compilado no bundle
- platform: informado pelo navegador/OS cliente
- app/runtime version: `web-next-14.2.23`
- metadata vem do cliente: **SIM**
- compatibilidade com Player antigo: **SIM**

O Player agora gera um `heartbeat_id`, envia seu `player_session_id` e a identidade
compilada no próprio bundle. O servidor não usa mais sua própria versão como suposta
prova do cliente. A migration persiste a última identidade na TV mesmo com rollout de
capacidade desligado. Um Player legado continua enviando heartbeat, mas deixa os
campos de identidade como desconhecidos para não preservar evidência antiga enganosa.

## HEARTBEAT

- sessão: UUID novo a cada abertura do Player
- intervalo: 30 s; continuidade aceita somente intervalo positivo de até 75 s
- disconnect: ausência superior a 75 s soma zero
- reconnect: primeiro heartbeat reinicia a continuidade e soma zero
- online_seconds: soma o intervalo real somente na mesma sessão
- agenda: os dois heartbeats precisam estar dentro da agenda elegível
- tempo offline contabilizado indevidamente: **0 nos cenários testados**
- idempotência: `heartbeat_id` repetido soma zero

A chamada legada de um argumento foi preservada. Durante uma janela de deploy em que
a migration nova ainda não esteja aplicada, a action também faz fallback explícito
para a RPC anterior.

## AUTENTICAÇÃO

- 3 testes antigos: atualizados para a regra atual
- senha padrão continua removida: **SIM**
- regressões: **0**

Além dos três asserts antigos, foi removido o fallback server-side que ainda criava
contas públicas com uma senha universal. Cadastro empresarial e orgânico agora exigem
senha pessoal. Login, recuperação, redefinição e banner legado não exibem a credencial
antiga. O setup interno de homologação exige segredo de ambiente com no mínimo 12
caracteres e não devolve esse segredo na resposta.

## LINT

- configuração: `.eslintrc.json` com `next/core-web-vitals`
- comando: `next lint --no-cache`
- resultado: **PASS, 0 erros**
- legado: permanecem avisos não bloqueantes de hooks e uso de `<img>`

Os 10 erros legados `react/no-unescaped-entities` encontrados ao ativar o lint foram
corrigidos mecanicamente em cinco telas, sem reformatação ampla.

## TESTES

- motor: **44/44 PASS**
- heartbeat: **9/9 PASS**
- autenticação: **9/9 PASS**
- suíte total: **344/344 PASS**
- FAIL: **0**
- TypeScript: **PASS** (`npx tsc --noEmit`)
- build: **PASS** (95 páginas estáticas)
- lint: **PASS** (0 erros; avisos legados não bloqueantes)
- diff: **PASS** (`git diff --check`)

## ALTERAÇÕES

- identidade de build/runtime compilada no Player em `next.config.mjs`;
- payload cliente e cálculo testável em `src/lib/mpm/player-heartbeat.ts`;
- heartbeat imediato e periódico em `src/app/player/page.tsx`;
- ingest seguro, opcional e compatível em `src/app/actions/pairing.ts`;
- migration/rollback `20260913000393_player_heartbeat_identity_and_continuity`;
- tipos de `screens` atualizados;
- testes de heartbeat/reconexão/idempotência adicionados;
- testes e fluxos de autenticação atualizados sem senha universal;
- ESLint configurado para execução não interativa;
- cinco correções mecânicas de texto JSX exigidas pelo lint.

- migrations aplicadas remotamente: **NÃO**
- deploy: **NÃO EXECUTADO**
- commit: **NÃO CRIADO**
- flags/rollout: **NÃO ALTERADOS**
- TV física: **NÃO ACESSADA**

# VEREDITO

- backend Preview isolado: **NÃO**
- build físico pode ser identificado pelo heartbeat: **SIM**, após deploy da versão
- reconexão não cria tempo online artificial: **SIM**
- nova sessão não herda intervalo antigo: **SIM**
- testes antigos corrigidos sem reintroduzir senha padrão: **SIM**
- suíte completa limpa: **SIM**
- pronto para retomar teste físico: **NÃO**

Bloqueios restantes:

1. Preview e Production ainda usam o mesmo Supabase/Postgres.
2. A migration 393 e o novo build do Player precisam ser aplicados/deployados somente
   depois que o backend isolado de homologação existir.
