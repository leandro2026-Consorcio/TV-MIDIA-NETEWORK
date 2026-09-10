import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Exclusão de Dados',
  description: 'Instruções para revogação e solicitação de exclusão de dados na Mídia por Mídia.',
  alternates: { canonical: '/exclusao-de-dados' },
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Exclusão de Dados"
      description="Veja como desconectar redes sociais e solicitar a exclusão dos dados associados à sua conta Mídia por Mídia."
      updatedAt="9 de setembro de 2026"
    >
      <LegalSection title="1. Desconectar uma rede social">
        <p>Acesse o painel MPM, abra a área de conexões sociais e use a opção de desconexão do canal. Você também pode revogar o acesso diretamente em Apps e Sites nas configurações do Facebook ou Instagram.</p>
        <p>A desconexão impede novos acessos e publicações por aquela autorização.</p>
      </LegalSection>

      <LegalSection title="2. Solicitar exclusão">
        <p>Envie a solicitação para <a className="font-semibold text-cyan-400 hover:underline" href="mailto:contatompm@msdeducacao.com.br?subject=Solicita%C3%A7%C3%A3o%20de%20exclus%C3%A3o%20de%20dados%20MPM">contatompm@msdeducacao.com.br</a> com o assunto “Solicitação de exclusão de dados MPM”.</p>
        <p>Informe o email da conta MPM e quais conexões sociais deseja excluir. Não envie senha, token, código de autenticação ou documento sensível no primeiro contato.</p>
      </LegalSection>

      <LegalSection title="3. Confirmação e processamento">
        <p>Para proteger o titular, poderemos confirmar a identidade e a autoridade sobre a conta antes de executar a solicitação. Após a validação, removeremos ou anonimizaremos os dados sociais revogáveis e confirmaremos a conclusão pelo canal de atendimento.</p>
      </LegalSection>

      <LegalSection title="4. Dados sujeitos a retenção">
        <p>Dados financeiros, fiscais, antifraude, de segurança e auditoria podem ser preservados quando houver obrigação legal ou necessidade de defesa de direitos. Esses registros permanecem restritos e não são usados para manter ativa a conexão social revogada.</p>
      </LegalSection>

      <LegalSection title="5. Prazo e contato">
        <p>A solicitação será tratada dentro do prazo aplicável previsto na legislação brasileira, considerando eventual necessidade de verificação de identidade ou retenção legal.</p>
      </LegalSection>
    </LegalPage>
  );
}
