import { NextResponse } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

import { AUTH_SIGN_IN_PATH } from '@/lib/auth-routes'

// Only the landing page and auth screens are public. The dashboard, all data
// sync routes, and all AI routes require a signed-in user — every DB row is
// scoped to the Clerk userId.
const isPublicRoute = createRouteMatcher([
  '/',
  '/get-started(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/terms(.*)',
  '/privacy(.*)',
  '/dev(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  const { userId } = await auth()
  if (userId) return

  // Always send unauthenticated users to our app /get-started — never Clerk's
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
