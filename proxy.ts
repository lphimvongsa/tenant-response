import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// NOTE: Next.js 16 deprecated the `middleware.ts` file convention and renamed
// it to `proxy.ts` (the exported function is renamed `middleware` -> `proxy`).
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// This file is intentionally named `proxy.ts`, not `middleware.ts`.
//
// Standard @supabase/ssr proxy/middleware pattern: build a response, wire a
// server client's cookies to both the incoming request and outgoing response
// so the session cookie gets refreshed on every request, then gate /dashboard
// behind an authenticated session.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not add logic between createServerClient and getUser() — this call
  // refreshes the session token and must run on every request for the
  // cookie-refresh behavior above to work correctly.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
