"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import type { EmailCodeFactor, OAuthStrategy } from "@clerk/types";
import {
  AUTH_AFTER_SIGN_IN_PATH,
  AUTH_SIGN_IN_PATH,
  AUTH_SSO_CALLBACK_PATH,
  AUTH_VERIFY_PATH,
  authAbsoluteUrl,
} from "@/lib/auth-routes";
import { resetAuthAttempts } from "@/lib/auth-finalize";
import { btnSecondary } from "@/components/ui/button-system";
import "@/components/auth/auth-form.css";

type Step = "credentials" | "verify";
type AuthFlow = "sign-in" | "sign-up";

const OTP_LENGTH = 6;
const VERIFY_FLOW_KEY = "unfold-auth-verify-flow";
const VERIFY_EMAIL_KEY = "unfold-auth-verify-email";
const VERIFY_INTERRUPTED_KEY = "unfold-auth-verify-interrupted";

const PASSWORD_RULES_MESSAGE =
  "Must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special character";

const EMAIL_INVALID_MESSAGE = "Please enter a valid email address.";

const LEGAL_REQUIRED_MESSAGE =
  "Please agree to the Terms and Conditions and Privacy Policy to continue.";

const VERIFY_INTERRUPTED_MESSAGE =
  "Verification was interrupted. Please sign in or start again.";

/** Cancels a pending "left verify" mark (React Strict Mode remount). */
let verifyMountId = 0;

function persistVerifySession(flow: AuthFlow, emailAddress: string) {
  try {
    sessionStorage.setItem(VERIFY_FLOW_KEY, flow);
    sessionStorage.setItem(VERIFY_EMAIL_KEY, emailAddress);
  } catch {
    // ignore
  }
}

function readVerifyFlow(): AuthFlow | null {
  try {
    const value = sessionStorage.getItem(VERIFY_FLOW_KEY);
    return value === "sign-up" || value === "sign-in" ? value : null;
  } catch {
    return null;
  }
}

