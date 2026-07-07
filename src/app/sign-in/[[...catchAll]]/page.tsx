import { SignIn } from "@clerk/nextjs";

export default function Signin() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <SignIn
        routing="path"
        path="/sign-in"
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
      />
    </div>
  );
}
