"use client";

import * as React from "react";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AUTH_CONTINUE_PATH,
  AUTH_SIGN_IN_PATH,
  AUTH_SIGN_UP_PATH,
} from "@/lib/auth-routes";
import { isOAuthAbort } from "@/lib/auth-finalize";

function SSOCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (isOAuthAbort(searchParams)) {
      router.replace(AUTH_SIGN_IN_PATH);
    }
  }, [router, searchParams]);

  return (
    <>
      <AuthenticateWithRedirectCallback
        signInUrl={AUTH_SIGN_IN_PATH}
        signUpUrl={AUTH_SIGN_UP_PATH}
        continueSignUpUrl={AUTH_CONTINUE_PATH}
      />
      <p className="auth-redirecting">Opening Unfold…</p>
      <div id="clerk-captcha" />
    </>
  );
}

export function SSOCallbackHandler() {
  return (
    <React.Suspense fallback={<p className="auth-redirecting">Opening Unfold…</p>}>
      <SSOCallbackInner />
    </React.Suspense>
  );
}
