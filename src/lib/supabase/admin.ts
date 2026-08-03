import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

/**
 * Cliente privilegiado exclusivo do servidor.
 *
 * Use somente depois que a própria Server Action validar os dados recebidos.
 * A service role ignora o RLS e nunca pode ser exposta em componentes cliente.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuração administrativa do Supabase ausente.');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
