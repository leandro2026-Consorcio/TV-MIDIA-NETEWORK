# Roadmap — Rede Orgânica de Telas

## Visão do produto

A Rede Orgânica permite que pessoas comuns disponibilizem uma TV ou um computador com monitor para exibir propagandas locais quando o equipamento não estiver sendo usado.

Em troca das exibições técnicas validadas, a pessoa acumula microcréditos que podem ser trocados por produtos e serviços oferecidos por empresas parceiras.

A pessoa participa como dona de uma tela, não como empresa. Ela não acessa campanhas empresariais, não vende mídia e não visualiza dados comerciais de outros participantes.

Mensagem sugerida:

> Quando você não estiver usando sua TV ou computador, sua tela pode ajudar empresas da sua cidade. Você acumula microcréditos e troca por benefícios na rede.

## Regra de participação residencial

Como a plataforma não consegue confirmar quantas pessoas estão diante de uma TV residencial, a tela orgânica deve utilizar fator reduzido:

| Tipo de tela | Fator de crédito |
|---|---:|
| TV comercial | 1,00 |
| Monitor Windows em ambiente comercial | 0,10 |
| TV ou Monitor Windows residencial | 0,01 |

Uma exibição residencial equivale a 1% do valor de uma exibição de TV comercial. Portanto, 100 exibições residenciais equivalem a 1 exibição comercial para fins de crédito.

O fator deve ser aplicado depois do cálculo normal de duração da mídia. Cada lançamento em carteira deve registrar o tipo da tela e o multiplicador utilizado.

## Regra de lastro por brindes

Uma empresa só poderá distribuir sua campanha para a Rede Orgânica se cadastrar previamente uma quantidade real de benefícios na plataforma.

Exemplos de benefícios:

- açaí;
- chopp;
- porção;
- aula experimental;
- mensalidade de academia;
- café, almoço, desconto ou serviço local.

Cada benefício deve possuir:

- nome e descrição;
- empresa responsável;
- quantidade total;
- quantidade disponível;
- quantidade reservada;
- quantidade resgatada;
- validade;
- cidades ou regiões permitidas;
- créditos necessários para resgate;
- regras de utilização;
- código ou QR Code de validação.

Sem estoque de benefícios ou créditos promocionais suficientes, a campanha não pode ser distribuída para telas orgânicas.

## Unidade de controle da campanha

Uma campanha orgânica deve ser limitada simultaneamente por:

1. quantidade máxima de inserções;
2. créditos promocionais disponíveis;
3. quantidade de brindes cadastrados;
4. período de validade;
5. segmentos e regiões autorizados.

A campanha termina ou deixa de ser elegível quando qualquer limite crítico for atingido.

## Fluxo da empresa anunciante

1. Criar ou selecionar uma campanha aprovada.
2. Escolher se deseja participar da Rede Orgânica.
3. Informar quantidade de inserções e regiões.
4. Cadastrar brindes ou benefícios.
5. Definir quantos créditos são necessários para cada resgate.
6. Reservar o estoque para a campanha.
7. Publicar a campanha para aprovação operacional.
8. Acompanhar inserções, créditos distribuídos e estoque de benefícios.
9. Validar resgates por código ou QR Code.
10. Encerrar a campanha e prestar contas dos benefícios utilizados.

## Fluxo da pessoa participante

1. Criar uma conta orgânica gratuita.
2. Cadastrar uma TV ou Monitor Windows.
3. Aceitar os termos de participação e escolher horários.
4. Parear a tela pelo código exibido no player.
5. Definir categorias que não deseja exibir.
6. Deixar a tela ligada e conectada.
7. Receber microcréditos por exibições técnicas validadas.
8. Escolher uma recompensa disponível.
9. Reservar o benefício e receber um QR Code ou código único.
10. Apresentar o código ao estabelecimento parceiro.

## Carteira de microcréditos

A carteira deve separar claramente:

- créditos pendentes;
- créditos liberados;
- créditos reservados para resgate;
- créditos expirados;
- créditos cancelados;
- créditos utilizados.

Recomenda-se um período de retenção antes da liberação, para permitir análise de fraude e inconsistências do dispositivo.

Exemplo de cálculo:

```text
valor_base_da_exibicao = cálculo normal por duração
fator_residencial = 0,01
microcrédito = valor_base_da_exibicao × fator_residencial
```

Se uma mídia de 10 segundos vale 1 crédito em uma TV comercial, a mesma exibição vale 0,01 crédito em uma tela residencial.

## Fases de implantação

### Fase 1 — Fundamento e classificação

- criar o tipo de conta `organic_user`;
- criar `device_type` para distinguir TV e Monitor Windows;
- criar a categoria `organic_screen`;
- separar permissões de empresa e pessoa física;
- definir termos de uso, privacidade e política de conteúdo;
- manter todas as telas atuais funcionando sem alteração.

