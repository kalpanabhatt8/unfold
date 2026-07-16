"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import "@/components/auth/auth-form.css";

/**
 * Silent finish for OAuth when Clerk still needs legalAccepted.
 * No username / setup form — users should only see credentials + OTP.
 */
export default function ContinueSignUpPage() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [error, setError] = React.useState<string | null>(null);
  const finishing = React.useRef(false);

  React.useEffect(() => {
    if (!isLoaded || finishing.current) return;

    if (!signUp?.id) {
      router.replace("/sign-in");
      return;
    }

    if (signUp.status === "complete" && signUp.createdSessionId) {
      finishing.current = true;
      void setActive({ session: signUp.createdSessionId }).then(() => {
        window.location.assign("/dashboard");
      });
      return;
    }

    finishing.current = true;
    void (async () => {
      try {
        const res = await signUp.update({ legalAccepted: true });
        if (res.status === "complete" && res.createdSessionId) {
          await setActive({ session: res.createdSessionId });
          window.location.assign("/dashboard");
          return;
        }
        setError("Couldn’t finish signing in. Please try again.");
        finishing.current = false;
      } catch {
        setError("Couldn’t finish signing in. Please try again.");
        finishing.current = false;
      }
    })();
  }, [isLoaded, signUp, setActive, router]);

  if (error) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="auth-error" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="auth-submit"
            onClick={() => router.replace("/sign-in")}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell auth-shell--top">
      <p className="auth-redirecting">Opening Unfold…</p>
    </div>
  );
}
