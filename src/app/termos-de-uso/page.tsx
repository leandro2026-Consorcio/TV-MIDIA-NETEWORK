import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos de Uso da plataforma Mídia por Mídia.',
  alternates: { canonical: '/termos-de-uso' },
};

export default function TermsOfUsePage() {
  return (
    <LegalPage
      title="Termos de Uso"
      description="Estes termos regulam o acesso e o uso da plataforma Mídia por Mídia e de suas integrações autorizadas."
      updatedAt="11 de setembro de 2026"
    >
      <LegalSection title="1. Aceitação e serviço">
        <p>Ao criar uma conta ou utilizar a Mídia por Mídia, o usuário declara que leu e aceita estes termos. A plataforma oferece recursos de mídia indoor, gestão de campanhas e conexão opcional com canais sociais.</p>
      </LegalSection>

      <LegalSection title="2. Conta e segurança">
        <p>O usuário é responsável pela veracidade das informações fornecidas, pela proteção de suas credenciais e pelas atividades realizadas em sua conta. Suspeitas de acesso indevido devem ser comunicadas imediatamente.</p>
      </LegalSection>

      <LegalSection title="3. Integrações sociais">
        <p>A conexão com TikTok, Facebook ou Instagram depende de autorização expressa do titular no ambiente oficial de cada plataforma. O usuário pode desconectar um canal no painel e revogar a autorização diretamente na plataforma social.</p>
        <p>A Mídia por Mídia somente acessa dados e executa ações compatíveis com as permissões concedidas, a disponibilidade das APIs e as regras da plataforma conectada.</p>
      </LegalSection>

      <LegalSection title="4. Conteúdo e uso permitido">
        <p>O usuário permanece responsável pelo conteúdo que envia, agenda ou publica e declara possuir os direitos necessários para utilizá-lo. É proibido usar o serviço para fraude, abuso, violação de direitos, conteúdo ilícito ou tentativa de contornar controles de segurança e revisão das plataformas.</p>
      </LegalSection>

      <LegalSection title="5. Disponibilidade e alterações">
        <p>Recursos podem variar conforme plano, aprovação de plataformas externas, manutenção ou mudanças nas APIs. Poderemos atualizar o serviço e estes termos para refletir alterações legais, técnicas ou operacionais.</p>
      </LegalSection>

      <LegalSection title="6. Suspensão e encerramento">
        <p>O acesso poderá ser suspenso ou encerrado em caso de violação destes termos, risco à segurança, exigência legal ou uso que prejudique a plataforma, seus usuários ou terceiros.</p>
      </LegalSection>

      <LegalSection title="7. Privacidade e contato">
        <p>O tratamento de dados é descrito na <Link className="font-semibold text-cyan-400 hover:underline" href="/politica-de-privacidade">Política de Privacidade</Link>. Dúvidas sobre estes termos podem ser enviadas para contatompm@msdeducacao.com.br.</p>
      </LegalSection>
    </LegalPage>
  );
}
