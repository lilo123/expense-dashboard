import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest, requestHeaders?: Headers) {
  const incomingHeaders = requestHeaders || request.headers;
  const supabaseResponse = NextResponse.next({
    request: {
      headers: incomingHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user

  const protectedRoutes = ['/dashboard', '/budget', '/settings'];
  const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  if (!user && isProtectedRoute) {
    const url = new URL('/login', request.url);
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      const { name, value, ...options } = cookie;
      redirectResponse.cookies.set({ name, value, ...options });
    });
    return redirectResponse;
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = new URL('/dashboard', request.url);
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      const { name, value, ...options } = cookie;
      redirectResponse.cookies.set({ name, value, ...options });
    });
    return redirectResponse;
  }

  return supabaseResponse;
}
