/**
 * Constantes e validadores centrais de Autenticação MPM.
 */

export const DEFAULT_INITIAL_PASSWORD = 'midiapormidia@123';

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || String(password).length < 6) {
    return { valid: false, error: 'A senha deve ter no mínimo 6 caracteres.' };
  }
  return { valid: true };
}

export function validateResetEmail(email: string): { valid: boolean; error?: string } {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { valid: false, error: 'Informe um endereço de e-mail válido.' };
  }
  return { valid: true };
}
