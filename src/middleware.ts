import { NextResponse } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

import { AUTH_SIGN_IN_PATH } from '@/lib/auth-routes'

// Only the landing page and auth screens are public. The dashboard, all data
// sync routes, and all AI routes require a signed-in user - every DB row is
// scoped to the Clerk userId.
const isPublicRoute = createRouteMatcher([
  '/',
  '/get-started(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/terms(.*)',
  '/terms-and-conditions(.*)',
  '/privacy(.*)',
  // /dev/* requires auth + internal-debug allowlist (see app/dev/layout.tsx)
])

const isApiRoute = createRouteMatcher(['/api(.*)', '/trpc(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Expose the request pathname to Server Components so client shells
  // (e.g. Sidebar) can SSR the correct branch and avoid hydration mismatches.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-unfold-pathname', req.nextUrl.pathname)
  const next = () =>
    NextResponse.next({
      request: { headers: requestHeaders },
    })

  if (isPublicRoute(req)) return next()

  const { userId } = await auth()
  if (userId) return next()

  // Fetch clients must get JSON 401s - never an HTML sign-in redirect.
  // Following a redirect makes response.ok true and response.json() throw
  // `Unexpected token '<'` on `<!DOCTYPE html>`.
  if (isApiRoute(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Always send unauthenticated users to our app sign-in - never Clerk's
  // Account Portal (*.accounts.dev), which is the fallback when
  // NEXT_PUBLIC_CLERK_SIGN_IN_URL is missing at runtime (e.g. on Vercel).
  const signIn = new URL(AUTH_SIGN_IN_PATH, req.url)
  signIn.searchParams.set('redirect_url', req.url)
  return NextResponse.redirect(signIn)
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
