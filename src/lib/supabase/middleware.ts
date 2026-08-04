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
    pathname.startsWith('/invite/') ||
    pathname.startsWith('/player') ||
    pathname.startsWith('/tv') ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/api/');

  // 2. Se for rota de player (/tv ou /player) ou API pública, libera o acesso imediatamente sem verificar login
  if (
    pathname.startsWith('/tv') ||
    pathname.startsWith('/player') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/' ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // Empresas em trial operam somente o núcleo necessário. Esconder o menu não
  // basta: o mesmo conjunto é aplicado ao acesso direto por URL.
  if (user && !isPublicRoute) {
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('is_master_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.is_master_admin) {
      const { data: link, error: linkError } = await (supabase.from('company_users') as any)
        .select('company_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!link && !linkError) {
        const url = request.nextUrl.clone();
        url.pathname = '/empresa/cadastro';
        return NextResponse.redirect(url);
      }

      if (link) {
        const { data: trial, error: trialError } = await (supabase.from('company_trials') as any)
          .select('id')
          .eq('company_id', link.company_id)
          .in('status', ['active', 'expired', 'cancelled'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const allowedTrialRoutes = ['/dashboard', '/screens', '/media', '/playlists', '/campaigns', '/company/invites', '/onboarding', '/plans'];
        const isAllowedTrialRoute = allowedTrialRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
        if ((trial || trialError) && !isAllowedTrialRoute) {
          const url = request.nextUrl.clone();
          url.pathname = '/dashboard';
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // 3. Se o usuário NÃO está autenticado e tenta acessar área interna protegida, redireciona para /login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 4. Se o usuário já está logado e acessa /login ou /register, redireciona para /dashboard
  if (user && (pathname.startsWith('/login') || pathname.startsWith('/register'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
