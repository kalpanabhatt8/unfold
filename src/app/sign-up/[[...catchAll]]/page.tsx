import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";

export default async function SignUpPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return <AuthForm />;
}