function readVerifyEmail(): string {
  try {
    return sessionStorage.getItem(VERIFY_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

function clearVerifySession() {
  try {
    sessionStorage.removeItem(VERIFY_FLOW_KEY);
    sessionStorage.removeItem(VERIFY_EMAIL_KEY);
  } catch {
    // ignore
  }
}

function markVerifyInterrupted() {
  try {
    sessionStorage.setItem(VERIFY_INTERRUPTED_KEY, "1");
  } catch {
    // ignore
  }
  clearVerifySession();
}

function consumeVerifyInterrupted(): boolean {
  try {
    const value = sessionStorage.getItem(VERIFY_INTERRUPTED_KEY);
    if (!value) return false;
    sessionStorage.removeItem(VERIFY_INTERRUPTED_KEY);
    return true;
  } catch {
    return false;
  }
}

function clearVerifyInterrupted() {
  try {
    sessionStorage.removeItem(VERIFY_INTERRUPTED_KEY);
  } catch {
    // ignore
  }
}

function isStrongPassword(value: string): boolean {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isFieldError(message: string | null): boolean {
  return (
    message === PASSWORD_RULES_MESSAGE || message === EMAIL_INVALID_MESSAGE
  );
}

function isAlreadySignedInError(err: unknown): boolean {
  const code = clerkErrorCode(err);
  if (code === "session_exists" || code === "identifier_already_signed_in") {
    return true;
  }
  const message = clerkErrorMessage(err);
  return /already signed in/i.test(message);
}

function isAlreadyVerifiedError(err: unknown): boolean {
  const code = clerkErrorCode(err);
  if (code === "verification_already_verified") return true;
  return /already (been )?verified/i.test(clerkErrorMessage(err));
}

/** Never show Clerk's raw "already verified" string in the UI. */
function friendlyAuthError(err: unknown): string {
  if (isAlreadyVerifiedError(err)) {
    return "Your email is verified — finishing your account…";
  }
  return clerkErrorMessage(err);
}

function clerkErrorMessage(err: unknown): string {
  const code = clerkErrorCode(err);
  if (
    code === "form_password_pwned" ||
    code === "form_password_pwned__sign_in" ||
    code === "form_password_compromised__sign_in" ||
    code === "form_password_untrusted__sign_in" ||
    code === "form_password_not_strong_enough" ||
    code === "form_password_length_too_short" ||
    code === "form_password_validation_failed"
  ) {
    return PASSWORD_RULES_MESSAGE;
  }

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
    if (
      /data breach|online data breach|pwned|not strong|too short|uppercase|special character/i.test(
        raw,
      )
    ) {
      return PASSWORD_RULES_MESSAGE;
    }
    return raw || "Something went wrong. Try again.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Try again.";
}

function clerkErrorCode(err: unknown): string | undefined {
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

export function AuthForm() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveFromSignUp } =
    useSignUp();
  const activateSession = setActive ?? setActiveFromSignUp;

  const step: Step =
    pathname === AUTH_VERIFY_PATH ? "verify" : "credentials";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [digits, setDigits] = React.useState<string[]>(() =>
    Array.from({ length: OTP_LENGTH }, () => ""),
  );
  const [flow, setFlow] = React.useState<AuthFlow>("sign-in");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [showPassword, setShowPassword] = React.useState(false);
  const [acceptedLegal, setAcceptedLegal] = React.useState(false);
  const otpRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const isLoaded = authLoaded && signInLoaded && signUpLoaded;
  const busy = pending || !isLoaded;

  const resetOtp = React.useCallback(() => {
    setDigits(Array.from({ length: OTP_LENGTH }, () => ""));
  }, []);

  const hasActiveVerifySession = React.useCallback((): boolean => {
    const saved = readVerifyFlow();
    const emailStatus = signUp?.verifications?.emailAddress?.status;
    const signUpNeedsEmail =
      !!signUp?.id &&
      signUp.status !== "complete" &&
      (signUp.unverifiedFields?.includes("email_address") ||
        emailStatus === "unverified" ||
        emailStatus === "expired" ||
        emailStatus === "failed");
    return (
      !!saved ||
      signUpNeedsEmail ||
      signIn?.status === "needs_second_factor"
    );
  }, [signUp, signIn]);

  /** Prefer Clerk resource state over React state (survives remounts / HMR). */
  const resolveVerifyFlow = React.useCallback((): AuthFlow => {
    const emailStatus = signUp?.verifications?.emailAddress?.status;
    const signUpNeedsEmail =
      !!signUp?.id &&
      signUp.status !== "complete" &&
      (signUp.unverifiedFields?.includes("email_address") ||
        emailStatus === "unverified" ||
        emailStatus === "expired" ||
        emailStatus === "failed");

    if (signUpNeedsEmail) return "sign-up";
    if (signIn?.status === "needs_second_factor") return "sign-in";
    return readVerifyFlow() ?? flow;
  }, [signUp, signIn, flow]);

  /** End OTP and return to the email/password screen. */
  const exitVerifyToCredentials = React.useCallback(() => {
    clearVerifySession();
    setFlow("sign-in");
    resetOtp();
    void resetAuthAttempts(signIn, signUp);
    if (pathname !== AUTH_SIGN_IN_PATH) {
      try {
        sessionStorage.setItem(VERIFY_INTERRUPTED_KEY, "1");
      } catch {
        // ignore
      }
      router.replace(AUTH_SIGN_IN_PATH);
    } else {
      setError(VERIFY_INTERRUPTED_MESSAGE);
    }
  }, [signIn, signUp, resetOtp, pathname, router]);

  const enterVerifyStep = React.useCallback(
    (nextFlow: AuthFlow) => {
      clearVerifyInterrupted();
      persistVerifySession(nextFlow, email.trim());
      setFlow(nextFlow);
      setDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      setError(null);
      // Don't lock Resend on first land — only after a successful resend.
      setResendCooldown(0);
      router.push(AUTH_VERIFY_PATH);
    },
    [email, router],
  );

  React.useEffect(() => {
    if (authLoaded && isSignedIn) {
      clearVerifySession();
      clearVerifyInterrupted();
      window.location.assign("/dashboard");
    }
  }, [authLoaded, isSignedIn]);

  // Restore email / flow when landing on the verify route.
  React.useEffect(() => {
    if (step !== "verify") return;
    const savedEmail = readVerifyEmail();
    if (savedEmail) setEmail(savedEmail);
    const savedFlow = readVerifyFlow();
    if (savedFlow) setFlow(savedFlow);
  }, [step]);

  // Verify URL without an active session → restart auth.
  React.useEffect(() => {
    if (!isLoaded || step !== "verify") return;
    if (hasActiveVerifySession()) return;
    exitVerifyToCredentials();
  }, [isLoaded, step, hasActiveVerifySession, exitVerifyToCredentials]);

  // Leaving the verify route invalidates the OTP session (Back, links, refresh).
  React.useEffect(() => {
    if (step !== "verify") return;

    const mountId = ++verifyMountId;

    const onPageHide = () => {
      if (!readVerifyFlow()) return;
      markVerifyInterrupted();
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      // Microtask runs before the next page's useEffects; Strict Mode remount bumps mountId.
      queueMicrotask(() => {
        if (verifyMountId !== mountId) return;
        if (!readVerifyFlow()) return;
        markVerifyInterrupted();
      });
    };
  }, [step]);

  // bfcache restore of verify → force restart on the auth route.
  React.useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (pathname !== AUTH_VERIFY_PATH) return;
      if (!consumeVerifyInterrupted()) return;
      exitVerifyToCredentials();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [pathname, exitVerifyToCredentials]);

  // After leaving verify, show the interrupted message on the credentials screen.
  React.useEffect(() => {
    if (!isLoaded || step === "verify") return;
    if (!consumeVerifyInterrupted()) return;

    setFlow("sign-in");
    resetOtp();
    setError(VERIFY_INTERRUPTED_MESSAGE);
    void resetAuthAttempts(signIn, signUp);
  }, [isLoaded, step, signIn, signUp, resetOtp]);

  const requireLegal = () => {
    if (!acceptedLegal) {
      setError(LEGAL_REQUIRED_MESSAGE);
      return false;
    }
    return true;
  };

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  const goDashboard = React.useCallback(
    async (sessionId: string | null | undefined) => {
      if (!sessionId || !activateSession) {
        throw new Error("No active session was created. Please try again.");
      }
      await activateSession({ session: sessionId });
      clearVerifySession();
      clearVerifyInterrupted();
      // Full navigation — avoids sitting on the auth skeleton while the app hydrates.
      window.location.assign("/dashboard");
    },
    [activateSession],
  );

  const buildCompletionPayload = React.useCallback(
    (resource: {
      missingFields?: string[];
      legalAcceptedAt?: number | null;
      emailAddress?: string | null;
    }) => {
      const missing = resource.missingFields ?? [];
      const payload: Record<string, string | boolean> = {};

      if (missing.includes("legal_accepted") || !resource.legalAcceptedAt) {
        payload.legalAccepted = true;
      }

      // Username may still be required in Clerk — never show a form for it.
      if (missing.includes("username")) {
        const base =
          (email.trim() || resource.emailAddress || "user")
            .split("@")[0]
            ?.replace(/[^a-zA-Z0-9_]/g, "")
            .slice(0, 18)
            .toLowerCase() || "user";
        payload.username = `${base}_${Math.random().toString(36).slice(2, 8)}`;
      }

      if (missing.includes("first_name")) payload.firstName = "Unfold";
      if (missing.includes("last_name")) payload.lastName = "Member";

      return payload;
    },
    [email],
  );

  const finalizeSignUp = React.useCallback(
    async (
      resource?: {
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
        reload?: () => Promise<{
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
        }>;
      } | null,
    ): Promise<{ ok: boolean; missing?: string[] }> => {
      const active = resource ?? signUp;
      if (!active || !activateSession) return { ok: false };

      const tryActivate = async (sessionId: string | null | undefined) => {
        if (!sessionId) return false;
        await activateSession({ session: sessionId });
        clearVerifySession();
        clearVerifyInterrupted();
        window.location.assign("/dashboard");
        return true;
      };

      if (active.status === "complete") {
        if (await tryActivate(active.createdSessionId)) return { ok: true };
      }

      const attemptComplete = async (
        target: NonNullable<typeof active>,
      ): Promise<{ ok: boolean; missing?: string[] }> => {
        if (target.status === "complete") {
          if (await tryActivate(target.createdSessionId)) return { ok: true };
        }
        if (target.status !== "missing_requirements") {
          return { ok: false, missing: target.missingFields };
        }

        const payload = buildCompletionPayload(target);
        if (Object.keys(payload).length === 0) {
          return { ok: false, missing: target.missingFields };
        }

        try {
          const updated = await target.update(payload);
          if (updated.status === "complete") {
            if (await tryActivate(updated.createdSessionId)) return { ok: true };
          }
          // Username collision — retry once with a new username.
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
              if (await tryActivate(retry.createdSessionId)) return { ok: true };
            }
            return { ok: false, missing: retry.missingFields };
          }
          return { ok: false, missing: updated.missingFields };
        } catch {
          return { ok: false, missing: target.missingFields };
        }
      };

      const first = await attemptComplete(active);
      if (first.ok) return first;

      if (active.reload) {
        try {
          const reloaded = await active.reload();
          return attemptComplete(reloaded);
        } catch {
          // ignore
        }
      }

      return first;
    },
    [signUp, activateSession, router, buildCompletionPayload],
  );

  // Email already verified but session not active — finish without another OTP attempt.
  React.useEffect(() => {
    if (!isLoaded || step !== "verify" || pending) return;
    if (signUp?.verifications?.emailAddress?.status !== "verified") return;
    if (signUp.status === "complete" && signUp.createdSessionId) {
      void goDashboard(signUp.createdSessionId);
      return;
    }
    if (signUp.status === "missing_requirements") {
      void finalizeSignUp(signUp).then((finished) => {
        if (!finished.ok && finished.missing?.length) {
          setError(
            `Email verified — still need: ${finished.missing.join(", ")}. In Clerk, turn off extra required fields like username.`,
          );
        }
      });
    }
  }, [isLoaded, step, pending, signUp, goDashboard, finalizeSignUp]);

  const startEmailVerification = async () => {
    if (!signUp) return;
    await signUp.prepareVerification({ strategy: "email_code" });
    enterVerifyStep("sign-up");
  };

  /** Create account + send OTP. Used for true first-time users. */
  const createAccountAndSendCode = async (): Promise<
    "ok" | "wrong_password" | "error"
  > => {
    if (!signUp) return "error";
    if (!isStrongPassword(password)) {
      setError(PASSWORD_RULES_MESSAGE);
      return "error";
    }

    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        legalAccepted: true,
      });
      await startEmailVerification();
      return "ok";
    } catch (signUpErr) {
      const code = clerkErrorCode(signUpErr) ?? "";
      const message = clerkErrorMessage(signUpErr);
      const alreadyExists =
        code === "form_identifier_exists" ||
        /already|exists|taken/i.test(message);

      if (alreadyExists) {
        // Incomplete prior sign-up — resume email verification if possible.
        try {
          await signUp.prepareVerification({ strategy: "email_code" });
          enterVerifyStep("sign-up");
          return "ok";
        } catch {
          // Account is already registered — the sign-in password was wrong.
          return "wrong_password";
        }
      }

      setError(message);
      return "error";
    }
  };

  const signInWithOAuth = async (strategy: OAuthStrategy) => {
    if (!isLoaded || !signIn) return;
    if (isSignedIn) {
      router.replace("/dashboard");
      return;
    }
    setError(null);
    setPending(true);
    try {
      clearVerifySession();
      clearVerifyInterrupted();
      resetOtp();
      await resetAuthAttempts(signIn, signUp);

      const origin = window.location.origin;
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: authAbsoluteUrl(AUTH_SSO_CALLBACK_PATH, origin),
        redirectUrlComplete: authAbsoluteUrl(AUTH_AFTER_SIGN_IN_PATH, origin),
      });
    } catch (err) {
      if (isAlreadySignedInError(err)) {
        router.replace("/dashboard");
        return;
      }
      setError(clerkErrorMessage(err));
      setPending(false);
    }
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn || !signUp) return;
    if (isSignedIn) {
      router.replace("/dashboard");
      return;
    }
    if (!isValidEmail(email)) {
      setError(EMAIL_INVALID_MESSAGE);
      return;
    }
    if (!requireLegal()) return;

    setError(null);
    setPending(true);

    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (attempt.status === "complete") {
        await goDashboard(attempt.createdSessionId);
        return;
      }

      if (attempt.status === "needs_second_factor") {
        const emailCodeFactor = attempt.supportedSecondFactors?.find(
          (factor): factor is EmailCodeFactor => factor.strategy === "email_code",
        );
        if (emailCodeFactor) {
          await signIn.prepareSecondFactor({
            strategy: "email_code",
            emailAddressId: emailCodeFactor.emailAddressId,
          });
          enterVerifyStep("sign-in");
        } else {
          setError(
            "Additional verification is required, but no email code option is available.",
          );
        }
        return;
      }

      setError("Couldn’t finish signing in. Please try again.");
    } catch (err) {
      if (isAlreadySignedInError(err)) {
        router.replace("/dashboard");
        return;
      }

      const code = clerkErrorCode(err);
      // Clerk may return password_incorrect for unknown emails when user
      // enumeration protection is on — so try sign-up for both. If sign-up
      // then says the email is taken, the password was simply wrong.
      if (
        code === "form_identifier_not_found" ||
        code === "form_password_incorrect"
      ) {
        const result = await createAccountAndSendCode();
        if (result === "ok") return;
        if (result === "wrong_password") {
          setError(
            "Incorrect password. Try again, or Continue with Google.",
          );
          return;
        }
        return;
      }

      setError(clerkErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const readOtpValue = () => {
    const fromState = digits.join("").replace(/\D/g, "");
    if (fromState.length === OTP_LENGTH) return fromState;
    const fromRefs = otpRefs.current
      .map((el) => el?.value ?? "")
      .join("")
      .replace(/\D/g, "");
    return fromRefs.slice(0, OTP_LENGTH);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn || !signUp || pending) return;
    const otp = readOtpValue();
    if (otp.length !== OTP_LENGTH) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setError(null);
    setPending(true);

    const verifyFlow = resolveVerifyFlow();

    try {
      if (verifyFlow === "sign-up") {
        try {
          const attempt = await signUp.attemptVerification({
            strategy: "email_code",
            code: otp,
          });
          if (attempt.status === "complete") {
            await goDashboard(attempt.createdSessionId);
            return;
          }
          if (attempt.status === "missing_requirements") {
            const finished = await finalizeSignUp(attempt);
            if (finished.ok) return;
            const missing = finished.missing?.filter(Boolean) ?? [];
            setError(
              missing.length > 0
                ? `Almost done — still need: ${missing.join(", ")}. Check Clerk required fields (turn off username if enabled).`
                : "Couldn’t finish creating your account. Please try again.",
            );
            return;
          }
          const finished = await finalizeSignUp(attempt);
          if (finished.ok) return;
          setError("Verification incomplete. Check the code and try again.");
          return;
        } catch (err) {
          if (isAlreadyVerifiedError(err)) {
            const finished = await finalizeSignUp(signUp);
            if (finished.ok) return;
            if (isSignedIn) {
              router.replace("/dashboard");
              return;
            }
            // Don't show Clerk's raw message — email is done; account finish failed.
            const missing = finished.missing?.filter(Boolean) ?? [];
            setError(
              missing.length > 0
                ? `Email verified — still need: ${missing.join(", ")}. In Clerk, turn off extra required fields like username.`
                : "Email is verified, but we couldn’t open your account. Use Continue with Google, then try again.",
            );
            return;
          }
          throw err;
        }
      }

      const attempt = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code: otp,
      });
      if (attempt.status === "complete") {
        await goDashboard(attempt.createdSessionId);
        return;
      }
      setError("Verification incomplete. Check the code and try again.");
    } catch (err) {
      if (isAlreadyVerifiedError(err)) {
        const finished = await finalizeSignUp(signUp);
        if (finished.ok) return;
        if (isSignedIn) {
          router.replace("/dashboard");
          return;
        }
        const missing = finished.missing?.filter(Boolean) ?? [];
        setError(
          missing.length > 0
            ? `Email verified — still need: ${missing.join(", ")}. In Clerk, turn off extra required fields like username.`
            : "Email is verified, but we couldn’t open your account. Use Continue with Google, then try again.",
        );
        return;
      }
      if (isAlreadySignedInError(err) || isSignedIn) {
        router.replace("/dashboard");
        return;
      }
      setError(friendlyAuthError(err));
    } finally {
      setPending(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || !signIn || !signUp || resendCooldown > 0 || pending) return;

    setError(null);
    setPending(true);
    const verifyFlow = resolveVerifyFlow();

    try {
      if (verifyFlow === "sign-up") {
        if (!signUp.id) {
          setError("Session expired. Go back and continue with your email again.");
          return;
        }
        // Email already verified — finish account instead of sending another code.
        const emailStatus = signUp.verifications?.emailAddress?.status;
        if (emailStatus === "verified") {
          const finished = await finalizeSignUp(signUp);
          if (finished.ok) return;
          const missing = finished.missing?.filter(Boolean) ?? [];
          setError(
            missing.length > 0
              ? `Email verified — still need: ${missing.join(", ")}. In Clerk, turn off extra required fields like username.`
              : "Email is verified, but we couldn’t open your account. Use Continue with Google, then try again.",
          );
          return;
        }
        await signUp.prepareVerification({ strategy: "email_code" });
      } else {
        const emailCodeFactor = signIn.supportedSecondFactors?.find(
          (factor): factor is EmailCodeFactor => factor.strategy === "email_code",
        );
        if (!emailCodeFactor) {
          setError("Couldn’t resend the code. Try signing in again.");
          return;
        }
        await signIn.prepareSecondFactor({
          strategy: "email_code",
          emailAddressId: emailCodeFactor.emailAddressId,
        });
      }
      resetOtp();
      setResendCooldown(30);
      setError(null);
      otpRefs.current[0]?.focus();
    } catch (err) {
      if (isAlreadyVerifiedError(err)) {
        const finished = await finalizeSignUp(signUp);
        if (finished.ok) return;
        setError(
          "Email is verified, but we couldn’t open your account. Use Continue with Google, then try again.",
        );
        return;
      }
      setError(friendlyAuthError(err));
    } finally {
      setPending(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    // Paste or multi-digit entry
    const chars = cleaned.slice(0, OTP_LENGTH - index).split("");
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((ch, i) => {
        next[index + i] = ch;
      });
      return next;
    });
    const focusTo = Math.min(index + chars.length, OTP_LENGTH - 1);
    otpRefs.current[focusTo]?.focus();
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] ?? "");
    setDigits(next);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus();
  };

  // Only block the UI when we already know the user is signed in and are
  // redirecting — keep it minimal (not the form wireframe).
  if (authLoaded && isSignedIn) {
    return (
      <div className="auth-shell auth-shell--top">
        <p className="auth-redirecting">Opening Unfold…</p>
      </div>
    );
  }

  return (
    <div className={`auth-shell${step === "verify" ? " auth-shell--top" : ""}`}>
      <div className={step === "verify" ? "auth-verify" : "auth-card"}>
        {step === "credentials" ? (
          <>
            <header className="auth-header">
              <h1 className="auth-title">Welcome to Unfold</h1>
              <p className="auth-subtitle">
                Sign in or create an account to continue.
              </p>
            </header>

            <button
              type="button"
              className={`auth-google ${btnSecondary("md")}`}
              disabled={busy}
              onClick={() => signInWithOAuth("oauth_google")}
            >
              <GoogleMark />
              Continue with Google
            </button>

            <div className="auth-divider" role="separator">
              <span>or</span>
            </div>

            <form className="auth-form" onSubmit={handleCredentials} noValidate>
              <div className="auth-fields">
                <label className="auth-field">
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error === EMAIL_INVALID_MESSAGE) setError(null);
                    }}
                    placeholder="you@example.com"
                    disabled={pending}
                    aria-invalid={error === EMAIL_INVALID_MESSAGE}
                    aria-describedby={
                      error === EMAIL_INVALID_MESSAGE
                        ? "auth-email-error"
                        : undefined
                    }
                  />
                </label>
                {error === EMAIL_INVALID_MESSAGE ? (
                  <p
                    id="auth-email-error"
                    className="auth-error auth-error--field"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}

                <label className="auth-field">
                  <span>Password</span>
                  <div className="auth-password-row">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error === PASSWORD_RULES_MESSAGE) setError(null);
                      }}
                      placeholder="Your password"
                      disabled={pending}
                      aria-invalid={error === PASSWORD_RULES_MESSAGE}
                      aria-describedby={
                        error === PASSWORD_RULES_MESSAGE
                          ? "auth-password-error"
                          : undefined
                      }
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                {error === PASSWORD_RULES_MESSAGE ? (
                  <p
                    id="auth-password-error"
                    className="auth-error auth-error--field"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
              </div>

              <label className="auth-check auth-legal">
                <input
                  type="checkbox"
                  checked={acceptedLegal}
                  onChange={(e) => setAcceptedLegal(e.target.checked)}
                  disabled={pending}
                />
                <span>
                  I have read and agree to the{" "}
                  <Link href="/terms" target="_blank" rel="noreferrer">
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" rel="noreferrer">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              {error && !isFieldError(error) ? (
                <p
                  className={
                    error === LEGAL_REQUIRED_MESSAGE
                      ? "auth-error auth-error--banner"
                      : "auth-error"
                  }
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button type="submit" className="auth-submit" disabled={busy}>
                {pending ? "Continuing…" : "Continue"}
              </button>
            </form>

            <div id="clerk-captcha" />
          </>
        ) : null}

        {step === "verify" ? (
          <>
            <header className="auth-header">
              <h1 className="auth-title">Check your inbox</h1>
              <p className="auth-subtitle auth-subtitle--inline text-sm!" title={email}>
                Enter the verification code we just sent to <br /><span className="auth-email text-sm!">{email}</span>
              </p>
            </header>

            <form className="auth-form" onSubmit={handleVerify}>
             <div className="flex w-fit flex-col gap-4">
             <div
                className="auth-otp"
                role="group"
                aria-label="Verification code"
              >
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    className="auth-otp-box"
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={digit}
                    disabled={pending}
                    autoFocus={index === 0}
                    aria-label={`Digit ${index + 1}`}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                  />
                ))}
              </div>

              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}
             </div>

              <button type="submit" className="auth-submit" disabled={busy}>
                {pending ? "Verifying…" : "Verify"}
              </button>

              <p className="auth-resend-line">
                Didn&apos;t receive it yet?{" "}
                {resendCooldown > 0 ? (
                  <span className="auth-resend-wait">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    className="auth-resend-link"
                    disabled={pending || !isLoaded}
                    onClick={() => void handleResendCode()}
                  >
                    Resend
                  </button>
                )}
              </p>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
