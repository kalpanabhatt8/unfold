import { redirect } from "next/navigation";
import { AUTH_CONTINUE_PATH } from "@/lib/auth-routes";

export default function LegacyGetStartedContinueRedirect() {
  redirect(AUTH_CONTINUE_PATH);
}
