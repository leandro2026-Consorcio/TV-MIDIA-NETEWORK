# Walkthrough — Correção da Etapa 4, Inventário, Conteúdo de Respiro, Convites VIP e Tour Contínuo

Concluímos a implementação, testes e deploy de todas as correções e melhorias de UX para a experiência de onboarding da empresa (`homolog.empresa@msdeducacao.com.br`), abrangendo a Etapa 4, configuração de TVs, inventário em linguagem amigável, conteúdo entre propagandas (respiro), convites VIP e campanhas.

---

## 1. Causa Raiz e Correções Realizadas

### 1.1 Conteúdo de Respiro — Constraint `screen_content_settings_ads_between_content_check`
- **Causa Raiz**: A constraint original no banco permitia apenas um subconjunto de valores inteiros para `ads_between_content`. O formulário enviava valores entre 1 e 5 (ex: "A cada 2 anúncios"), disparando a violação da constraint.
- **Correção**:
  1. Criada migration incremental `supabase/migrations/20260909000320_fix_content_settings_and_network_prefs.sql` atualizando a constraint para `CHECK (ads_between_content BETWEEN 1 AND 5)`.
  2. Implementada defesa retrocompatível em `src/app/actions/informative-content.ts` com tratamento resiliente contra constraints antigas.
  3. Adicionadas prévias visuais da sequência de exibição (ex: `Propaganda → Notícia → Propaganda...`) e dicas por segmento em `src/app/(dashboard)/screens/[id]/content-settings/page.tsx`.
  4. Botão de avanço direto após salvar: `[ CONTINUAR CONFIGURAÇÃO (CONVITES VIP) ]`.

### 1.2 Participação na Rede — Canonicalização da Coluna
- **Causa Raiz**: Queries no frontend e server actions tentavam ler `participates_in_network` em `company_network_preferences`, gerando o erro de coluna inexistente `column company_network_preferences_1.participates_in_network does not exist`.
- **Decisão Arquitetural**: Conforme instrução do usuário, **não** criamos coluna duplicada. A coluna canônica existente no schema é `accepts_network_ads`.
- **Correção**:
  - `src/app/actions/network.ts`: Atualizada a consulta pública para filtrar `eq('accepts_network_ads', true)`.
  - `src/app/(dashboard)/network-settings/page.tsx`: Unificado todo o formulário sob `accepts_network_ads`.
  - `src/app/actions/onboarding.ts`: Provisionamento do trial persistido sob `accepts_network_ads`.

### 1.3 Inventário e Divisão da Programação em Linguagem Simples
- **Causa Raiz**: A tela exibia terminologia técnica como "Capacidade teórica 12h x 30d", bolsões internos (`own_use`, `pool`, `growth`), e o botão perigoso "Desativar Tela" com destaque excessivo.
- **Correção**:
  - Renomeada a tela para `"Como esta TV participa da Rede MPM"` (`src/app/(dashboard)/screens/[id]/inventory/page.tsx`).
  - Quando os dados de loop forem insuficientes, é exibido: **`Capacidade ainda não calculada`** com aviso claro.
  - Bolsões renomeados para o português do empresário: *"Minha empresa"*, *"Empresas escolhidas"*, *"Parcerias da Rede"*, *"Crescimento da Rede"*, *"Rede automática"*.
  - Checkbox simplificado: *"Compartilhar espaço não utilizado"*.
  - Toggle de Participação na Rede MPM com aviso explícito: *"Disponibilizar capacidade não gera Crédito MPM automaticamente"*.
  - Configurações avançadas agora ficam recolhidas por padrão em um dropdown retrátil.
  - "Desativar Tela" foi movido para uma Danger Zone discreta no final da página da TV (`screens/[id]/page.tsx`).

