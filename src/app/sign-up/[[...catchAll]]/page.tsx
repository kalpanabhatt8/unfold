import { ClerkProvider, SignUp } from "@clerk/nextjs";

export default function Signup() {
  return (
    <ClerkProvider
      appearance={{
        theme: "simple",
        variables: {
          colorPrimary: "var(--color-primary)",
        },
        elements: {
          componentContainer: {
            border: "var(--popup-border)",
          },
          developmentOrTestModeBox: {
            background: "var(--color-surface-raised)",
            border: "var(--popup-border)",
          },
          headerTitle: {
          },
        },
      }}
    >
      {/* this is repo change  */}
      {/* this is repo change  */}
      <div className="flex justify-center items-center w-[100%] h-[100vh]">
        <SignUp
          routing="path"
          path="/sign-up"
          afterSignInUrl="/dashboard"
          afterSignUpUrl="/dashboard"
        />
      </div>
    </ClerkProvider>
  );
}
