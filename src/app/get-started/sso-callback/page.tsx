import { redirect } from "next/navigation";
import { AUTH_SSO_CALLBACK_PATH } from "@/lib/auth-routes";

export default function LegacyGetStartedSsoRedirect() {
  redirect(AUTH_SSO_CALLBACK_PATH);
}
