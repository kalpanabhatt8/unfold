"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { AUTH_SIGN_IN_PATH } from "@/lib/auth-routes";
import { completeOAuthSignUp } from "@/lib/auth-finalize";
import "@/components/auth/auth-form.css";

/**
 * Silent finish for OAuth when Clerk still needs legalAccepted / username.
 * Any other state (cancel, stale email OTP, etc.) returns to /sign-in quietly.
 */
export default function ContinueSignUpPage() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const finishing = React.useRef(false);

  React.useEffect(() => {
    if (!isLoaded || finishing.current) return;

    if (!signUp?.id) {
      router.replace(AUTH_SIGN_IN_PATH);
      return;
    }

    if (signUp.status === "complete" && signUp.createdSessionId) {
      finishing.current = true;
      void setActive({ session: signUp.createdSessionId }).then(() => {
        window.location.assign("/dashboard");
      });
      return;
    }

    if (signUp.status !== "missing_requirements") {
      router.replace(AUTH_SIGN_IN_PATH);
      return;
    }

    finishing.current = true;
    void completeOAuthSignUp(signUp, setActive).then((result) => {
      if (result === "sign-in") {
        finishing.current = false;
        router.replace(AUTH_SIGN_IN_PATH);
      }
    });
  }, [isLoaded, signUp, setActive, router]);

  return (
    <div className="auth-shell auth-shell--top">
      <p className="auth-redirecting">Opening Unfold…</p>
    </div>
  );
}
