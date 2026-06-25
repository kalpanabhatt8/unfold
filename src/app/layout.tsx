import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./global.css";
import "./book.css";

// Google Fonts
import {
  Balsamiq_Sans,
  Bonheur_Royale,
  Bricolage_Grotesque,
  Caveat,
  Covered_By_Your_Grace,
  DM_Sans,
  Figtree,
  Lora,
} from "next/font/google";

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-bricolage",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-dm-sans",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-figtree",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-caveat",
});

const coveredByYourGrace = Covered_By_Your_Grace({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-covered-by-your-grace",
});

// Writing-area serif used by the canvas. Defined globally so we can reference
// it via the `--font-lora` CSS variable wherever a writing surface lives.
const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-lora",
});

const balsamiqSans = Balsamiq_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-balsamiq-sans",
});

const bonheurRoyale = Bonheur_Royale({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-bonheur-royale",
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
          fontFamily: `var(${dmSans.variable}), sans-serif`,
        },
        elements: {
          componentContainer: {
            border: "var(--popup-border)",
            fontFamily: `var(${dmSans.variable}), sans-serif !important`,
          },
          developmentOrTestModeBox: {
            background: "var(--color-surface-raised)",
            border: "var(--popup-border)",
          },
          headerTitle: {
            fontFamily: `var(${dmSans.variable}), sans-serif !important`,
          },
        },
      }}
    >
      <html
        lang="en"
        className={`${bricolageGrotesque.variable} ${dmSans.variable} ${figtree.variable} ${caveat.variable} ${coveredByYourGrace.variable} ${lora.variable} ${balsamiqSans.variable} ${bonheurRoyale.variable}`}
        suppressHydrationWarning
      >
        <body suppressHydrationWarning className={`${figtree.className} font-sans`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
