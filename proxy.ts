import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getFisioDeEmail, esDuena, esRutaSoloDuena } from '@/lib/utils'

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
      url.pathname = user.app_metadata?.must_change_password ? '/app/cambiar-clave' : '/app'
      return NextResponse.redirect(url)
    }

    if (user?.app_metadata?.must_change_password && !path.startsWith('/app/cambiar-clave')) {
      const url = request.nextUrl.clone()
      url.pathname = '/app/cambiar-clave'
      return NextResponse.redirect(url)
    }
  } else {
    if (user?.app_metadata?.role === 'patient') {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      return NextResponse.redirect(url)
    }
    // === ADMIN DASHBOARD ROUTING ===
    // Solo la dueña entra a las rutas de dinero, promociones y planes.
    // La lista vive en lib/utils junto al menú, para que no se desincronicen:
    // así fue como /promociones acabó oculto en el menú pero accesible por URL.
    const esEmpleada = !!user && !esDuena(getFisioDeEmail(user.email))
    const isProtectedAdminRoute = esRutaSoloDuena(path)

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
     * - manifest files
     * - static image formats (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest(?:-agendar)?\\.json|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
