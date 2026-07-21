import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./global.css";

import { StorageNamespaceMigration } from "@/components/storage-namespace-migration";
import { Bonheur_Royale, Bricolage_Grotesque, Figtree, Lora } from "next/font/google";

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-bricolage",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--font-figtree",
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
      signUpUrl="/sign-in"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <html
        lang="en"
        className={`${bricolageGrotesque.variable} ${figtree.variable} ${lora.variable} ${bonheurRoyale.variable}`}
        suppressHydrationWarning
      >
        <body
          suppressHydrationWarning
          className={`${figtree.className} font-sans`}
        >
          <StorageNamespaceMigration />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
