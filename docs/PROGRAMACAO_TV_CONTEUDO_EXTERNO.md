# Programação da TV e conteúdo externo — requisito futuro

## Status

Documento de produto e arquitetura. **Não implementado nesta fase.** Nenhuma integração com YouTube, OAuth Google ou reprodução externa foi ativada.

## Conceito

O proprietário da TV poderá reservar períodos nos quais a tela não ficará disponível para a Rede MPM. Exemplo: um bar reserva quarta-feira, das 19h às 23h, para futebol. Essa janela deve ser retirada da capacidade MPM antes de qualquer reserva ou venda.

## Fontes previstas

- período reservado sem fonte;
- vídeo externo;
- vídeo do YouTube;
- playlist do YouTube;
- live do YouTube;
- conteúdo próprio;
- outras fontes futuras, desde que passem por validação técnica e jurídica.

## Modos de programação

- **ROTATIVO:** conteúdo externo participa de uma sequência definida;
- **HORÁRIO FIXO:** inicia e termina em datas e horários civis explícitos;
- **EXCLUSIVO:** ocupa integralmente a janela e retira sua capacidade da Rede MPM;
- **COM INTERVALOS MPM:** libera somente intervalos calculados e comprovadamente disponíveis ao scheduler MPM.

## YouTube

O painel poderá futuramente oferecer **Colar link** ou **Conectar YouTube**. A conexão autenticada deverá usar OAuth no painel MPM. A plataforma nunca deve pedir, receber ou armazenar senha Google.

O Player deve receber apenas a programação e a autorização mínima necessária. Tokens devem permanecer protegidos no backend, criptografados em repouso, com escopos mínimos, revogação e auditoria. O desenho deve considerar expiração, indisponibilidade da API, vídeos privados/removidos, restrições de incorporação e recuperação automática.

## Scheduler e capacidade

- períodos EXCLUSIVOS não contam como capacidade disponível MPM;
- períodos COM INTERVALOS contabilizam somente a capacidade efetivamente liberada;
- timezone deve ser o timezone canônico da TV/empresa e datas civis não devem ser convertidas de forma destrutiva para UTC;
- sobreposição de reservas deve ser rejeitada ou resolvida por prioridade explícita;
- ao terminar o conteúdo externo, o Player retorna automaticamente ao scheduler MPM;
- falha da fonte externa deve usar fallback operacional definido, sem transformar tempo não exibido em entrega comercial.

## Economia e comprovação

Conteúdo externo:

- não cria Crédito MPM;
- não cria Direito de Mídia;
- não cria Comprovante de Exibição comercial;
- não conta como campanha entregue;
- não alimenta faturamento, payout ou split;
- deve ter telemetria operacional separada de Proof of Play comercial.

## Permissões futuras

Configurar programação externa será uma permissão administrativa separada. O perfil MARKETING não deve receber automaticamente autoridade para comprometer capacidade, contratar serviços ou autorizar impacto financeiro. Deve existir futuramente a permissão explícita `PERMISSÃO DE CONTRATAÇÃO / FINANCEIRO`.

## Direitos e responsabilidade

A MPM fornece uma ferramenta técnica de programação. Conectar uma conta ou colar um link não concede direitos de exibição pública de conteúdo protegido. O contratante continua responsável por licenças, direitos autorais, termos da fonte e regras do local de exibição.

## Fora do escopo atual

- OAuth Google/YouTube;
- armazenamento de tokens do YouTube;
- player de YouTube;
- criação de tabelas de programação externa;
- alteração do scheduler ou da capacidade;
- qualquer evento financeiro relacionado a conteúdo externo.
