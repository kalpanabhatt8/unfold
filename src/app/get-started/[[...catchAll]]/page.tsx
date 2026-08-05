import { redirect } from "next/navigation";
import { AUTH_SIGN_UP_PATH } from "@/lib/auth-routes";

/** Legacy /get-started links redirect to sign-up. */
export default function LegacyGetStartedRedirect() {
  redirect(AUTH_SIGN_UP_PATH);
}
