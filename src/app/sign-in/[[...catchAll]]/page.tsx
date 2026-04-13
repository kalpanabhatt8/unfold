import { ClerkProvider, SignIn } from "@clerk/nextjs";

export default function Signin() {
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
          headerTitle: {},
        },
      }}
    >
      <div className="flex justify-center items-center w-[100%] h-[100vh]">
        <SignIn
          routing="path"
          path="/sign-in"
          afterSignInUrl="/dashboard"
          afterSignUpUrl="/dashboard"
        />
        
      </div>
    </ClerkProvider>
  );
}
