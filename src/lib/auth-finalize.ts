import { generatePlaceholderPassword } from "@/lib/auth-utils";

type SignUpResource = {
  status: string | null;
  createdSessionId: string | null;
  missingFields?: string[];
  legalAcceptedAt?: number | null;
  emailAddress?: string | null;
  update: (params: Record<string, string | boolean>) => Promise<{
    status: string | null;
    createdSessionId: string | null;
    missingFields?: string[];
  }>;
  reload?: () => Promise<SignUpResource>;
};

export function buildSignUpCompletionPayload(
  resource: Pick<
    SignUpResource,
    "missingFields" | "legalAcceptedAt" | "emailAddress"
  >,
  emailHint = "",
): Record<string, string | boolean> {
  const missing = resource.missingFields ?? [];
  const payload: Record<string, string | boolean> = {};

  if (missing.includes("legal_accepted") || !resource.legalAcceptedAt) {
    payload.legalAccepted = true;
  }

  if (missing.includes("username")) {
    const base =
      (emailHint.trim() || resource.emailAddress || "user")
        .split("@")[0]
        ?.replace(/[^a-zA-Z0-9_]/g, "")
        .slice(0, 18)
        .toLowerCase() || "user";
    payload.username = `${base}_${Math.random().toString(36).slice(2, 8)}`;
  }

  if (missing.includes("first_name")) payload.firstName = "Unfold";
  if (missing.includes("last_name")) payload.lastName = "Member";

  // Passwordless UX — satisfy Clerk when password is still marked required.
  if (missing.includes("password")) {
    payload.password = generatePlaceholderPassword();
  }

  return payload;
}

/** Finish OAuth sign-up when Clerk only needs silent field completion. */
export async function completeOAuthSignUp(
  signUp: SignUpResource,
  setActive: (args: { session: string }) => Promise<unknown>,
  options?: { emailHint?: string; dashboardPath?: string },
): Promise<"success" | "sign-in"> {
  const dashboardPath = options?.dashboardPath ?? "/dashboard";

  const activate = async (sessionId: string | null | undefined) => {
    if (!sessionId) return false;
    await setActive({ session: sessionId });
    window.location.assign(dashboardPath);
    return true;
  };

  if (signUp.status === "complete") {
    if (await activate(signUp.createdSessionId)) return "success";
    return "sign-in";
  }

  if (signUp.status !== "missing_requirements") {
    return "sign-in";
  }

  const attempt = async (target: SignUpResource): Promise<"success" | "sign-in"> => {
    const payload = buildSignUpCompletionPayload(target, options?.emailHint);
    if (Object.keys(payload).length === 0) return "sign-in";

    try {
      const updated = await target.update(payload);
      if (updated.status === "complete") {
        if (await activate(updated.createdSessionId)) return "success";
        return "sign-in";
      }

      if (
        updated.status === "missing_requirements" &&
        (updated.missingFields ?? []).includes("username")
      ) {
        const retry = await target.update({
          ...payload,
          username: `user_${Math.random().toString(36).slice(2, 10)}`,
          legalAccepted: true,
        });
        if (retry.status === "complete") {
          if (await activate(retry.createdSessionId)) return "success";
        }
      }
    } catch {
      // fall through
    }

    return "sign-in";
  };

  const first = await attempt(signUp);
  if (first === "success") return "success";

  if (signUp.reload) {
    try {
      const reloaded = await signUp.reload();
      return attempt(reloaded);
    } catch {
      // fall through
    }
  }

  return "sign-in";
}

/** Clear stale Clerk sign-in / sign-up before starting OAuth. */
export async function resetAuthAttempts(signIn?: unknown, signUp?: unknown) {
  const signInReset = (signIn as { reset?: () => Promise<unknown> | unknown } | null)
    ?.reset;
  const signUpReset = (signUp as { reset?: () => Promise<unknown> | unknown } | null)
    ?.reset;
  await signInReset?.();
  await signUpReset?.();
}

export const OAUTH_ABORT_QUERY_VALUES = new Set([
  "access_denied",
  "oauth_access_denied",
  "oauth_cancelled",
  "user_cancelled",
  "authorization_invalid",
]);

export function isOAuthAbort(searchParams: URLSearchParams): boolean {
  const error = searchParams.get("error")?.toLowerCase();
  const errCode = searchParams.get("err_code")?.toLowerCase();
  return (
    (!!error && OAUTH_ABORT_QUERY_VALUES.has(error)) ||
    (!!errCode && OAUTH_ABORT_QUERY_VALUES.has(errCode))
  );
}
