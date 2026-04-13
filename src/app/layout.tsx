import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./global.css";
import "./book.css";
import { ThemeProvider, THEME_STORAGE_KEY } from "@/components/theme/theme-provider";

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
  const setInitialThemeScript = `
    (function() {
      try {
        var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
        var theme = (stored === "light" || stored === "dark")
          ? stored
          : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.setAttribute("data-theme", theme);
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.style.colorScheme = theme;
      } catch (e) {}
    })();
  `;

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
        <head>
          <script dangerouslySetInnerHTML={{ __html: setInitialThemeScript }} />
        </head>
        <body suppressHydrationWarning className={`${manrope.className} font-sans`}>
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
