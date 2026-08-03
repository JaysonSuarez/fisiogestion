import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getFisioDeEmail, esDuena } from '@/lib/utils'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
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
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (path.startsWith('/app')) {
    // === PATIENT APP ROUTING ===
    const isPatientLoginOrRegistro = path.startsWith('/app/login') || path.startsWith('/app/registro')

    // Redirect to patient login if not authenticated and trying to access a protected patient route
    if (!user && !isPatientLoginOrRegistro) {
      const url = request.nextUrl.clone()
      url.pathname = '/app/login'
      return NextResponse.redirect(url)
    }

    // Redirect to patient app home if authenticated and trying to access patient login/registration
    if (user && isPatientLoginOrRegistro) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      return NextResponse.redirect(url)
    }
  } else {
    // === ADMIN DASHBOARD ROUTING ===
    // Solo la dueña entra a las rutas de dinero; cualquier otra fisioterapeuta no.
    const esEmpleada = !!user && !esDuena(getFisioDeEmail(user.email))
    const protectedAdminRoutes = ['/finanzas', '/diezmo', '/ajustes']
    const isProtectedAdminRoute = protectedAdminRoutes.some(route => path.startsWith(route))

    // Redirect to admin login if not authenticated and trying to access a protected admin route
    // Note: /agendar is matched by the route path, so we exclude it explicitly
    const isPublicAdminRoute = path.startsWith('/login') || path.startsWith('/agendar')

    if (!user && !isPublicAdminRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Redirect to admin dashboard home if authenticated and trying to access admin login
    if (user && path.startsWith('/login')) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // Redirect to admin dashboard home if an employee tries to access protected admin routes
    if (user && esEmpleada && isProtectedAdminRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sw.js (service worker)
     * - manifest.json (manifest file)
     * - static image formats (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
