"use client";

import * as React from "react";
import { AuthenticateWithRedirectCallback, useAuth, useSignUp } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AUTH_AFTER_SIGN_IN_PATH,
  AUTH_CONTINUE_PATH,
  AUTH_SIGN_IN_PATH,
  AUTH_SIGN_UP_PATH,
} from "@/lib/auth-routes";
import { isOAuthAbort } from "@/lib/auth-finalize";
import { AppLoader } from "@/components/ui/app-loader";
import "./sso-callback.css";

/** If Clerk never navigates away (captcha hang, etc.), bail out. */
const SSO_STUCK_MS = 20_000;

function SSOCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();

  React.useEffect(() => {
    if (isOAuthAbort(searchParams)) {
      router.replace(AUTH_SIGN_IN_PATH);
    }
  }, [router, searchParams]);

  // Session already active - don't wait on the callback component.
  React.useEffect(() => {
    if (authLoaded && isSignedIn) {
      window.location.assign(AUTH_AFTER_SIGN_IN_PATH);
    }
  }, [authLoaded, isSignedIn]);

  // Safety net: first-time Google sign-up often needs /continue for legalAccepted.
  // If captcha or transfer stalls, leave the spinner instead of hanging forever.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (signUpLoaded && signUp?.status === "missing_requirements") {
        router.replace(AUTH_CONTINUE_PATH);
        return;
      }
      if (authLoaded && isSignedIn) {
        window.location.assign(AUTH_AFTER_SIGN_IN_PATH);
        return;
      }
      router.replace(AUTH_SIGN_IN_PATH);
    }, SSO_STUCK_MS);

    return () => window.clearTimeout(timer);
  }, [authLoaded, isSignedIn, router, signUp?.status, signUpLoaded]);

  return (
    <div className="sso-callback">
      <AuthenticateWithRedirectCallback
        signInUrl={AUTH_SIGN_IN_PATH}
        signUpUrl={AUTH_SIGN_UP_PATH}
        continueSignUpUrl={AUTH_CONTINUE_PATH}
      />
      {/* Above the fixed loader and centered - Clerk bot protection needs this
          node reachable; interactive Turnstile must not sit in the corner. */}
      <div
        id="clerk-captcha"
        className="sso-callback__captcha"
        data-cl-theme="light"
        data-cl-size="compact"
      />
      <AppLoader />
    </div>
  );
}

export function SSOCallbackHandler() {
  return (
    <React.Suspense fallback={<AppLoader />}>
      <SSOCallbackInner />
    </React.Suspense>
  );
}