### 1.4 Fontes de Conteúdo para a Empresa (`/company/content-sources`)
- **Causa Raiz**: O checklist apontava para `/admin/content-sources`, inacessível para empresas comuns.
- **Correção**:
  - Criada suíte Server Actions em `src/app/actions/company-content-sources.ts` com proteção SSRF contra IPs privados e localhost.
  - Criada a página corporativa `src/app/(dashboard)/company/content-sources/page.tsx` com 3 abas:
    1. **Fontes Recomendadas**: Catálogo geral MPM verificado, com botão de prévia das últimas 5 notícias.
    2. **Minhas Fontes**: Auto-descoberta de RSS digitando a URL de um site/portal, modo avançado para URL manual, prévia de notícias e botão *"Sugerir ao Catálogo Geral MPM"*.
    3. **Preferências por TV**: Seleção individual de TV com marcação rápida de fontes permitidas e link direto de ajuste.

### 1.5 Convites VIP e Fluxo Não Bloqueante
- **Causa Raiz**: Texto anterior continha "60 dias gratuitos" fixos e faltava recompensa clara.
- **Correção**:
  - Garantidos no mínimo 3 convites VIP sempre disponíveis (`ensureCompanyVipInvites`).
  - Card de Recompensa: *"Sua recompensa: Ganhe 1 mensalidade quando uma empresa indicada se tornar um cliente elegível."*
  - O benefício da empresa indicada é dinâmico (não fixa "60 dias").
  - Caixa de texto com modelo pronto e link VIP dinâmico.
  - Botões de ação: `[ COPIAR MENSAGEM ]`, `[ COPIAR LINK ]`, `[ ENVIAR PELO WHATSAPP ]` e `[ Fazer depois ]` (não bloqueante).
  - Feedback ao compartilhar: `✅ Convite pronto. Você ainda possui X convites disponíveis.` com CTA para avançar.

### 1.6 Campanhas da Minha Empresa & Marketplace
- **Correção**:
  - Em `/campaigns`, cabeçalho alterado de "Campanhas Internas" para **"Minhas Campanhas"**.
  - No editor (`src/components/internal-campaign-editor.tsx`), a seção "TVs participantes" foi renomeada para **"Minhas TVs participantes"** (*"Escolha em quais TVs da sua empresa esta campanha será exibida"*).
  - Adicionado card promocional: *"Quer anunciar em outras TVs?"* com botão `[ ENCONTRAR TVs NO MARKETPLACE ]` apontando para `/marketplace`.

### 1.7 Barra de Progresso Persistente do Onboarding
- **Correção**:
  - Criado o componente `src/components/onboarding-progress-bar.tsx`.
  - Integrado no layout do painel (`src/app/(dashboard)/layout.tsx`), exibindo o progresso das 6 etapas principais no topo, com botão *"Fazer agora"* e opção de fechar/ocultar.
  - Rotas `/company/content-sources`, `/network-settings` e `/playback-logs` adicionadas às rotas autorizadas do período de trial, evitando redirecionamentos indevidos.

---

## 2. Verificação e Testes

### 2.1 Testes Automatizados
- Executados via `npm test` cobrindo 94 testes unitários e de integração com **100% de aprovação**:
  - `tests/screen-content-and-network-prefs.test.ts` (11 testes cobrindo constraints, SSRF, canonicalização, VIP, etc.).
  - `tests/inventory-capacity.test.ts` (10 testes).
  - `tests/windows-player-installer.test.ts` (5 testes).
  - `tests/migration-contracts.test.ts` (11 testes).
  - `tests/organic-benefits-rewards.test.ts` (9 testes).
  - `tests/expansion-economics.test.ts` (5 testes).
  - `tests/social-marketplace-stage2.test.ts` (5 testes).

### 2.2 Verificação de Tipos e Build
- `npx tsc --noEmit`: 0 erros encontrados.
- `npm run build`: Compilação de produção do Next.js gerou todas as 80 rotas estáticas e dinâmicas com sucesso.

### 2.3 Git e Deploy
- Commit: `e70e75f`
- Push realizado com sucesso para o branch `main` no repositório remoto: `https://github.com/leandro2026-Consorcio/TV-MIDIA-NETEWORK.git`.
