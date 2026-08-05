import { redirect } from "next/navigation";
import { AUTH_SIGN_UP_VERIFY_PATH } from "@/lib/auth-routes";

export default function LegacyGetStartedVerifyRedirect() {
  redirect(AUTH_SIGN_UP_VERIFY_PATH);
}
