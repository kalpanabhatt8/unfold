export type AuthFlow = "sign-in" | "sign-up";

export const OTP_LENGTH = 6;

export const EMAIL_INVALID_MESSAGE = "Please enter a valid email address.";

export const LEGAL_REQUIRED_MESSAGE =
  "Please agree to the Terms and Conditions and Privacy Policy to continue.";

export const VERIFY_INTERRUPTED_MESSAGE =
  "Verification was interrupted. Please sign in or start again.";

export const VERIFY_FLOW_KEY = "unfold-auth-verify-flow";
export const VERIFY_EMAIL_KEY = "unfold-auth-verify-email";
export const VERIFY_INTERRUPTED_KEY = "unfold-auth-verify-interrupted";

export function generatePlaceholderPassword(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `Unf0ld!${rand.slice(0, 14)}`;
}

export function formatMissingSignUpFields(missing: string[]): string {
  const labels: Record<string, string> = {
    username: "username",
    first_name: "first name",
    last_name: "last name",
    legal_accepted: "terms acceptance",
    password: "password",
  };
  return missing
    .filter((field) => field !== "password")
    .map((field) => labels[field] ?? field.replace(/_/g, " "))
    .join(", ");
}

export function persistVerifySession(flow: AuthFlow, emailAddress: string) {
  try {
    sessionStorage.setItem(VERIFY_FLOW_KEY, flow);
    sessionStorage.setItem(VERIFY_EMAIL_KEY, emailAddress);
  } catch {
    // ignore
  }
}

export function readVerifyFlow(): AuthFlow | null {
  try {
    const value = sessionStorage.getItem(VERIFY_FLOW_KEY);
    return value === "sign-up" || value === "sign-in" ? value : null;
  } catch {
    return null;
  }
}

export function readVerifyEmail(): string {
  try {
    return sessionStorage.getItem(VERIFY_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearVerifySession() {
  try {
    sessionStorage.removeItem(VERIFY_FLOW_KEY);
    sessionStorage.removeItem(VERIFY_EMAIL_KEY);
  } catch {
    // ignore
  }
}

export function markVerifyInterrupted() {
  try {
    sessionStorage.setItem(VERIFY_INTERRUPTED_KEY, "1");
  } catch {
    // ignore
  }
  clearVerifySession();
}

export function consumeVerifyInterrupted(): boolean {
  try {
    const value = sessionStorage.getItem(VERIFY_INTERRUPTED_KEY);
    if (!value) return false;
    sessionStorage.removeItem(VERIFY_INTERRUPTED_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearVerifyInterrupted() {
  try {
    sessionStorage.removeItem(VERIFY_INTERRUPTED_KEY);
  } catch {
    // ignore
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isFieldError(message: string | null): boolean {
  return message === EMAIL_INVALID_MESSAGE;
}

export function clerkErrorCode(err: unknown): string | undefined {
  if (
    err &&
    typeof err === "object" &&
    "errors" in err &&
    Array.isArray((err as { errors: unknown }).errors)
  ) {
    return (err as { errors: Array<{ code?: string }> }).errors[0]?.code;
  }
  return undefined;
}

export function clerkErrorMessage(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "errors" in err &&
    Array.isArray((err as { errors: unknown }).errors)
  ) {
    const first = (
      err as { errors: Array<{ longMessage?: string; message?: string }> }
    ).errors[0];
    const raw = first?.longMessage || first?.message || "";
    return raw || "Something went wrong. Try again.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Try again.";
}

export function isAlreadySignedInError(err: unknown): boolean {
  const code = clerkErrorCode(err);
  if (code === "session_exists" || code === "identifier_already_signed_in") {
    return true;
  }
  const message = clerkErrorMessage(err);
  return /already signed in/i.test(message);
}

export function isAlreadyVerifiedError(err: unknown): boolean {
  const code = clerkErrorCode(err);
  if (code === "verification_already_verified") return true;
  return /already (been )?verified/i.test(clerkErrorMessage(err));
}

/** Never show Clerk's raw "already verified" string in the UI. */
export function friendlyAuthError(err: unknown): string {
  if (isAlreadyVerifiedError(err)) {
    return "Your email is verified — finishing your account…";
  }
  return clerkErrorMessage(err);
}
