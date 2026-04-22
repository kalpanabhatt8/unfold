import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./global.css";
import "./book.css";

// Google Fonts
import { Bricolage_Grotesque, Manrope, Caveat } from "next/font/google";

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-bricolage",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Keeps",
  description: "A private, playful scrapbook to plan, rant, dream, and collect pretty things.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      appearance={{
        theme: "simple",
        variables: {
          colorPrimary: "var(--color-primary)",
          fontFamily: `var(${manrope.variable}), sans-serif`,
        },
        elements: {
          componentContainer: {
            border: "var(--popup-border)",
            fontFamily: `var(${manrope.variable}), sans-serif !important`,
          },
          developmentOrTestModeBox: {
            background: "var(--color-surface-raised)",
            border: "var(--popup-border)",
          },
          headerTitle: {
            fontFamily: `var(${manrope.variable}), sans-serif !important`,
          },
        },
      }}
    >
      <html
        lang="en"
        className={`
          ${bricolageGrotesque.variable} ${manrope.variable} ${caveat.variable}
        `}
      >
        <body suppressHydrationWarning className={`${manrope.className} font-sans`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
