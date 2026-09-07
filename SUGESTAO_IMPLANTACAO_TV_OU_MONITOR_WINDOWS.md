# Sugestão de implantação — TV ou Monitor Windows

## Objetivo

Ao cadastrar uma nova tela no portal, permitir que o usuário escolha o tipo de dispositivo:

- **TV**: reprodução por navegador em uma Smart TV, Android TV, TV Box ou dispositivo semelhante;
- **Monitor Windows**: reprodução em um computador conectado a um monitor, usando um aplicativo/inicializador Windows.

Os dois tipos devem utilizar a mesma programação, playlist, campanhas, pareamento, heartbeat e registro de exibição. A diferença é a forma de inicialização e manutenção do dispositivo.

## Regra de créditos

Como o Monitor Windows pode alcançar menos pessoas do que uma TV dedicada, a cobrança de exibição deve ser proporcional:

- 1 visualização em TV = valor normal de 1 exibição;
- 10 visualizações em Monitor Windows = valor de 1 visualização equivalente de TV;
- cada exibição de Monitor Windows consome 10% do valor que a mesma exibição consumiria em uma TV;
- a regra deve ser aplicada depois do cálculo normal por duração da mídia;
- a transação deve registrar `device_type` e `device_multiplier = 0.1` para auditoria;
- valores fracionados devem ser aceitos no saldo e no histórico de débitos.

Exemplo: se uma mídia de 10 segundos consome 1 crédito na TV, ela consome 0,1 crédito no Monitor Windows. Se uma mídia de 30 segundos consome 3 créditos na TV, ela consome 0,3 crédito no Monitor Windows.

## Regra principal de nomenclatura

Não chamar todos os dispositivos de “TV”. O cadastro deve usar o termo genérico **Tela** internamente, mas mostrar claramente ao usuário:

- `Tipo de dispositivo: TV`
- `Tipo de dispositivo: Monitor Windows`

Exemplos de nomes:

- TV Recepção Principal;
- TV Sala de Espera;
- Monitor Windows Recepção;
- Monitor Windows Loja Centro.

## Fluxo de cadastro

Na tela de cadastro de `/screens/new`, adicionar o campo obrigatório:

```text
Tipo de dispositivo
( ) TV
( ) Monitor Windows
```

### TV

Ao escolher TV, manter o fluxo atual:

1. Cadastrar nome, orientação, resolução e localização.
2. Salvar a tela.
3. Abrir `/tv` em um navegador ou Smart TV.
4. Informar o código de pareamento mostrado na tela.
5. Vincular playlist e campanhas.

O usuário pode usar:

- Smart TV com navegador;
- Android TV;
- TV Box;
- mini computador conectado à TV;
- navegador comum em outro dispositivo.

### Monitor Windows

Ao escolher Monitor Windows, manter o mesmo cadastro de tela, mas oferecer a opção de baixar o aplicativo Windows:

1. Cadastrar nome, orientação, resolução e localização.
2. Salvar a tela.
3. Exibir botão `Baixar aplicativo Monitor Windows`.
4. O usuário instala o aplicativo no computador conectado ao monitor.
5. O aplicativo abre o player e solicita o código de pareamento.
6. O usuário informa o código exibido no portal.
7. O aplicativo registra o computador e inicia a programação.

## Modelo de dados

Adicionar uma coluna na tabela `public.screens`:

```sql
device_type text not null default 'tv'
  check (device_type in ('tv', 'windows_monitor'))
```

Também considerar os campos abaixo, preferencialmente em uma migration nova:

```sql
windows_app_version text null,
windows_last_seen_at timestamptz null,
windows_hostname text null,
windows_os_version text null,
windows_auto_start boolean not null default true,
windows_kiosk_mode boolean not null default true,
windows_prevent_sleep boolean not null default true,
windows_idle_start_seconds integer null,
windows_last_error text null
```

Regras:

- `device_type = 'tv'` mantém o comportamento atual;
- `device_type = 'windows_monitor'` habilita controles específicos do aplicativo Windows;
- não alterar nem reutilizar o campo `name` para identificar o tipo;
- preservar compatibilidade com registros existentes, tratando telas antigas como `tv`.

Atualizar também os tipos TypeScript e o arquivo de tipos gerados do banco.

## Funcionamento compartilhado

TV e Monitor Windows devem usar a mesma camada de programação:

- playlists ativas;
- campanhas programadas;
- mídia aprovada;
- conteúdo informativo;
- relatórios de reprodução;
- heartbeat;
- atualização automática da programação;
- desativação e revogação do pareamento.

O tipo do dispositivo não deve criar uma segunda lógica de programação.

## Aplicativo Monitor Windows

O site não pode instalar sozinho componentes no Windows. Para o tipo `windows_monitor`, criar um instalador autorizado pelo usuário.

O aplicativo deverá:

- abrir `https://midiapormidia.com.br/tv` ou um player Windows dedicado;
- iniciar com o Windows;
- funcionar em modo quiosque/tela cheia;
- salvar o vínculo da tela de forma segura;
- reiniciar o player se ele fechar ou travar;
- enviar versão, hostname, status e último contato ao portal;
- detectar perda e retorno de conexão;
- impedir suspensão do computador quando autorizado;
- manter o monitor ativo pelo maior tempo possível;
- permitir saída administrativa protegida;
- atualizar o aplicativo com segurança.

## Inicialização automática

Na primeira instalação, solicitar confirmação para configurar:

