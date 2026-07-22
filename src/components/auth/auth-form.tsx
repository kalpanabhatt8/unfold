"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import type { EmailCodeFactor, OAuthStrategy } from "@clerk/types";
import {
  AUTH_AFTER_SIGN_IN_PATH,
  AUTH_SIGN_IN_PATH,
  AUTH_SIGN_IN_VERIFY_PATH,
  AUTH_SIGN_UP_PATH,
  AUTH_SIGN_UP_VERIFY_PATH,
  AUTH_SSO_CALLBACK_PATH,
  authAbsoluteUrl,
} from "@/lib/auth-routes";
import {
  type AuthFlow,
  clearVerifyInterrupted,
  clearVerifySession,
  clerkErrorCode,
  clerkErrorMessage,
  consumeVerifyInterrupted,
  EMAIL_INVALID_MESSAGE,
  friendlyAuthError,
  isAlreadySignedInError,
  isAlreadyVerifiedError,
  isFieldError,
  isValidEmail,
  LEGAL_REQUIRED_MESSAGE,
  markVerifyInterrupted,
  OTP_LENGTH,
  persistVerifySession,
  readVerifyEmail,
  readVerifyFlow,
  VERIFY_INTERRUPTED_MESSAGE,
  formatMissingSignUpFields,
} from "@/lib/auth-utils";
import {
  buildSignUpCompletionPayload,
  resetAuthAttempts,
} from "@/lib/auth-finalize";
import { btnSecondary } from "@/components/ui/button-system";
import "@/components/auth/auth-form.css";

type AuthMode = "sign-in" | "sign-up" | "sign-in-verify" | "sign-up-verify";

/** Cancels a pending "left verify" mark (React Strict Mode remount). */
let verifyMountId = 0;

function getAuthMode(pathname: string): AuthMode {
  if (pathname === AUTH_SIGN_UP_VERIFY_PATH) return "sign-up-verify";
  if (pathname === AUTH_SIGN_IN_VERIFY_PATH) return "sign-in-verify";
  if (pathname === AUTH_SIGN_UP_PATH) return "sign-up";
  return "sign-in";
}

function verifyPathForFlow(flow: AuthFlow): string {
  return flow === "sign-up"
    ? AUTH_SIGN_UP_VERIFY_PATH
    : AUTH_SIGN_IN_VERIFY_PATH;
}

function credentialsPathForFlow(flow: AuthFlow): string {
  return flow === "sign-up" ? AUTH_SIGN_UP_PATH : AUTH_SIGN_IN_PATH;
}

function flowFromMode(mode: AuthMode): AuthFlow {
  return mode === "sign-up" || mode === "sign-up-verify" ? "sign-up" : "sign-in";
}

function isVerifyMode(mode: AuthMode): boolean {
  return mode === "sign-in-verify" || mode === "sign-up-verify";
}

