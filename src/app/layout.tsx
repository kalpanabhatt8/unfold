import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./global.css";

import { StorageNamespaceMigration } from "@/components/storage-namespace-migration";
import { Bonheur_Royale, Lora, Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-lora",
});

const bonheurRoyale = Bonheur_Royale({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-bonheur-royale",
});

export const metadata: Metadata = {
  title: "Unfold",
  description:
    "A private journal that helps you notice patterns in your thoughts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      appearance={{
        captcha: {
          theme: "light",
          size: "normal",
        },
      }}
    >
      <html
        lang="en"
        className={`${plusJakarta.variable} ${lora.variable} ${bonheurRoyale.variable}`}
        suppressHydrationWarning
      >
        <body
          suppressHydrationWarning
          className={`${plusJakarta.className} font-sans`}
        >
          <StorageNamespaceMigration />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
