import { SSOCallbackHandler } from "@/components/auth/sso-callback-handler";
import "@/components/auth/auth-form.css";

export default function SSOCallbackPage() {
  return (
    <div className="auth-shell auth-shell--top">
      <SSOCallbackHandler />
    </div>
  );
}
