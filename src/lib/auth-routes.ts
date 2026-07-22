/** Custom auth paths — separate sign-in and sign-up flows. */
export const AUTH_SIGN_IN_PATH = "/sign-in";
export const AUTH_SIGN_UP_PATH = "/sign-up";
export const AUTH_SIGN_IN_VERIFY_PATH = "/sign-in/verify";
export const AUTH_SIGN_UP_VERIFY_PATH = "/sign-up/verify";
export const AUTH_SSO_CALLBACK_PATH = "/sign-in/sso-callback";
export const AUTH_CONTINUE_PATH = "/sign-in/continue";
export const AUTH_AFTER_SIGN_IN_PATH = "/dashboard";

/** Legacy combined auth URL — redirects to sign-in. */
export const AUTH_LEGACY_GET_STARTED_PATH = "/get-started";

/** Build an absolute app URL for OAuth redirects (required so Clerk returns to this app, not accounts.dev). */
export function authAbsoluteUrl(path: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return path;
  return new URL(path, base).href;
}
