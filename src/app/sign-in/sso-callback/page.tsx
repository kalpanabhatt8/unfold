import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import "@/components/auth/auth-form.css";

export default function SSOCallbackPage() {
  return (
    <div className="auth-shell auth-shell--top">
      <AuthenticateWithRedirectCallback continueSignUpUrl="/sign-in/continue" />
      <p className="auth-redirecting">Opening Unfold…</p>
      <div id="clerk-captcha" />
    </div>
  );
}