- iniciar com o Windows;
- iniciar mesmo depois de reinicialização;
- modo quiosque;
- impedir suspensão;
- não desligar o monitor;
- reiniciar automaticamente em caso de falha.

A implementação inicial recomendada é usar o Agendador de Tarefas do Windows, com reinício automático do player. Em uma versão posterior, pode ser criado um serviço Windows ou watchdog nativo.

## Inatividade configurável

O Monitor Windows poderá ter uma configuração no portal:

```text
Iniciar programação após inatividade:
[ Desativado | 1 min | 5 min | 10 min | 30 min ]
```

Essa configuração significa que o aplicativo pode iniciar ou retornar ao modo de programação após o computador ficar sem teclado e mouse pelo período escolhido.

Importante:

- um site comum só detecta atividade dentro da página;
- o aplicativo Windows é necessário para detectar a inatividade global do computador;
- o modo de inatividade não deve fechar trabalhos do usuário sem aviso, caso o computador também seja usado para outras atividades;
- para um computador dedicado, recomendar modo quiosque e início automático.

## Interface do painel

Na listagem de telas, exibir:

| Campo | Exemplo |
|---|---|
| Nome | Monitor Windows Recepção |
| Tipo | Monitor Windows |
| Status | Online / Offline / Pareamento pendente |
| Versão | 1.0.0 |
| Último contato | 02/09/2026 10:30 |
| Programação | Playlist Recepção |

Na tela de detalhes, mostrar somente as opções compatíveis com o tipo:

### Opções para TV

- gerar novo código de pareamento;
- desativar tela;
- abrir instruções de uso;
- vincular playlist;
- visualizar status e última comunicação.

### Opções para Monitor Windows

- baixar instalador;
- gerar novo código de pareamento;
- iniciar/reiniciar configuração;
- definir início automático;
- definir modo quiosque;
- definir prevenção de suspensão;
- definir tempo de inatividade;
- visualizar versão do aplicativo;
- visualizar hostname e último erro;
- desativar ou revogar o computador.

## Segurança

- Nunca pedir senha do Windows ao portal.
- Nunca guardar o token da tela em texto exposto no banco.
- O token deve continuar sendo armazenado apenas de forma protegida no dispositivo e validado pelo servidor.
- O instalador deve usar HTTPS e baixar somente arquivos de domínio confiável.
- O código de pareamento deve ter validade curta e uso único.
- A desativação da tela deve revogar imediatamente o token.
- A saída do modo quiosque deve exigir ação administrativa local.
- Não permitir que um aplicativo instalado em um computador acesse outra empresa ou outra tela.
- Registrar instalação, pareamento, atualização, falha e desativação na auditoria.

## Compatibilidade e limitações

### TV

- depende do navegador e do sistema da Smart TV;
- pode não permitir tela cheia automática sem uma ação inicial;
- não controla configurações de energia da televisão;
- pode exigir TV Box ou computador auxiliar em modelos antigos.

### Monitor Windows

- exige instalação local autorizada;
- depende de o computador permanecer ligado e conectado à energia;
- pode exigir configuração de antivírus/firewall;
- o Windows pode instalar atualizações e reiniciar, portanto o aplicativo deve voltar automaticamente;
- não funciona enquanto o computador estiver desligado ou em suspensão profunda.

## Critérios de aceite

1. O cadastro permite escolher TV ou Monitor Windows.
2. Telas antigas continuam funcionando como TV.
3. A listagem exibe o tipo de dispositivo sem confundir TV com monitor.
4. Os dois tipos recebem a mesma programação.
5. O Monitor Windows consegue iniciar após reinicialização do computador.
6. O Monitor Windows reinicia o player após falha.
7. O portal mostra versão, último contato e status do computador.
8. O usuário consegue configurar início automático, quiosque, prevenção de suspensão e inatividade.
9. A tela pode ser desativada pelo painel e deixa de reproduzir.
10. Nenhuma senha do Windows ou credencial sensível é enviada ao portal.
11. As permissões continuam isoladas por empresa.
12. O build, as migrations e os testes do player passam antes da publicação.

## Ordem recomendada de implantação

### Fase 1 — classificação

- adicionar `device_type`;
- atualizar cadastro, listagem e detalhes;
- preservar o player atual;
- atualizar textos de “TV/Tela”.

### Fase 2 — Monitor Windows básico

- criar instalador;
- iniciar com o Windows;
- abrir player em quiosque;
- parear por código;
- enviar heartbeat específico do aplicativo.

### Fase 3 — robustez operacional

- watchdog;
- reinício automático;
- prevenção de suspensão;
- atualização automática;
- diagnóstico de rede e erros.

### Fase 4 — inatividade configurável

- detectar inatividade global no aplicativo Windows;
- sincronizar a configuração com o portal;
- iniciar ou retornar à programação após o tempo definido;
- testar o comportamento quando o usuário volta ao computador.

## Decisão recomendada

Usar **TV** para equipamentos dedicados de exibição e **Monitor Windows** para computadores conectados a monitores. Ambos devem compartilhar o mesmo cadastro de programação, mas o Monitor Windows deve possuir um aplicativo local responsável por inicialização, quiosque, energia, inatividade e recuperação automática.

Para a participação de pessoas comuns com telas residenciais, consultar o [Roadmap da Rede Orgânica](./ROADMAP_REDE_ORGANICA.md). Essa modalidade usa fator de crédito `0,01` e exige estoque de brindes cadastrado pela empresa antes da distribuição da campanha.