export function AuthForm() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveFromSignUp } =
    useSignUp();
  const activateSession = setActive ?? setActiveFromSignUp;

  const mode = getAuthMode(pathname);

  const [email, setEmail] = React.useState("");
  const [digits, setDigits] = React.useState<string[]>(() =>
    Array.from({ length: OTP_LENGTH }, () => ""),
  );
  const [flow, setFlow] = React.useState<AuthFlow>(() => flowFromMode(mode));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [acceptedLegal, setAcceptedLegal] = React.useState(false);
  const otpRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const finalizingSignUpRef = React.useRef(false);

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
    const signInNeedsEmailCode =
      signIn?.status === "needs_first_factor" ||
      signIn?.status === "needs_second_factor";
    return !!saved || signUpNeedsEmail || signInNeedsEmailCode;
  }, [signUp, signIn]);

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
    if (
      signIn?.status === "needs_first_factor" ||
      signIn?.status === "needs_second_factor"
    ) {
      return "sign-in";
    }
    return readVerifyFlow() ?? flow;
  }, [signUp, signIn, flow]);

  const exitVerifyToCredentials = React.useCallback(() => {
    const activeFlow = resolveVerifyFlow();
    clearVerifySession();
    setFlow(activeFlow);
    resetOtp();
    void resetAuthAttempts(signIn, signUp);

    const target = credentialsPathForFlow(activeFlow);
    if (pathname !== target) {
      try {
        sessionStorage.setItem("unfold-auth-verify-interrupted", "1");
      } catch {
        // ignore
      }
      router.replace(target);
    } else {
      setError(VERIFY_INTERRUPTED_MESSAGE);
    }
  }, [signIn, signUp, resetOtp, pathname, router, resolveVerifyFlow]);

  const enterVerifyStep = React.useCallback(
    (nextFlow: AuthFlow) => {
      clearVerifyInterrupted();
      persistVerifySession(nextFlow, email.trim());
      setFlow(nextFlow);
      setDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      setError(null);
      setResendCooldown(0);
      router.push(verifyPathForFlow(nextFlow));
    },
    [email, router],
  );

  React.useEffect(() => {
    if (authLoaded && isSignedIn && !isVerifyMode(mode)) {
      clearVerifySession();
      clearVerifyInterrupted();
      window.location.assign("/dashboard");
    }
  }, [authLoaded, isSignedIn, mode]);

  React.useEffect(() => {
    if (!isVerifyMode(mode)) return;
    const savedEmail = readVerifyEmail();
    if (savedEmail) setEmail(savedEmail);
    const savedFlow = readVerifyFlow();
    if (savedFlow) setFlow(savedFlow);
  }, [mode]);

  React.useEffect(() => {
    if (!isLoaded || !isVerifyMode(mode)) return;
    if (hasActiveVerifySession()) return;
    exitVerifyToCredentials();
  }, [isLoaded, mode, hasActiveVerifySession, exitVerifyToCredentials]);

  React.useEffect(() => {
    if (!isVerifyMode(mode)) return;

    const mountId = ++verifyMountId;

    const onPageHide = () => {
      if (!readVerifyFlow()) return;
      markVerifyInterrupted();
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      queueMicrotask(() => {
        if (verifyMountId !== mountId) return;
        if (!readVerifyFlow()) return;
        markVerifyInterrupted();
      });
    };
  }, [mode]);

  React.useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (!isVerifyMode(getAuthMode(pathname))) return;
      if (!consumeVerifyInterrupted()) return;
      exitVerifyToCredentials();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [pathname, exitVerifyToCredentials]);

  React.useEffect(() => {
    if (!isLoaded || isVerifyMode(mode)) return;
    if (!consumeVerifyInterrupted()) return;

    setFlow(flowFromMode(mode));
    resetOtp();
    setError(VERIFY_INTERRUPTED_MESSAGE);
    void resetAuthAttempts(signIn, signUp);
  }, [isLoaded, mode, signIn, signUp, resetOtp]);

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
      window.location.assign("/dashboard");
    },
    [activateSession],
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
      if (finalizingSignUpRef.current) return { ok: false };
      finalizingSignUpRef.current = true;

      const active = resource ?? signUp;
      if (!active || !activateSession) {
        finalizingSignUpRef.current = false;
        return { ok: false };
      }

      try {
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

          const payload = buildSignUpCompletionPayload(target, email.trim());
          if (Object.keys(payload).length === 0) {
            return { ok: false, missing: target.missingFields };
          }

          try {
            const updated = await target.update(payload);
            if (updated.status === "complete") {
              if (await tryActivate(updated.createdSessionId)) return { ok: true };
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
                if (await tryActivate(retry.createdSessionId)) return { ok: true };
              }
              return { ok: false, missing: retry.missingFields };
            }
            return { ok: false, missing: updated.missingFields };
          } catch {
            return { ok: false, missing: target.missingFields };
          }
        };

        return await attemptComplete(active);
      } finally {
        finalizingSignUpRef.current = false;
      }
    },
    [signUp, activateSession, email],
  );

  // Remount / bfcache only — normal verify completion runs in handleVerify.
  React.useEffect(() => {
    if (!isLoaded || mode !== "sign-up-verify" || pending) return;
    if (signUp?.status === "complete" && signUp.createdSessionId) {
      void goDashboard(signUp.createdSessionId);
    }
  }, [isLoaded, mode, pending, signUp?.status, signUp?.createdSessionId, goDashboard]);

  const findEmailCodeFactor = () => {
    const firstFactor = signIn?.supportedFirstFactors?.find(
      (factor): factor is EmailCodeFactor => factor.strategy === "email_code",
    );
    if (firstFactor) return { factor: firstFactor, asSecondFactor: false };

    const secondFactor = signIn?.supportedSecondFactors?.find(
      (factor): factor is EmailCodeFactor => factor.strategy === "email_code",
    );
    if (secondFactor) return { factor: secondFactor, asSecondFactor: true };

    return null;
  };

  const sendSignInEmailCode = async () => {
    if (!signIn) return false;

    const emailCode = findEmailCodeFactor();
    if (!emailCode) return false;

    if (emailCode.asSecondFactor) {
      await signIn.prepareSecondFactor({
        strategy: "email_code",
        emailAddressId: emailCode.factor.emailAddressId,
      });
    } else {
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailCode.factor.emailAddressId,
      });
    }
    return true;
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    if (isSignedIn) {
      router.replace("/dashboard");
      return;
    }
    if (!isValidEmail(email)) {
      setError(EMAIL_INVALID_MESSAGE);
      return;
    }

    setError(null);
    setPending(true);

    try {
      await resetAuthAttempts(signIn, signUp);
      const attempt = await signIn.create({
        identifier: email.trim(),
      });

      if (attempt.status === "complete") {
        await goDashboard(attempt.createdSessionId);
        return;
      }

      if (
        attempt.status === "needs_first_factor" ||
        attempt.status === "needs_second_factor"
      ) {
        const sent = await sendSignInEmailCode();
        if (sent) {
          enterVerifyStep("sign-in");
          return;
        }
        setError(
          "Email verification isn't available for this account. Try Continue with Google.",
        );
        return;
      }

      setError("Couldn't finish signing in. Please try again.");
    } catch (err) {
      if (isAlreadySignedInError(err)) {
        router.replace("/dashboard");
        return;
      }

      const code = clerkErrorCode(err);
      if (code === "form_identifier_not_found") {
        setError("No account found with this email. Sign up instead.");
        return;
      }

      setError(clerkErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
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
      await resetAuthAttempts(undefined, signUp);
      await signUp.create({
        emailAddress: email.trim(),
        legalAccepted: true,
      });
      await signUp.prepareVerification({ strategy: "email_code" });
      enterVerifyStep("sign-up");
    } catch (err) {
      if (isAlreadySignedInError(err)) {
        router.replace("/dashboard");
        return;
      }

      const code = clerkErrorCode(err) ?? "";
      const message = clerkErrorMessage(err);
      const alreadyExists =
        code === "form_identifier_exists" ||
        /already|exists|taken/i.test(message);

      if (alreadyExists) {
        setError("An account with this email already exists. Sign in instead.");
        return;
      }

      setError(message);
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
            const missingLabel = formatMissingSignUpFields(missing);
            setError(
              missingLabel
                ? `Almost done — still need: ${missingLabel}. Check Clerk required fields (turn off username if enabled).`
                : "Couldn't finish creating your account. Please try again.",
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
            const missing = finished.missing?.filter(Boolean) ?? [];
            const missingLabel = formatMissingSignUpFields(missing);
            setError(
              missingLabel
                ? `Email verified — still need: ${missingLabel}. In Clerk, turn off extra required fields like username.`
                : "Email is verified, but we couldn't open your account. Use Continue with Google, then try again.",
            );
            return;
          }
          throw err;
        }
      }

      if (signIn.status === "needs_second_factor") {
        const attempt = await signIn.attemptSecondFactor({
          strategy: "email_code",
          code: otp,
        });
        if (attempt.status === "complete") {
          await goDashboard(attempt.createdSessionId);
          return;
        }
      } else {
        const attempt = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code: otp,
        });
        if (attempt.status === "complete") {
          await goDashboard(attempt.createdSessionId);
          return;
        }
        if (attempt.status === "needs_second_factor") {
          const sent = await sendSignInEmailCode();
          if (sent) {
            resetOtp();
            setError(null);
            setResendCooldown(0);
            otpRefs.current[0]?.focus();
            return;
          }
        }
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
        const missingLabel = formatMissingSignUpFields(missing);
        setError(
          missingLabel
            ? `Email verified — still need: ${missingLabel}. In Clerk, turn off extra required fields like username.`
            : "Email is verified, but we couldn't open your account. Use Continue with Google, then try again.",
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
        const emailStatus = signUp.verifications?.emailAddress?.status;
        if (emailStatus === "verified") {
          const finished = await finalizeSignUp(signUp);
          if (finished.ok) return;
          const missing = finished.missing?.filter(Boolean) ?? [];
          const missingLabel = formatMissingSignUpFields(missing);
          setError(
            missingLabel
              ? `Email verified — still need: ${missingLabel}. In Clerk, turn off extra required fields like username.`
              : "Email is verified, but we couldn't open your account. Use Continue with Google, then try again.",
          );
          return;
        }
        await signUp.prepareVerification({ strategy: "email_code" });
      } else {
        const sent = await sendSignInEmailCode();
        if (!sent) {
          setError("Couldn't resend the code. Try signing in again.");
          return;
        }
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
          "Email is verified, but we couldn't open your account. Use Continue with Google, then try again.",
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

  if (authLoaded && isSignedIn && !isVerifyMode(mode)) {
    return (
      <div className="auth-shell">
        <p className="auth-redirecting">Opening Unfold…</p>
      </div>
    );
  }

  const showVerify = isVerifyMode(mode);

  return (
    <div className="auth-shell">
      <div className={showVerify ? "auth-verify" : "auth-card"}>
        {mode === "sign-in" ? (
          <>
            <header className="auth-header">
              <h1 className="auth-title">Welcome back</h1>
              <p className="auth-subtitle">Continue where your thoughts left off.</p>
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
              <span>or continue with</span>
            </div>

            <form className="auth-form" onSubmit={handleSignIn} noValidate>
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
              </div>

              {error && !isFieldError(error) ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="auth-submit" disabled={busy}>
                {pending ? "Continuing…" : "Continue"}
              </button>
            </form>

            <p className="auth-switch-line">
              Don&apos;t have an account?{" "}
              <Link href={AUTH_SIGN_UP_PATH} className="auth-inline-link">
                Sign Up
              </Link>
            </p>

            <div id="clerk-captcha" />
          </>
        ) : null}

        {mode === "sign-up" ? (
          <>
            <header className="auth-header">
              <h1 className="auth-title">Start unfolding</h1>
              <p className="auth-subtitle">
                Create your space to write and reflect.
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
              <span>or continue with</span>
            </div>

            <form className="auth-form" onSubmit={handleSignUp} noValidate>
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
              </div>

              <label className="auth-check auth-legal">
                <input
                  type="checkbox"
                  checked={acceptedLegal}
                  onChange={(e) => setAcceptedLegal(e.target.checked)}
                  disabled={pending}
                />
                <span className="pt-0.5">
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

            <p className="auth-switch-line">
              Already have an account?{" "}
              <Link href={AUTH_SIGN_IN_PATH} className="auth-inline-link">
                Sign In
              </Link>
            </p>

            <div id="clerk-captcha" />
          </>
        ) : null}

        {showVerify ? (
          <>
            <header className="auth-header">
              <h1 className="auth-title">Check your inbox</h1>
              <p className="auth-subtitle auth-subtitle--inline text-sm!" title={email}>
                Enter the verification code we just sent to <br />
                <span className="auth-email text-sm!">{email}</span>
              </p>
            </header>

            <form className="auth-form" onSubmit={handleVerify}>
              <div className="auth-otp-wrap">
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
