import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Política de Privacidade da plataforma Mídia por Mídia.',
  alternates: { canonical: '/politica-de-privacidade' },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      description="Esta política explica como a Mídia por Mídia trata dados pessoais e dados de contas sociais conectadas à plataforma."
      updatedAt="9 de setembro de 2026"
    >
      <LegalSection title="1. Responsável e abrangência">
        <p>A Mídia por Mídia, produto operado pela MSD Digital, trata os dados necessários para oferecer cadastro, gestão de mídia indoor, campanhas e integrações sociais autorizadas pelos usuários.</p>
      </LegalSection>

      <LegalSection title="2. Dados tratados">
        <p>Podemos tratar dados de cadastro e contato, perfil e empresa, informações operacionais de telas e campanhas, registros de segurança e suporte e dados necessários ao cumprimento de obrigações legais.</p>
        <p>Quando uma rede social é conectada, tratamos somente os dados autorizados no consentimento: nome, username, avatar, identificadores técnicos de conta ou Página, permissões concedidas, tokens de autorização, publicações solicitadas pelo usuário e métricas quando habilitadas.</p>
      </LegalSection>

      <LegalSection title="3. Finalidades">
        <p>Usamos os dados para autenticar usuários, operar o painel, identificar canais autorizados, publicar ou programar conteúdo solicitado, apresentar diagnósticos e métricas, prevenir fraude, prestar suporte e cumprir obrigações legais.</p>
        <p>A Mídia por Mídia não publica em uma conta social sem uma ação ou configuração expressamente autorizada pelo titular.</p>
      </LegalSection>

      <LegalSection title="4. Armazenamento e segurança">
        <p>Aplicamos controles de acesso, segregação por titular, comunicação HTTPS e criptografia de tokens de autorização em repouso. Segredos e tokens não são exibidos publicamente.</p>
      </LegalSection>

      <LegalSection title="5. Compartilhamento">
        <p>Os dados podem ser processados por provedores de infraestrutura, banco de dados, autenticação e pelas plataformas sociais conectadas, apenas na medida necessária à operação. Também poderemos compartilhá-los quando exigido por lei ou autoridade competente.</p>
      </LegalSection>

      <LegalSection title="6. Retenção">
        <p>Dados sociais e credenciais de integração são mantidos enquanto a conexão estiver ativa ou pelo período necessário para operar e proteger o serviço. Após desconexão ou solicitação válida, dados sociais revogáveis são eliminados ou anonimizados conforme aplicável.</p>
        <p>Registros financeiros, antifraude, de auditoria ou outros sujeitos a obrigação legal podem ser conservados pelo prazo exigido, com acesso restrito.</p>
      </LegalSection>

      <LegalSection title="7. Controle das conexões sociais">
        <p>O usuário pode desconectar um canal no painel MPM e também revogar o acesso nas configurações de Apps e Sites do Facebook ou Instagram. A revogação interrompe novos acessos, mas não substitui uma solicitação de exclusão dos dados já armazenados.</p>
      </LegalSection>

      <LegalSection title="8. Direitos e exclusão">
        <p>O titular pode solicitar informação, correção ou exclusão dos dados aplicáveis. Consulte os <Link className="font-semibold text-cyan-400 hover:underline" href="/exclusao-de-dados">passos para exclusão de dados</Link>.</p>
      </LegalSection>

      <LegalSection title="9. Atualizações">
        <p>Esta política poderá ser atualizada para refletir mudanças legais ou operacionais. A data da versão vigente permanecerá indicada nesta página.</p>
      </LegalSection>
    </LegalPage>
  );
}
