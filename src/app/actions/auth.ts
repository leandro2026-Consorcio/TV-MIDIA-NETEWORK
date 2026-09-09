'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_INITIAL_PASSWORD,
  validatePassword,
  validateResetEmail,
} from '@/lib/auth-constants';


/**
 * Solicita o envio de e-mail com link de recuperação de senha via Supabase Auth.
 */
export async function requestPasswordResetAction(email: string, origin?: string) {
  const emailCheck = validateResetEmail(email);
  if (!emailCheck.valid) {
    return {
      success: false as const,
      error: emailCheck.error || 'Informe um endereço de e-mail válido.',
    };
  }
  const cleanEmail = email.trim().toLowerCase();

  const baseUrl =
    origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://midiapormidia.com.br';

  const redirectTo = `${baseUrl.replace(/\/$/, '')}/auth/callback?next=/reset-password`;

  try {
    const supabase = createClient();
    const { error: clientError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });

    if (clientError) {
      // Fallback para cliente administrativo no servidor
      try {
        const admin = createAdminClient();
        const { error: adminError } = await admin.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo,
        });

        if (adminError) {
          console.warn('[AUTH_RESET_WARN] Erro admin ao enviar e-mail de recuperação:', adminError);
          return {
            success: false as const,
            error: adminError.message || 'Não foi possível enviar o e-mail de recuperação.',
          };
        }
      } catch (adminErr: any) {
        console.error('[AUTH_RESET_ERR] Falha ao invocar resetPasswordForEmail:', adminErr);
        return {
          success: false as const,
          error: clientError.message || 'Erro ao processar solicitação de recuperação de senha.',
        };
      }
    }

    return {
      success: true as const,
      message: `Enviamos as instruções para ${cleanEmail}. Verifique sua caixa de entrada e a pasta de spam.`,
    };
  } catch (err: any) {
    console.error('[AUTH_RESET_FATAL]', err);
    return {
      success: false as const,
      error: err.message || 'Ocorreu um erro ao solicitar a recuperação de senha.',
    };
  }
}

/**
 * Atualiza a senha do usuário conectado ou em sessão de recuperação.
 */
export async function updateUserPasswordAction(newPassword: string) {
  const password = String(newPassword || '');

  if (password.length < 6) {
    return {
      success: false as const,
      error: 'A nova senha deve ter no mínimo 6 caracteres.',
    };
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password,
      data: {
        must_change_password: false,
        initial_password: false,
        password_updated_at: new Date().toISOString(),
      },
    });

    if (error) {
      return {
        success: false as const,
        error: error.message || 'Não foi possível atualizar a senha.',
      };
    }

    return {
      success: true as const,
      message: 'Senha alterada com sucesso!',
    };
  } catch (err: any) {
    return {
      success: false as const,
      error: err.message || 'Erro inesperado ao salvar a nova senha.',
    };
  }
}
