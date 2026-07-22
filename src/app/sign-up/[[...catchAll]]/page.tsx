import { redirect } from "next/navigation";

import { AUTH_SIGN_IN_PATH } from "@/lib/auth-routes";

/** Old /sign-up links land on the combined get-started screen. */
export default function Signup() {
  redirect(AUTH_SIGN_IN_PATH);
}
