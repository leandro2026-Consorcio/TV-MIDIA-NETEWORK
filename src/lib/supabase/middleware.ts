import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Definição de Rotas Públicas (Livre Acesso)
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/empresa/cadastro') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/recuperar-senha') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/redefinir-senha') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/verify-coupon') ||
    pathname.startsWith('/invite/') ||
    pathname.startsWith('/player') ||
    pathname.startsWith('/tv') ||
    pathname.startsWith('/organic-tv') ||
    pathname.startsWith('/organic/register') ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/api/');

  // Rotas públicas precisam funcionar mesmo quando o provedor de autenticação
  // estiver lento ou temporariamente indisponível. Antes, /login era marcada
  // como pública, mas ainda aguardava auth.getUser(), causando o timeout 504 da
  // Vercel antes que o formulário pudesse ser exibido.
  if (isPublicRoute) {
    const response = NextResponse.next();
    const referral = request.nextUrl.searchParams.get('ref')?.trim();
    if (referral && /^[A-Za-z0-9_-]{3,64}$/.test(referral)) {
      response.cookies.set('mpm_ref', referral.toUpperCase(), {
        httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', maxAge: 60 * 60 * 24 * 90, path: '/',
      });
    }
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'auth_config');
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O middleware valida somente a sessão. Consultas de perfil, empresa e trial
  // são feitas no portal, onde não estão sujeitas ao limite curto do Edge.
  // A segurança dos dados permanece garantida pelas políticas RLS do Supabase.
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
