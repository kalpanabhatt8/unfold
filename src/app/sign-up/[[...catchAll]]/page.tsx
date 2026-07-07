import { SignUp } from "@clerk/nextjs";

export default function Signup() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <SignUp
        routing="path"
        path="/sign-up"
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
      />
    </div>
  );
}
