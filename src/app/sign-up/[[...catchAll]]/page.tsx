import { redirect } from "next/navigation";

/** Old /sign-up links land on the combined auth screen. */
export default function Signup() {
  redirect("/sign-in");
}
