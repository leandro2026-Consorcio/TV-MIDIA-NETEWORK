import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createClient();

    // 1. Validar autenticação do usuário e permissão de Master Admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Acesso não autenticado.' }, { status: 401 });
    }

    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_master_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_master_admin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito ao Master Admin.' }, { status: 403 });
    }

    // 2. Conferência Sanitizada de Variáveis de Ambiente (SEM EXPOR SEGREDO OU TOKENS)
    const asaasApiKeyConfigured = !!process.env.ASAAS_API_KEY;
    const asaasBaseUrl = process.env.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api/v3';
    const isProductionAsaas = asaasBaseUrl.includes('www.asaas.com');
    const isSandboxAsaas = asaasBaseUrl.includes('sandbox.asaas.com');

    const asaasWebhookTokenConfigured = !!process.env.ASAAS_WEBHOOK_TOKEN;
    const supabaseUrlConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKeyConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKeyConfigured = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Disjuntor de Emergência
    const financialTransfersEnabled = process.env.FINANCIAL_TRANSFERS_ENABLED !== 'false';

    // 3. Teste de Conexão com o Supabase e Verificação das Tabelas Principais
    const tablesCheck: Record<string, boolean> = {};

    const tablesToTest = [
      'profiles',
      'companies',
      'seller_financial_profiles',
      'seller_financial_ledger',
      'seller_payout_eligibility',
      'seller_payout_batches',
      'seller_payout_transfers',
    ];

    for (const tableName of tablesToTest) {
      const { error } = await supabase.from(tableName as any).select('id').limit(1);
      tablesCheck[tableName] = !error;
    }

    const allTablesOk = Object.values(tablesCheck).every((status) => status === true);

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        environment: {
          mode: isProductionAsaas ? 'PRODUCTION' : isSandboxAsaas ? 'SANDBOX' : 'CUSTOM',
          asaasBaseUrl,
          financialTransfersEnabled,
        },
        credentialsStatus: {
          asaasApiKey: asaasApiKeyConfigured ? 'CONFIGURED_SERVER_SIDE' : 'MISSING',
          asaasWebhookToken: asaasWebhookTokenConfigured ? 'CONFIGURED_SERVER_SIDE' : 'MISSING',
          supabaseUrl: supabaseUrlConfigured ? 'CONFIGURED' : 'MISSING',
          supabaseAnonKey: supabaseAnonKeyConfigured ? 'CONFIGURED' : 'MISSING',
          supabaseServiceRoleKey: supabaseServiceKeyConfigured ? 'CONFIGURED_SERVER_SIDE' : 'MISSING',
        },
        databaseStatus: {
          connected: allTablesOk,
          tables: tablesCheck,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno durante a execução do healthcheck contábil.',
        message: err.message,
      },
      { status: 500 }
    );
  }
}
