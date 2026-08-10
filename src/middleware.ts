import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Comodidad, NO seguridad: redirige al login cuando no hay sesión válida.
 *
 * La barrera real es `requireAdmin()` dentro de cada server action y route
 * handler. En Guchini ya nos pasó que el middleware protegía /admin/* pero no
 * /api/admin/*, y las rutas quedaron abiertas.
 */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get('mascotitas_admin')?.value;
  const isLogin = req.nextUrl.pathname === '/admin/login';

  let valid = false;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (!valid && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (valid && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