### Fase 2 — Tela orgânica e pareamento

- permitir cadastro de uma tela residencial;
- permitir TV ou Monitor Windows;
- criar limites de telas por conta;
- configurar horários de participação;
- configurar categorias bloqueadas;
- manter pareamento e heartbeat;
- exibir status online/offline;
- impedir que a pessoa acesse o painel empresarial.

### Fase 3 — Medição e microcréditos

- registrar exibições técnicas validadas;
- aplicar fator residencial `0,01`;
- criar carteira de microcréditos;
- manter créditos pendentes antes da liberação;
- criar limites diário e mensal;
- registrar fator, tela, campanha, mídia e horário em cada lançamento;
- criar relatório de auditoria.

### Fase 4 — Brindes com lastro obrigatório

- criar cadastro de recompensas;
- obrigar a empresa a informar o estoque antes da campanha orgânica;
- controlar disponível, reservado, resgatado e expirado;
- bloquear campanha sem brindes válidos;
- limitar a distribuição ao estoque e aos créditos promocionais;
- impedir estoque negativo com operação transacional.

### Fase 5 — Resgate local

- permitir que o participante escolha uma recompensa;
- reservar créditos e um benefício simultaneamente;
- gerar código único ou QR Code;
- criar tela de validação para o estabelecimento;
- registrar resgate, data, usuário validador e estabelecimento;
- tratar cancelamento, expiração e reembolso de créditos.

### Fase 6 — Antifraude e escala

- limitar telas por residência/conta;
- detectar tokens duplicados;
- detectar múltiplas contas no mesmo dispositivo;
- verificar heartbeat e continuidade da reprodução;
- bloquear aba em segundo plano quando possível;
- identificar padrões anormais de exibição;
- reter créditos suspeitos;
- criar fila de revisão;
- iniciar piloto com quantidade limitada de telas e recompensas.

## Estrutura de dados sugerida

Criar migrations novas, sem editar migrations já aplicadas.

### `organic_users`

- `id`;
- `auth_user_id`;
- `display_name`;
- `city`;
- `status`;
- `created_at`;
- `updated_at`.

### `organic_screens`

- `id`;
- `organic_user_id`;
- `screen_id`;
- `participation_enabled`;
- `daily_credit_limit`;
- `idle_start_seconds`;
- `allowed_schedule`;
- `blocked_categories`;
- `risk_status`;
- timestamps.

### `organic_credit_ledger`

- `id`;
- `organic_user_id`;
- `screen_id`;
- `campaign_id`;
- `playback_log_id`;
- `base_credits`;
- `device_multiplier`;
- `credits_amount`;
- `status`;
- `created_at`.

### `campaign_rewards`

- `id`;
- `campaign_id`;
- `company_id`;
- `title`;
- `description`;
- `credits_required`;
- `quantity_total`;
- `quantity_available`;
- `quantity_reserved`;
- `quantity_redeemed`;
- `expires_at`;
- `status`;
- `terms`;
- timestamps.

### `reward_redemptions`

- `id`;
- `reward_id`;
- `organic_user_id`;
- `credits_reserved`;
- `redemption_code_hash`;
- `status`;
- `reserved_at`;
- `redeemed_at`;
- `expires_at`;
- `validated_by`;
- timestamps.

## Regras de segurança e justiça

- Não apresentar microcrédito como dinheiro ou renda garantida.
- Usar termos como “benefício”, “recompensa” e “crédito promocional”.
- Não divulgar endereço residencial ou dados pessoais ao anunciante.
- Não permitir que crianças sejam cadastradas sem regras e consentimento adequados.
- Permitir pausar ou sair da rede a qualquer momento.
- Mostrar claramente quais categorias serão exibidas.
- Exigir aprovação e estoque real antes de divulgar benefícios.
- Usar transações atômicas no débito e no resgate.
- Nunca liberar mais recompensas do que o estoque disponível.

## Critérios para o piloto

- uma única cidade ou região;
- no máximo 20–50 telas orgânicas;
- no máximo 5 empresas anunciantes;
- recompensas simples e de baixo valor;
- sem saque em dinheiro;
- validação manual dos primeiros resgates;
- limite diário por tela;
- acompanhamento de fraude, suporte e satisfação;
- revisão dos fatores antes de ampliar a rede.

## Decisão de produto

A Rede Orgânica deve ser uma camada separada da operação empresarial, mas utilizar o mesmo motor de programação e Proof of Play. O fator residencial de `0,01` e o estoque obrigatório de brindes protegem a sustentabilidade do modelo: a empresa só distribui benefícios que realmente colocou na plataforma, e a pessoa participa sem receber acesso aos dados ou controles de uma empresa.
