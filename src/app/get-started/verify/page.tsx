import { redirect } from "next/navigation";
import { AUTH_SIGN_IN_PATH } from "@/lib/auth-routes";

export default function LegacyGetStartedVerifyRedirect() {
  redirect(AUTH_SIGN_IN_PATH);
}
