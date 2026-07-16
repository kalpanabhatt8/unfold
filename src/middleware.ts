import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Only the landing page and auth screens are public. The dashboard, all data
// sync routes, and all AI routes require a signed-in user — every DB row is
// scoped to the Clerk userId.
const isPublicRoute = createRouteMatcher([
  '/',
  '/homepage2',
  '/homepage3',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/terms(.*)',
  '/privacy(.*)',
  '/dev(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
